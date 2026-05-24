"""Support contact resolution for the in-app chat."""
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import get_current_user

router = APIRouter(tags=["support"])


@router.get("/support/contact")
async def support_contact(user: dict = Depends(get_current_user)):
    """Returns the support agent (first admin) the current user can chat with.

    Parents/Drivers can use this to find the admin to message. Admin gets nothing
    (they ARE support).
    """
    if user["role"] == "admin":
        # No upward escalation — admin is support.
        return {"contact": None, "reason": "you_are_support"}
    admin = await db.users.find_one(
        {"role": "admin"}, {"_id": 0, "password_hash": 0}
    )
    if not admin:
        raise HTTPException(404, "Support agent not configured")
    return {
        "contact": {
            "id": admin["id"],
            "full_name": admin["full_name"],
            "email": admin["email"],
            "role": admin["role"],
        }
    }
