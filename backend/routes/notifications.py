"""Notifications listing and read marking."""
from fastapi import APIRouter, Depends

from core.db import db
from core.security import get_current_user

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@router.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}
