"""Universal account routes.

Provides an in-app account deletion endpoint that works for any role
(parent, driver, admin). Required by Apple App Store guideline 5.1.1(v).
"""
import logging

from fastapi import APIRouter, Depends

from core.db import db
from core.security import get_current_user, now_iso

logger = logging.getLogger("tripzen.account")
router = APIRouter(tags=["account"])


@router.delete("/account")
async def delete_my_account(user: dict = Depends(get_current_user)):
    """Permanently delete the current authenticated user's account and all
    associated personal data. Works for parent, driver, and admin roles.

    This is irreversible — the user record and all linked records are wiped.
    Required for App Store Review Guideline 5.1.1(v).
    """
    uid = user["id"]
    role = user.get("role", "")
    summary: dict = {"role": role}

    # ---- Parent-specific cascade ----
    if role == "parent":
        students = await db.students.find({"parent_id": uid}, {"_id": 0}).to_list(200)
        for s in students:
            if s.get("route_id"):
                await db.routes.update_one(
                    {"id": s["route_id"]}, {"$inc": {"student_count": -1}}
                )
        r1 = await db.students.delete_many({"parent_id": uid})
        r2 = await db.bookings.delete_many({"parent_id": uid})
        r3 = await db.ratings.delete_many({"parent_id": uid})
        summary.update(
            {"children": r1.deleted_count, "bookings": r2.deleted_count, "ratings": r3.deleted_count}
        )

    # ---- Driver-specific cascade ----
    if role == "driver":
        # Unassign driver from any routes / trips, keep history anonymous
        await db.routes.update_many({"driver_id": uid}, {"$set": {"driver_id": None}})
        await db.trips.update_many({"driver_id": uid}, {"$set": {"driver_id": None}})
        await db.incidents.update_many(
            {"reporter_id": uid}, {"$set": {"reporter_id": None}}
        )
        summary["unassigned_routes_trips"] = True

    # ---- Admin-specific cascade ----
    if role == "admin":
        # Admin broadcasts / audit logs are kept for compliance but anonymised
        await db.broadcasts.update_many({"sender_id": uid}, {"$set": {"sender_id": None}})
        summary["anonymised_broadcasts"] = True

    # ---- Common: wipe personal data for any role ----
    n_notif = await db.notifications.delete_many({"user_id": uid})
    n_msg = await db.messages.delete_many(
        {"$or": [{"from_id": uid}, {"to_id": uid}]}
    )
    n_dev = await db.devices.delete_many({"user_id": uid})
    n_pref = await db.notification_prefs.delete_many({"user_id": uid})
    summary.update(
        {
            "notifications": n_notif.deleted_count,
            "messages": n_msg.deleted_count,
            "devices": n_dev.deleted_count,
            "notification_prefs": n_pref.deleted_count,
        }
    )

    # ---- Finally: delete the user record itself ----
    res = await db.users.delete_one({"id": uid})
    summary["user_deleted"] = res.deleted_count == 1

    logger.info("Account deletion for user=%s role=%s summary=%s", uid, role, summary)

    return {
        "ok": True,
        "deleted_at": now_iso(),
        "summary": summary,
    }
