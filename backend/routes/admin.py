"""Admin: stats, users CRUD, revenue, alerts, incidents, CSV import."""
import io
import csv
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from core.db import db
from core.models import UserCreate
from core.security import require_roles, hash_password, now_iso, now_utc
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
