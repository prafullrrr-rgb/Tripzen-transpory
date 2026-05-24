"""Bus route CRUD (admin manages, driver views)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import RouteCreate
from core.security import get_current_user, require_roles, now_iso

router = APIRouter(tags=["routes"])


@router.get("/routes")
async def list_routes(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "driver":
        query = {"driver_id": user["id"]}
    cursor = db.routes.find(query, {"_id": 0})
    return await cursor.to_list(1000)


@router.post("/routes")
async def create_route(body: RouteCreate, user: dict = Depends(require_roles("admin"))):
    rid = str(uuid.uuid4())
    doc = body.dict()
    doc["id"] = rid
    doc["student_count"] = 0
    doc["created_at"] = now_iso()
    await db.routes.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/routes/{route_id}")
async def get_route(route_id: str, user: dict = Depends(get_current_user)):
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(404, "Route not found")
    return route


@router.put("/routes/{route_id}")
async def update_route(route_id: str, body: RouteCreate, user: dict = Depends(require_roles("admin"))):
    upd = body.dict(exclude_unset=True)
    res = await db.routes.update_one({"id": route_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Route not found")
    return await db.routes.find_one({"id": route_id}, {"_id": 0})


@router.delete("/routes/{route_id}")
async def delete_route(route_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.routes.delete_one({"id": route_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Route not found")
    await db.students.update_many({"route_id": route_id}, {"$set": {"route_id": None}})
    return {"ok": True}
