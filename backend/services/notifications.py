"""In-app notifications + Expo push helpers."""
import uuid
import logging
from typing import List, Optional

import httpx

from core.db import db
from core.security import now_iso

logger = logging.getLogger("tripzen.notifications")


async def create_notification(
    user_id: str,
    student_id: Optional[str],
    ntype: str,
    title: str,
    message: str,
    icon: Optional[str] = None,
):
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


async def send_expo_push(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
):
    valid = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid:
        return {"sent": 0, "reason": "no_valid_tokens"}
    messages = [
        {"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"}
        for t in valid
    ]
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


async def notify_user_full(
    user_id: str,
    title: str,
    body: str,
    ntype: str = "alert",
    student_id: Optional[str] = None,
    icon: Optional[str] = None,
    data: Optional[dict] = None,
):
    """Create in-app notification + send Expo push (if token present)."""
    await create_notification(user_id, student_id, ntype, title, body, icon)
    user_doc = await db.users.find_one({"id": user_id}, {"push_token": 1, "_id": 0})
    if user_doc and user_doc.get("push_token"):
        await send_expo_push([user_doc["push_token"]], title, body, data)
