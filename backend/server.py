"""TripZen Backend - Child Transport Safety Platform"""
import os
import uuid
import logging
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----- Config -----
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "tripzen_db")
JWT_SECRET = os.environ.get("JWT_SECRET", "tripzen-supersecret-change-in-prod")
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
    doc = {
        "id": bid,
        "parent_id": user["id"],
        "student_id": body.student_id,
        "route_id": body.route_id,
        "plan": body.plan,
        "amount": PRICE_MAP.get(body.plan, 89.99),
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


# ----- Health -----
@api.get("/")
async def root():
    return {"app": "TripZen", "status": "ok"}


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
