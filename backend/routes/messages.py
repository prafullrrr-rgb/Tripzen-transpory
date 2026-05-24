"""Parent <-> Driver chat."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import MessageCreate
from core.security import get_current_user, now_iso

router = APIRouter(tags=["messages"])


@router.post("/messages")
async def send_message(body: MessageCreate, user: dict = Depends(get_current_user)):
    recipient = await db.users.find_one({"id": body.recipient_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(404, "Recipient not found")
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


@router.get("/messages/{other_id}")
async def get_messages(other_id: str, user: dict = Depends(get_current_user)):
    cursor = db.messages.find(
        {"$or": [
            {"from_id": user["id"], "to_id": other_id},
            {"from_id": other_id, "to_id": user["id"]},
        ]},
        {"_id": 0},
    ).sort("created_at", 1)
    msgs = await cursor.to_list(500)
    await db.messages.update_many(
        {"from_id": other_id, "to_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return msgs


@router.get("/messages")
async def list_threads(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$cond": [{"$eq": ["$from_id", user["id"]]}, "$to_id", "$from_id"]},
            "last_text": {"$first": "$text"},
            "last_at": {"$first": "$created_at"},
            "unread": {"$sum": {"$cond": [
                {"$and": [{"$eq": ["$to_id", user["id"]]}, {"$eq": ["$read", False]}]}, 1, 0,
            ]}},
        }},
    ]
    threads = await db.messages.aggregate(pipeline).to_list(100)
    for t in threads:
        u = await db.users.find_one({"id": t["_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            t["user"] = u
        t["other_id"] = t.pop("_id")
    return threads
