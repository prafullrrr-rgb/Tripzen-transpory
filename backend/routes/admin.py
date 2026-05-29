"""Admin: stats, users CRUD, revenue, alerts, incidents, CSV import, broadcasts, QR PDFs."""
import io
import csv
import uuid
import base64
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.db import db
from core.models import UserCreate
from core.security import require_roles, hash_password, now_iso, now_utc
from services.notifications import create_notification
from .students import _get_first_parent_id

router = APIRouter(tags=["admin"])


@router.get("/admin/stats")
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
    return {
        "total_routes": total_routes,
        "total_students": total_students,
        "active_buses": active_trips,
        "on_time_percent": 92,
        "completed_today": completed_today,
        "total_drivers": total_drivers,
        "total_parents": total_parents,
    }


@router.get("/admin/alerts")
async def admin_alerts(user: dict = Depends(require_roles("admin"))):
    cursor = db.alerts.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(50)


@router.get("/admin/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0})
    return await cursor.to_list(1000)


@router.post("/admin/users")
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
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}


@router.delete("/admin/users/{uid}")
async def delete_user_admin(uid: str, user: dict = Depends(require_roles("admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    res = await db.users.delete_one({"id": uid})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@router.get("/admin/revenue")
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


@router.get("/admin/incidents")
async def list_incidents(user: dict = Depends(require_roles("admin"))):
    cursor = db.incidents.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(100)


@router.post("/admin/students/import")
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


# ---------- Broadcast Templates ----------
BROADCAST_TEMPLATES = {
    "snow_day": {
        "id": "snow_day",
        "title": "❄️ Snow Day — Service Cancelled",
        "body": "Due to severe weather, all school bus services are cancelled today. Please make alternative arrangements. Stay safe!",
        "icon": "snow",
    },
    "strike_day": {
        "id": "strike_day",
        "title": "⚠️ Strike Action — Limited Service",
        "body": "Due to industrial action, bus services may be delayed or cancelled today. We'll update you with the latest information.",
        "icon": "warning",
    },
    "early_close": {
        "id": "early_close",
        "title": "🕐 Early School Closure",
        "body": "School is closing early today. Pickup time has been adjusted. Please check your trip details for the new time.",
        "icon": "time",
    },
    "holiday_reminder": {
        "id": "holiday_reminder",
        "title": "🎒 Half-Term Holiday Tomorrow",
        "body": "No school bus tomorrow due to half-term break. Service resumes after the holiday.",
        "icon": "calendar",
    },
    "route_change": {
        "id": "route_change",
        "title": "🚌 Route Change Today",
        "body": "Your child's bus route has been updated due to roadworks. Please check the app for new pickup times.",
        "icon": "git-branch",
    },
    "delay": {
        "id": "delay",
        "title": "⏰ Bus Delayed",
        "body": "Today's bus is running approximately 15 minutes late due to traffic. Sorry for any inconvenience.",
        "icon": "hourglass",
    },
}


@router.get("/admin/broadcast/templates")
async def list_broadcast_templates(user: dict = Depends(require_roles("admin"))):
    return {"templates": list(BROADCAST_TEMPLATES.values())}


class BroadcastBody(BaseModel):
    template_id: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    icon: Optional[str] = "megaphone"
    route_id: Optional[str] = None  # if set, only parents of students on that route


@router.post("/admin/broadcast")
async def send_broadcast(body: BroadcastBody, user: dict = Depends(require_roles("admin"))):
    """Send a broadcast notification to all parents (or filtered by route)."""
    if body.template_id and body.template_id in BROADCAST_TEMPLATES:
        tpl = BROADCAST_TEMPLATES[body.template_id]
        title, content, icon = tpl["title"], tpl["body"], tpl["icon"]
    else:
        if not body.title or not body.body:
            raise HTTPException(400, "Either template_id or both title+body required")
        title, content, icon = body.title, body.body, body.icon or "megaphone"
    # Filter parents
    if body.route_id:
        students = await db.students.find({"route_id": body.route_id}, {"_id": 0, "parent_id": 1, "id": 1}).to_list(500)
        parent_ids = list({s["parent_id"] for s in students if s.get("parent_id")})
    else:
        parents = await db.users.find({"role": "parent"}, {"_id": 0, "id": 1}).to_list(2000)
        parent_ids = [p["id"] for p in parents]
    sent = 0
    for pid in parent_ids:
        try:
            await create_notification(pid, None, "broadcast", title, content, icon=icon)
            sent += 1
        except Exception:
            pass
    return {"ok": True, "sent": sent, "title": title}


# ---------- QR Badge PDF / Print ----------
@router.get("/admin/students/{student_id}/qr-card")
async def student_qr_card(student_id: str, user: dict = Depends(require_roles("admin"))):
    """Return a single student's printable QR badge data (frontend renders as PDF/print)."""
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")
    route = await db.routes.find_one({"id": student.get("route_id")}, {"_id": 0}) if student.get("route_id") else None
    parent = await db.users.find_one({"id": student.get("parent_id")}, {"_id": 0, "password_hash": 0})
    return {
        "student_id": student["id"],
        "student_name": student.get("name"),
        "grade": student.get("grade"),
        "school": student.get("school"),
        "qr_code": student.get("qr_code"),
        "route_name": route.get("name") if route else "Unassigned",
        "parent_name": parent.get("full_name") if parent else "",
        "parent_phone": parent.get("phone") if parent else "",
        "issued_date": now_iso(),
    }


@router.get("/admin/students/qr-bulk")
async def students_qr_bulk(route_id: Optional[str] = None, user: dict = Depends(require_roles("admin"))):
    """Return all students' QR badge data for bulk printing (filter by route optionally)."""
    query = {}
    if route_id:
        query["route_id"] = route_id
    students = await db.students.find(query, {"_id": 0}).to_list(500)
    cards = []
    for s in students:
        route = await db.routes.find_one({"id": s.get("route_id")}, {"_id": 0}) if s.get("route_id") else None
        cards.append({
            "student_id": s["id"],
            "student_name": s.get("name"),
            "grade": s.get("grade"),
            "school": s.get("school"),
            "qr_code": s.get("qr_code"),
            "route_name": route.get("name") if route else "Unassigned",
        })
    return {"cards": cards, "count": len(cards)}
