"""TripZen Backend - Child Transport Safety Platform"""
import os
import io
import csv
import math
import uuid
import logging
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
import bcrypt
import jwt
import asyncio
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----- Config -----
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "tripzen_db")
JWT_SECRET = os.environ.get("JWT_SECRET", "tripzen-supersecret-change-in-prod")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_ALGO = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TripZen API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tripzen")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


# ----- Models -----
Role = Literal["parent", "driver", "admin"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str
    role: Role = "parent"
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: Role
    phone: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class StudentCreate(BaseModel):
    name: str
    grade: Optional[str] = None
    school: Optional[str] = None
    avatar_url: Optional[str] = None
    route_id: Optional[str] = None


class Student(BaseModel):
    id: str
    parent_id: str
    name: str
    grade: Optional[str] = None
    school: Optional[str] = None
    avatar_url: Optional[str] = None
    route_id: Optional[str] = None
    qr_code: str  # unique scannable code


class Stop(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    order: int
    eta: Optional[str] = None  # "07:30 AM"


class RouteCreate(BaseModel):
    name: str
    driver_id: Optional[str] = None
    bus_number: Optional[str] = None
    stops: List[Stop] = []
    shift: Literal["morning", "afternoon"] = "morning"


class RouteModel(BaseModel):
    id: str
    name: str
    driver_id: Optional[str] = None
    bus_number: Optional[str] = None
    stops: List[Stop]
    shift: str
    student_count: int = 0


class TripModel(BaseModel):
    id: str
    route_id: str
    route_name: str
    driver_id: str
    started_at: str
    ended_at: Optional[str] = None
    status: Literal["active", "completed"]
    current_lat: float
    current_lng: float
    current_stop_index: int = 0
    boarded_student_ids: List[str] = []
    checked_out_student_ids: List[str] = []
    eta_next_stop: Optional[str] = None


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    stop_index: Optional[int] = None


class ScanRequest(BaseModel):
    qr_code: str
    action: Literal["board", "checkout"]


class NotificationModel(BaseModel):
    id: str
    user_id: str
    student_id: Optional[str] = None
    type: str  # "boarding", "arrival", "handover", "delay", "alert"
    title: str
    message: str
    created_at: str
    read: bool = False
    icon: Optional[str] = None


class BookingCreate(BaseModel):
    student_id: str
    route_id: str
    plan: Literal["monthly", "single"] = "monthly"


class BookingModel(BaseModel):
    id: str
    parent_id: str
    student_id: str
    route_id: str
    plan: str
    amount: float
    currency: str = "GBP"
    status: Literal["pending", "paid", "failed"] = "pending"
    created_at: str
    paid_at: Optional[str] = None
    payment_ref: Optional[str] = None


class AlertModel(BaseModel):
    id: str
    type: str
    title: str
    message: str
    severity: Literal["info", "warning", "critical"]
    created_at: str
    related_trip_id: Optional[str] = None


# ----- Auth helpers -----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker


# ----- Auth Routes -----
@api.post("/auth/register", response_model=TokenResponse)
async def register(body: UserCreate):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, body.role)
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user_id, email=body.email.lower(), full_name=body.full_name,
            role=body.role, phone=body.phone,
        ),
    )


@api.post("/auth/login", response_model=TokenResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user["id"], email=user["email"], full_name=user["full_name"],
            role=user["role"], phone=user.get("phone"),
        ),
    )


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**{k: user.get(k) for k in ["id", "email", "full_name", "role", "phone"]})


# ----- Students -----
@api.get("/students")
async def list_students(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"parent_id": user["id"]}
    cursor = db.students.find(query, {"_id": 0})
    return await cursor.to_list(1000)


@api.post("/students")
async def create_student(body: StudentCreate, user: dict = Depends(get_current_user)):
    sid = str(uuid.uuid4())
    parent_id = user["id"] if user["role"] == "parent" else (await _get_first_parent_id())
    doc = {
        "id": sid,
        "parent_id": parent_id,
        "name": body.name,
        "grade": body.grade,
        "school": body.school,
        "avatar_url": body.avatar_url,
        "route_id": body.route_id,
        "qr_code": f"TRIPZEN-{sid[:8].upper()}",
        "created_at": now_iso(),
    }
    await db.students.insert_one(doc)
    if body.route_id:
        await db.routes.update_one({"id": body.route_id}, {"$inc": {"student_count": 1}})
    return {k: v for k, v in doc.items() if k != "_id"}


async def _get_first_parent_id() -> str:
    p = await db.users.find_one({"role": "parent"})
    return p["id"] if p else "unknown"


@api.put("/students/{sid}")
async def update_student(sid: str, body: StudentCreate, user: dict = Depends(get_current_user)):
    existing = await db.students.find_one({"id": sid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Student not found")
    if user["role"] == "parent" and existing.get("parent_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    old_route = existing.get("route_id")
    upd = body.dict(exclude_unset=True)
    await db.students.update_one({"id": sid}, {"$set": upd})
    new_route = upd.get("route_id", old_route)
    if old_route != new_route:
        if old_route:
            await db.routes.update_one({"id": old_route}, {"$inc": {"student_count": -1}})
        if new_route:
            await db.routes.update_one({"id": new_route}, {"$inc": {"student_count": 1}})
    return await db.students.find_one({"id": sid}, {"_id": 0})


@api.delete("/students/{sid}")
async def delete_student(sid: str, user: dict = Depends(get_current_user)):
    existing = await db.students.find_one({"id": sid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Student not found")
    if user["role"] == "parent" and existing.get("parent_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    await db.students.delete_one({"id": sid})
    if existing.get("route_id"):
        await db.routes.update_one({"id": existing["route_id"]}, {"$inc": {"student_count": -1}})
    return {"ok": True}


# ----- Routes -----
@api.get("/routes")
async def list_routes(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "driver":
        query = {"driver_id": user["id"]}
    cursor = db.routes.find(query, {"_id": 0})
    return await cursor.to_list(1000)


@api.post("/routes")
async def create_route(body: RouteCreate, user: dict = Depends(require_roles("admin"))):
    rid = str(uuid.uuid4())
    doc = body.dict()
    doc["id"] = rid
    doc["student_count"] = 0
    doc["created_at"] = now_iso()
    await db.routes.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/routes/{route_id}")
async def get_route(route_id: str, user: dict = Depends(get_current_user)):
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(404, "Route not found")
    return route


@api.put("/routes/{route_id}")
async def update_route(route_id: str, body: RouteCreate, user: dict = Depends(require_roles("admin"))):
    upd = body.dict(exclude_unset=True)
    res = await db.routes.update_one({"id": route_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Route not found")
    return await db.routes.find_one({"id": route_id}, {"_id": 0})


@api.delete("/routes/{route_id}")
async def delete_route(route_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.routes.delete_one({"id": route_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Route not found")
    await db.students.update_many({"route_id": route_id}, {"$set": {"route_id": None}})
    return {"ok": True}


# ----- Trips -----
@api.post("/trips/start")
async def start_trip(body: dict, user: dict = Depends(require_roles("driver"))):
    route_id = body.get("route_id")
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(404, "Route not found")
    # End any other active trip for this driver
    await db.trips.update_many(
        {"driver_id": user["id"], "status": "active"},
        {"$set": {"status": "completed", "ended_at": now_iso()}},
    )
    first_stop = route["stops"][0] if route["stops"] else None
    trip_id = str(uuid.uuid4())
    trip = {
        "id": trip_id,
        "route_id": route_id,
        "route_name": route["name"],
        "driver_id": user["id"],
        "started_at": now_iso(),
        "ended_at": None,
        "status": "active",
        "current_lat": first_stop["lat"] if first_stop else 51.5074,
        "current_lng": first_stop["lng"] if first_stop else -0.1278,
        "current_stop_index": 0,
        "boarded_student_ids": [],
        "checked_out_student_ids": [],
        "eta_next_stop": first_stop["eta"] if first_stop else None,
    }
    await db.trips.insert_one(trip)
    return {k: v for k, v in trip.items() if k != "_id"}


@api.post("/trips/{trip_id}/location")
async def update_location(trip_id: str, body: LocationUpdate, user: dict = Depends(require_roles("driver"))):
    upd = {"current_lat": body.lat, "current_lng": body.lng}
    if body.stop_index is not None:
        upd["current_stop_index"] = body.stop_index
    await db.trips.update_one({"id": trip_id, "driver_id": user["id"]}, {"$set": upd})
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    # Broadcast to live WS subscribers
    if trip:
        try:
            await ws_manager.broadcast(trip_id, {"type": "location", "trip": trip})
        except Exception:
            pass
    return trip


@api.post("/trips/{trip_id}/end")
async def end_trip(trip_id: str, user: dict = Depends(require_roles("driver"))):
    await db.trips.update_one(
        {"id": trip_id, "driver_id": user["id"]},
        {"$set": {"status": "completed", "ended_at": now_iso()}},
    )
    return {"ok": True}


@api.post("/trips/{trip_id}/scan")
async def scan_student(trip_id: str, body: ScanRequest, user: dict = Depends(require_roles("driver"))):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    student = await db.students.find_one({"qr_code": body.qr_code}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found for QR")
    if body.action == "board":
        await db.trips.update_one({"id": trip_id}, {"$addToSet": {"boarded_student_ids": student["id"]}})
        await _create_notification(
            student["parent_id"], student["id"], "boarding",
            f"{student['name']} has boarded the bus",
            f"Bus on {trip['route_name']} - {now_utc().strftime('%H:%M')}",
            icon="bus",
        )
    else:
        await db.trips.update_one({"id": trip_id}, {"$addToSet": {"checked_out_student_ids": student["id"]}})
        await _create_notification(
            student["parent_id"], student["id"], "handover",
            f"{student['name']} has been safely handed over",
            f"Checked out at {now_utc().strftime('%H:%M')}",
            icon="check",
        )
    return {"ok": True, "student": student}


@api.get("/trips/active")
async def active_trips(user: dict = Depends(get_current_user)):
    if user["role"] == "driver":
        cursor = db.trips.find({"driver_id": user["id"], "status": "active"}, {"_id": 0})
    elif user["role"] == "parent":
        # Get parent's students' routes' active trips
        students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
        route_ids = [s["route_id"] for s in students if s.get("route_id")]
        cursor = db.trips.find({"route_id": {"$in": route_ids}, "status": "active"}, {"_id": 0})
    else:
        cursor = db.trips.find({"status": "active"}, {"_id": 0})
    trips = await cursor.to_list(100)
    return trips


@api.get("/trips/{trip_id}")
async def get_trip(trip_id: str, user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    return trip


# ----- Notifications -----
async def _create_notification(user_id: str, student_id: Optional[str], ntype: str, title: str, message: str, icon: Optional[str] = None):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "student_id": student_id,
        "type": ntype,
        "title": title,
        "message": message,
        "icon": icon,
        "created_at": now_iso(),
        "read": False,
    }
    await db.notifications.insert_one(doc)
    return doc


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ----- Bookings & Payments (Mocked Stripe) -----
PRICE_MAP = {"monthly": 89.99, "single": 4.50}


@api.post("/bookings")
async def create_booking(body: BookingCreate, user: dict = Depends(require_roles("parent"))):
    bid = str(uuid.uuid4())
    base = PRICE_MAP.get(body.plan, 89.99)
    # Sibling discount: 20% off each additional active monthly booking for same parent
    existing_paid = await db.bookings.count_documents({
        "parent_id": user["id"],
        "status": "paid",
        "plan": "monthly",
    })
    discount = 0.0
    if body.plan == "monthly" and existing_paid >= 1:
        discount = round(base * 0.20, 2)
    amount = round(base - discount, 2)
    doc = {
        "id": bid,
        "parent_id": user["id"],
        "student_id": body.student_id,
        "route_id": body.route_id,
        "plan": body.plan,
        "amount": amount,
        "base_amount": base,
        "discount": discount,
        "currency": "GBP",
        "status": "pending",
        "created_at": now_iso(),
        "paid_at": None,
        "payment_ref": None,
    }
    await db.bookings.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/bookings")
async def list_bookings(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"parent_id": user["id"]}
    cursor = db.bookings.find(query, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@api.post("/bookings/{bid}/pay")
async def pay_booking(bid: str, user: dict = Depends(require_roles("parent"))):
    # Mock Stripe payment - real integration requires development build
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    payment_ref = f"pi_test_{uuid.uuid4().hex[:16]}"
    await db.bookings.update_one(
        {"id": bid},
        {"$set": {"status": "paid", "paid_at": now_iso(), "payment_ref": payment_ref}},
    )
    return {"ok": True, "payment_ref": payment_ref, "amount": booking["amount"]}


# ----- Admin -----
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_roles("admin"))):
    total_routes = await db.routes.count_documents({})
    total_students = await db.students.count_documents({})
    active_trips = await db.trips.count_documents({"status": "active"})
    completed_today = await db.trips.count_documents({
        "status": "completed",
        "ended_at": {"$gte": now_utc().replace(hour=0, minute=0, second=0).isoformat()},
    })
    total_drivers = await db.users.count_documents({"role": "driver"})
    total_parents = await db.users.count_documents({"role": "parent"})
    # On-time approximation
    on_time = 92
    return {
        "total_routes": total_routes,
        "total_students": total_students,
        "active_buses": active_trips,
        "on_time_percent": on_time,
        "completed_today": completed_today,
        "total_drivers": total_drivers,
        "total_parents": total_parents,
    }


@api.get("/admin/alerts")
async def admin_alerts(user: dict = Depends(require_roles("admin"))):
    cursor = db.alerts.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(50)


@api.get("/admin/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0})
    return await cursor.to_list(1000)


@api.post("/admin/users")
async def create_user_admin(body: UserCreate, user: dict = Depends(require_roles("admin"))):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": body.email.lower(),
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id" and k != "password_hash"}


@api.delete("/admin/users/{uid}")
async def delete_user_admin(uid: str, user: dict = Depends(require_roles("admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    res = await db.users.delete_one({"id": uid})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.get("/admin/revenue")
async def admin_revenue(user: dict = Depends(require_roles("admin"))):
    pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    res = await db.bookings.aggregate(pipeline).to_list(1)
    total = res[0]["total"] if res else 0
    count = res[0]["count"] if res else 0
    pending = await db.bookings.count_documents({"status": "pending"})
    return {
        "total_revenue": round(total, 2),
        "paid_bookings": count,
        "pending_bookings": pending,
        "currency": "GBP",
    }


# ----- Emergency SOS & Incidents -----
class IncidentCreate(BaseModel):
    type: Literal["delay", "breakdown", "traffic", "behavior", "other"]
    description: str


@api.post("/trips/{trip_id}/sos")
async def trigger_sos(trip_id: str, user: dict = Depends(require_roles("driver"))):
    trip = await db.trips.find_one({"id": trip_id, "driver_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    # Critical alert to admin
    alert_doc = {
        "id": str(uuid.uuid4()),
        "type": "sos",
        "title": f"🚨 EMERGENCY SOS — {trip['route_name']}",
        "message": f"Driver triggered SOS. Location: {trip['current_lat']:.4f}, {trip['current_lng']:.4f}",
        "severity": "critical",
        "created_at": now_iso(),
        "related_trip_id": trip_id,
    }
    await db.alerts.insert_one(alert_doc)
    # Notify every parent whose child is boarded
    boarded = trip.get("boarded_student_ids", [])
    if boarded:
        students = await db.students.find({"id": {"$in": boarded}}, {"_id": 0}).to_list(100)
        for s in students:
            await _create_notification(
                s["parent_id"], s["id"], "alert",
                f"⚠️ Bus emergency — {s['name']}",
                "Driver has signaled an emergency. Help is being dispatched. Stay calm.",
                icon="warning",
            )
    return {"ok": True, "alert_id": alert_doc["id"], "notified_parents": len(boarded)}


@api.post("/trips/{trip_id}/incident")
async def report_incident(trip_id: str, body: IncidentCreate, user: dict = Depends(require_roles("driver"))):
    trip = await db.trips.find_one({"id": trip_id, "driver_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    incident_id = str(uuid.uuid4())
    doc = {
        "id": incident_id,
        "trip_id": trip_id,
        "driver_id": user["id"],
        "type": body.type,
        "description": body.description,
        "created_at": now_iso(),
    }
    await db.incidents.insert_one(doc)
    severity = "critical" if body.type == "breakdown" else "warning"
    await db.alerts.insert_one({
        "id": str(uuid.uuid4()),
        "type": "incident",
        "title": f"Incident — {body.type.title()} on {trip['route_name']}",
        "message": body.description[:200],
        "severity": severity,
        "created_at": now_iso(),
        "related_trip_id": trip_id,
    })
    # Notify all boarded parents
    boarded = trip.get("boarded_student_ids", [])
    if boarded:
        students = await db.students.find({"id": {"$in": boarded}}, {"_id": 0}).to_list(100)
        for s in students:
            await _create_notification(
                s["parent_id"], s["id"], "delay",
                f"Bus update — {s['name']}",
                f"{body.type.title()}: {body.description[:120]}",
                icon="alert-circle",
            )
    return {"ok": True, "incident_id": incident_id}


@api.get("/admin/incidents")
async def list_incidents(user: dict = Depends(require_roles("admin"))):
    cursor = db.incidents.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(100)


# ----- Trip Ratings -----
class RatingCreate(BaseModel):
    trip_id: str
    stars: int = Field(ge=1, le=5)
    feedback: Optional[str] = None


@api.post("/ratings")
async def create_rating(body: RatingCreate, user: dict = Depends(require_roles("parent"))):
    trip = await db.trips.find_one({"id": body.trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    # Ensure this parent's child was on the trip
    children = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
    child_ids = {c["id"] for c in children}
    if not (set(trip.get("boarded_student_ids", [])) & child_ids):
        raise HTTPException(403, "Your child was not on this trip")
    rid = str(uuid.uuid4())
    doc = {
        "id": rid,
        "trip_id": body.trip_id,
        "driver_id": trip["driver_id"],
        "parent_id": user["id"],
        "stars": body.stars,
        "feedback": body.feedback,
        "created_at": now_iso(),
    }
    await db.ratings.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/ratings/driver/{driver_id}")
async def driver_ratings(driver_id: str, user: dict = Depends(get_current_user)):
    cursor = db.ratings.find({"driver_id": driver_id}, {"_id": 0}).sort("created_at", -1)
    ratings = await cursor.to_list(100)
    if not ratings:
        return {"average": 0, "count": 0, "ratings": []}
    avg = sum(r["stars"] for r in ratings) / len(ratings)
    return {"average": round(avg, 2), "count": len(ratings), "ratings": ratings}


# ----- Parent <-> Driver Chat -----
class MessageCreate(BaseModel):
    recipient_id: str
    text: str


@api.post("/messages")
async def send_message(body: MessageCreate, user: dict = Depends(get_current_user)):
    recipient = await db.users.find_one({"id": body.recipient_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    # Only parent <-> driver allowed (admin can talk to anyone)
    allowed = (
        user["role"] == "admin"
        or recipient["role"] == "admin"
        or {user["role"], recipient["role"]} == {"parent", "driver"}
    )
    if not allowed:
        raise HTTPException(403, "Not allowed")
    mid = str(uuid.uuid4())
    doc = {
        "id": mid,
        "from_id": user["id"],
        "to_id": body.recipient_id,
        "text": body.text[:1000],
        "created_at": now_iso(),
        "read": False,
    }
    await db.messages.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/messages/{other_id}")
async def get_messages(other_id: str, user: dict = Depends(get_current_user)):
    cursor = db.messages.find(
        {
            "$or": [
                {"from_id": user["id"], "to_id": other_id},
                {"from_id": other_id, "to_id": user["id"]},
            ]
        },
        {"_id": 0},
    ).sort("created_at", 1)
    msgs = await cursor.to_list(500)
    # Mark received as read
    await db.messages.update_many(
        {"from_id": other_id, "to_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return msgs


@api.get("/messages")
async def list_threads(user: dict = Depends(get_current_user)):
    """Return list of conversation partners with last message."""
    pipeline = [
        {"$match": {"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {
            "$group": {
                "_id": {
                    "$cond": [{"$eq": ["$from_id", user["id"]]}, "$to_id", "$from_id"],
                },
                "last_text": {"$first": "$text"},
                "last_at": {"$first": "$created_at"},
                "unread": {
                    "$sum": {
                        "$cond": [
                            {"$and": [{"$eq": ["$to_id", user["id"]]}, {"$eq": ["$read", False]}]},
                            1,
                            0,
                        ]
                    }
                },
            }
        },
    ]
    threads = await db.messages.aggregate(pipeline).to_list(100)
    # Enrich with user info
    for t in threads:
        u = await db.users.find_one({"id": t["_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            t["user"] = u
        t["other_id"] = t.pop("_id")
    return threads


# ----- CSV Bulk Import (Students) -----
@api.post("/admin/students/import")
async def import_students(file: UploadFile = File(...), user: dict = Depends(require_roles("admin"))):
    contents = await file.read()
    text = contents.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors: List[str] = []
    parents_by_email: dict = {}
    routes_by_name: dict = {}
    async for p in db.users.find({"role": "parent"}, {"_id": 0}):
        parents_by_email[p["email"].lower()] = p["id"]
    async for r in db.routes.find({}, {"_id": 0}):
        routes_by_name[r["name"].lower()] = r["id"]
    for i, row in enumerate(reader, start=2):
        try:
            name = (row.get("name") or "").strip()
            if not name:
                errors.append(f"Row {i}: missing name")
                continue
            parent_email = (row.get("parent_email") or "").strip().lower()
            parent_id = parents_by_email.get(parent_email) if parent_email else (await _get_first_parent_id())
            if not parent_id:
                errors.append(f"Row {i}: parent {parent_email} not found")
                continue
            route_name = (row.get("route") or "").strip().lower()
            route_id = routes_by_name.get(route_name)
            sid = str(uuid.uuid4())
            await db.students.insert_one({
                "id": sid,
                "parent_id": parent_id,
                "name": name,
                "grade": (row.get("grade") or "").strip() or None,
                "school": (row.get("school") or "").strip() or None,
                "avatar_url": None,
                "route_id": route_id,
                "qr_code": f"TRIPZEN-{sid[:8].upper()}",
                "created_at": now_iso(),
            })
            if route_id:
                await db.routes.update_one({"id": route_id}, {"$inc": {"student_count": 1}})
            created += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")
    return {"created": created, "errors": errors}


# ----- GDPR Data Export -----
@api.get("/parent/gdpr-export")
async def gdpr_export(user: dict = Depends(require_roles("parent"))):
    """Return all data linked to this parent for GDPR Subject Access Request."""
    students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
    student_ids = [s["id"] for s in students]
    bookings = await db.bookings.find({"parent_id": user["id"]}, {"_id": 0}).to_list(500)
    notifications = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    messages = await db.messages.find(
        {"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}, {"_id": 0}
    ).to_list(500)
    ratings = await db.ratings.find({"parent_id": user["id"]}, {"_id": 0}).to_list(500)
    return {
        "exported_at": now_iso(),
        "user": {k: user.get(k) for k in ["id", "email", "full_name", "role", "phone"]},
        "children": students,
        "bookings": bookings,
        "notifications": notifications,
        "messages": messages,
        "ratings": ratings,
    }


@api.delete("/parent/account")
async def gdpr_delete_account(user: dict = Depends(require_roles("parent"))):
    """GDPR right to be forgotten - delete parent account and all associated data."""
    students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
    for s in students:
        if s.get("route_id"):
            await db.routes.update_one({"id": s["route_id"]}, {"$inc": {"student_count": -1}})
    await db.students.delete_many({"parent_id": user["id"]})
    await db.bookings.delete_many({"parent_id": user["id"]})
    await db.notifications.delete_many({"user_id": user["id"]})
    await db.messages.delete_many({"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]})
    await db.ratings.delete_many({"parent_id": user["id"]})
    await db.users.delete_one({"id": user["id"]})
    return {"ok": True, "deleted_at": now_iso()}


# ----- Smart ETA & Geofencing helpers -----
def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@api.get("/trips/{trip_id}/eta")
async def trip_eta(trip_id: str, user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    route = await db.routes.find_one({"id": trip["route_id"]}, {"_id": 0})
    if not route or not route.get("stops"):
        return {"eta_minutes": None, "distance_m": 0, "next_stop": None, "geofence_alert": False}
    next_idx = min(trip["current_stop_index"] + 1, len(route["stops"]) - 1)
    next_stop = route["stops"][next_idx]
    dist = _haversine_m(trip["current_lat"], trip["current_lng"], next_stop["lat"], next_stop["lng"])
    # assume 30 km/h average urban speed = 500 m/min
    eta_min = max(1, round(dist / 500))
    geofence = dist <= 500
    return {
        "eta_minutes": eta_min,
        "distance_m": round(dist),
        "next_stop": next_stop,
        "geofence_alert": geofence,
    }


# ----- AI Weekly Summary -----
@api.get("/parent/weekly-summary/{student_id}")
async def weekly_summary(student_id: str, user: dict = Depends(require_roles("parent"))):
    student = await db.students.find_one({"id": student_id, "parent_id": user["id"]}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")
    week_ago = (now_utc() - timedelta(days=7)).isoformat()
    notifs = await db.notifications.find(
        {"user_id": user["id"], "student_id": student_id, "created_at": {"$gte": week_ago}},
        {"_id": 0},
    ).to_list(200)
    if not notifs:
        return {
            "summary": f"No trips recorded for {student['name']} in the past week.",
            "count": 0,
            "ai_generated": False,
        }
    # Build context
    events = [f"{n['created_at'][:10]} {n['type']}: {n['title']}" for n in notifs[:50]]
    if not EMERGENT_LLM_KEY:
        return {
            "summary": f"{student['name']} had {len(notifs)} events this week, including boardings, arrivals and updates.",
            "count": len(notifs),
            "ai_generated": False,
        }
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"weekly-{student_id}",
            system_message=(
                "You are TripZen, a friendly child-transport assistant. Generate a warm, reassuring "
                "weekly summary for a parent about their child's school bus trips. Keep it to 3-4 short "
                "sentences. Mention any delays or issues honestly but reassuringly. End on a positive note."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"Child: {student['name']} ({student.get('grade','')}, {student.get('school','')})\n"
            f"Events this week:\n" + "\n".join(events) +
            "\n\nWrite the parent summary now."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        return {"summary": response.strip(), "count": len(notifs), "ai_generated": True}
    except Exception as e:
        logger.exception("weekly-summary LLM failed: %s", e)
        return {
            "summary": f"{student['name']} had {len(notifs)} events this week.",
            "count": len(notifs),
            "ai_generated": False,
            "error": str(e)[:200],
        }


# ----- Health -----
@api.get("/")
async def root():
    return {"app": "TripZen", "status": "ok"}


# ----- WebSockets (Live Trip Tracking) -----
class TripWSManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, trip_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(trip_id, []).append(ws)

    def disconnect(self, trip_id: str, ws: WebSocket):
        conns = self.connections.get(trip_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns and trip_id in self.connections:
            self.connections.pop(trip_id, None)

    async def broadcast(self, trip_id: str, payload: dict):
        dead: list[WebSocket] = []
        for ws in list(self.connections.get(trip_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(trip_id, ws)


ws_manager = TripWSManager()


@app.websocket("/api/ws/trip/{trip_id}")
async def trip_websocket(websocket: WebSocket, trip_id: str):
    """Stream live location updates for a trip. Clients can also send a ping JSON to keep alive."""
    await ws_manager.connect(trip_id, websocket)
    try:
        # Send initial snapshot if trip exists
        trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
        if trip:
            await websocket.send_json({"type": "snapshot", "trip": trip})
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Echo ping or ignore
                if msg.strip().lower() == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text("keepalive")
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws error: %s", e)
    finally:
        ws_manager.disconnect(trip_id, websocket)


# ----- Push Notification Tokens -----
class PushTokenIn(BaseModel):
    token: str
    platform: Optional[Literal["ios", "android", "web"]] = None


@api.post("/users/push-token")
async def save_push_token(body: PushTokenIn, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_token": body.token, "push_platform": body.platform, "push_updated_at": now_iso()}},
    )
    return {"ok": True}


async def _send_expo_push(tokens: List[str], title: str, body: str, data: Optional[dict] = None):
    """Send via Expo Push API. Silently no-ops if no tokens. Safe to call without setup."""
    valid = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid:
        return {"sent": 0, "reason": "no_valid_tokens"}
    messages = [{"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"} for t in valid]
    try:
        async with httpx.AsyncClient(timeout=10) as client_h:
            res = await client_h.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            return {"sent": len(valid), "status": res.status_code}
    except Exception as e:
        logger.warning("Expo push failed: %s", e)
        return {"sent": 0, "error": str(e)[:200]}


async def _notify_user_full(user_id: str, title: str, body: str, ntype: str = "alert", student_id: Optional[str] = None, icon: Optional[str] = None, data: Optional[dict] = None):
    """Create in-app notification + send Expo push (if token present)."""
    await _create_notification(user_id, student_id, ntype, title, body, icon)
    user_doc = await db.users.find_one({"id": user_id}, {"push_token": 1, "_id": 0})
    if user_doc and user_doc.get("push_token"):
        await _send_expo_push([user_doc["push_token"]], title, body, data)


# ----- WhatsApp Notifications (Twilio) -----
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WA_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "")  # e.g. whatsapp:+14155238886


class WhatsAppIn(BaseModel):
    to_phone: str  # e.g. +447700900222
    message: str


@api.post("/notifications/whatsapp")
async def send_whatsapp(body: WhatsAppIn, user: dict = Depends(get_current_user)):
    """Send WhatsApp via Twilio. Returns mocked=true if Twilio not configured."""
    if not (TWILIO_SID and TWILIO_TOKEN and TWILIO_WA_FROM):
        # Soft mock — still log the intent
        logger.info("WhatsApp MOCK send to=%s msg=%s", body.to_phone, body.message[:80])
        return {"ok": True, "mocked": True, "to": body.to_phone}
    try:
        async with httpx.AsyncClient(timeout=10) as client_h:
            res = await client_h.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
                data={
                    "From": TWILIO_WA_FROM,
                    "To": f"whatsapp:{body.to_phone}" if not body.to_phone.startswith("whatsapp:") else body.to_phone,
                    "Body": body.message,
                },
                auth=(TWILIO_SID, TWILIO_TOKEN),
            )
            if res.status_code >= 400:
                raise HTTPException(502, f"Twilio error: {res.text[:200]}")
            return {"ok": True, "mocked": False, "sid": res.json().get("sid")}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("whatsapp send failed")
        raise HTTPException(500, str(e)[:200])


# ----- Stripe Payment Intent (real SDK ready) -----
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")


@api.post("/bookings/{bid}/payment-intent")
async def create_payment_intent(bid: str, user: dict = Depends(require_roles("parent"))):
    """Create a real Stripe PaymentIntent if STRIPE_SECRET_KEY is set, else return mock client_secret."""
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["status"] == "paid":
        raise HTTPException(400, "Already paid")
    amount_pence = int(round(booking["amount"] * 100))
    if not STRIPE_SECRET_KEY:
        # Mock
        return {
            "client_secret": f"pi_mock_{uuid.uuid4().hex[:16]}_secret_mock",
            "publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", "pk_test_mock"),
            "amount": booking["amount"],
            "currency": booking["currency"].lower(),
            "mocked": True,
        }
    try:
        async with httpx.AsyncClient(timeout=15) as client_h:
            res = await client_h.post(
                "https://api.stripe.com/v1/payment_intents",
                data={
                    "amount": amount_pence,
                    "currency": booking["currency"].lower(),
                    "metadata[booking_id]": bid,
                    "metadata[parent_id]": user["id"],
                    "automatic_payment_methods[enabled]": "true",
                },
                auth=(STRIPE_SECRET_KEY, ""),
            )
            data = res.json()
            if res.status_code >= 400:
                raise HTTPException(502, data.get("error", {}).get("message", "Stripe error"))
            await db.bookings.update_one(
                {"id": bid},
                {"$set": {"payment_intent_id": data["id"]}},
            )
            return {
                "client_secret": data["client_secret"],
                "publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", ""),
                "amount": booking["amount"],
                "currency": booking["currency"].lower(),
                "mocked": False,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Stripe PI failed")
        raise HTTPException(500, str(e)[:200])


@api.post("/bookings/{bid}/confirm-payment")
async def confirm_payment(bid: str, user: dict = Depends(require_roles("parent"))):
    """Called by frontend after Stripe PaymentSheet succeeds. Verifies w/ Stripe if key present."""
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    pi_id = booking.get("payment_intent_id")
    if STRIPE_SECRET_KEY and pi_id and not pi_id.startswith("pi_mock"):
        try:
            async with httpx.AsyncClient(timeout=10) as client_h:
                r = await client_h.get(
                    f"https://api.stripe.com/v1/payment_intents/{pi_id}",
                    auth=(STRIPE_SECRET_KEY, ""),
                )
                data = r.json()
                if data.get("status") != "succeeded":
                    raise HTTPException(400, f"Payment not completed: {data.get('status')}")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Stripe verify failed: %s", e)
    await db.bookings.update_one(
        {"id": bid},
        {"$set": {"status": "paid", "paid_at": now_iso(), "payment_ref": pi_id or f"pi_test_{uuid.uuid4().hex[:16]}"}},
    )
    return {"ok": True, "amount": booking["amount"]}


# ----- Seed Data -----
async def seed_data():
    # Admin
    admin = await db.users.find_one({"email": "admin@tripzen.com"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@tripzen.com",
            "full_name": "TripZen Admin",
            "role": "admin",
            "phone": "+447700900000",
            "password_hash": hash_password("admin123"),
            "created_at": now_iso(),
        })
        logger.info("Seeded admin user")

    # Demo driver
    driver = await db.users.find_one({"email": "driver@tripzen.com"})
    if not driver:
        driver_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": driver_id,
            "email": "driver@tripzen.com",
            "full_name": "John Smith",
            "role": "driver",
            "phone": "+447700900111",
            "password_hash": hash_password("driver123"),
            "created_at": now_iso(),
        })
    else:
        driver_id = driver["id"]

    # Demo parent
    parent = await db.users.find_one({"email": "priya@tripzen.com"})
    if not parent:
        parent_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": parent_id,
            "email": "priya@tripzen.com",
            "full_name": "Priya Sharma",
            "role": "parent",
            "phone": "+447700900222",
            "password_hash": hash_password("parent123"),
            "created_at": now_iso(),
        })
    else:
        parent_id = parent["id"]

    # Demo route (London coordinates)
    route = await db.routes.find_one({"name": "Route 3 - Morning"})
    if not route:
        route_id = str(uuid.uuid4())
        stops = [
            {"id": str(uuid.uuid4()), "name": "Green Street Stop", "address": "Green Street, London", "lat": 51.5174, "lng": -0.1378, "order": 0, "eta": "07:30 AM"},
            {"id": str(uuid.uuid4()), "name": "Park Avenue", "address": "Park Avenue, London", "lat": 51.5200, "lng": -0.1300, "order": 1, "eta": "07:38 AM"},
            {"id": str(uuid.uuid4()), "name": "School Road", "address": "School Road, London", "lat": 51.5230, "lng": -0.1220, "order": 2, "eta": "07:50 AM"},
            {"id": str(uuid.uuid4()), "name": "Greenfield School", "address": "Greenfield School, London", "lat": 51.5260, "lng": -0.1150, "order": 3, "eta": "08:05 AM"},
        ]
        await db.routes.insert_one({
            "id": route_id,
            "name": "Route 3 - Morning",
            "driver_id": driver_id,
            "bus_number": "Bus 3",
            "stops": stops,
            "shift": "morning",
            "student_count": 0,
            "created_at": now_iso(),
        })
    else:
        route_id = route["id"]

    # Demo route 2 - afternoon
    if not await db.routes.find_one({"name": "Route 3 - Afternoon"}):
        await db.routes.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Route 3 - Afternoon",
            "driver_id": driver_id,
            "bus_number": "Bus 3",
            "stops": [
                {"id": str(uuid.uuid4()), "name": "Greenfield School", "address": "Greenfield School, London", "lat": 51.5260, "lng": -0.1150, "order": 0, "eta": "03:30 PM"},
                {"id": str(uuid.uuid4()), "name": "School Road", "address": "School Road, London", "lat": 51.5230, "lng": -0.1220, "order": 1, "eta": "03:45 PM"},
                {"id": str(uuid.uuid4()), "name": "Park Avenue", "address": "Park Avenue, London", "lat": 51.5200, "lng": -0.1300, "order": 2, "eta": "04:00 PM"},
                {"id": str(uuid.uuid4()), "name": "Green Street Stop", "address": "Green Street, London", "lat": 51.5174, "lng": -0.1378, "order": 3, "eta": "04:15 PM"},
            ],
            "shift": "afternoon",
            "student_count": 0,
            "created_at": now_iso(),
        })

    # Demo student
    student = await db.students.find_one({"name": "Aarav Sharma"})
    if not student:
        sid = str(uuid.uuid4())
        await db.students.insert_one({
            "id": sid,
            "parent_id": parent_id,
            "name": "Aarav Sharma",
            "grade": "Year 4",
            "school": "Greenfield School",
            "avatar_url": "https://images.unsplash.com/photo-1693639257331-0bad8ac3913f?crop=entropy&cs=srgb&fm=jpg&q=85&w=200",
            "route_id": route_id,
            "qr_code": f"TRIPZEN-{sid[:8].upper()}",
            "created_at": now_iso(),
        })
        await db.routes.update_one({"id": route_id}, {"$inc": {"student_count": 1}})

    # Sample admin alerts
    if await db.alerts.count_documents({}) == 0:
        await db.alerts.insert_many([
            {"id": str(uuid.uuid4()), "type": "delay", "title": "Bus 3 delay", "message": "Running 7 minutes late", "severity": "warning", "created_at": now_iso(), "related_trip_id": None},
            {"id": str(uuid.uuid4()), "type": "checkout", "title": "Student not checked out", "message": "Riya - 08:02 AM", "severity": "warning", "created_at": now_iso(), "related_trip_id": None},
            {"id": str(uuid.uuid4()), "type": "deviation", "title": "Route deviation", "message": "Bus 5 - 08:10 AM", "severity": "info", "created_at": now_iso(), "related_trip_id": None},
        ])

    logger.info("Seed complete")


# ----- App setup -----
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed_data()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
