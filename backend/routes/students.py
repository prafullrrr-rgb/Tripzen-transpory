"""Students CRUD routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import StudentCreate
from core.security import get_current_user, now_iso

router = APIRouter(tags=["students"])


async def _get_first_parent_id() -> str:
    p = await db.users.find_one({"role": "parent"})
    return p["id"] if p else "unknown"


@router.get("/students")
async def list_students(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"parent_id": user["id"]}
    cursor = db.students.find(query, {"_id": 0})
    return await cursor.to_list(1000)


@router.post("/students")
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


@router.put("/students/{sid}")
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


@router.delete("/students/{sid}")
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
