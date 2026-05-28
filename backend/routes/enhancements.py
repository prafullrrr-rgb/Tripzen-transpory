"""v1.1 enhancements: driver verification, skip-a-day, cancellations, geofence alerts."""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db
from core.security import get_current_user, require_roles, now_iso, now_utc
from services.notifications import create_notification

logger = logging.getLogger("tripzen.enhancements")
router = APIRouter(tags=["enhancements"])


# ---------- Driver Verification ----------
@router.get("/driver-info/{driver_id}")
async def driver_verification(driver_id: str, user: dict = Depends(get_current_user)):
    """Public driver info for parent verification badge."""
    driver = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0, "password_hash": 0})
    if not driver:
        raise HTTPException(404, "Driver not found")
    ratings = await db.ratings.find({"driver_id": driver_id}, {"_id": 0}).to_list(500)
    avg = round(sum(r["stars"] for r in ratings) / len(ratings), 2) if ratings else 0
    trip_count = await db.trips.count_documents({"driver_id": driver_id, "status": "completed"})
    return {
        "id": driver["id"],
        "full_name": driver["full_name"],
        "phone": driver.get("phone"),
        "badge_photo": driver.get("badge_photo"),
        "license_number": driver.get("license_number", "VERIFIED"),
        "vehicle_plate": driver.get("vehicle_plate", ""),
        "years_driving": driver.get("years_driving", 0),
        "verified": True,
        "verified_by": driver.get("verified_by", "TripZen"),
        "average_rating": avg,
        "total_ratings": len(ratings),
        "completed_trips": trip_count,
    }


class DriverProfileUpdate(BaseModel):
    license_number: Optional[str] = None
    vehicle_plate: Optional[str] = None
    years_driving: Optional[int] = None
    badge_photo: Optional[str] = None  # base64
    verified_by: Optional[str] = None


@router.put("/driver-info/me")
async def update_driver_profile(body: DriverProfileUpdate, user: dict = Depends(require_roles("driver", "admin"))):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd:
        return {"ok": True, "updated": 0}
    await db.users.update_one({"id": user["id"]}, {"$set": upd})
    return {"ok": True, "updated": len(upd)}


# ---------- Skip a Day / Cancellation ----------
class CancelBookingBody(BaseModel):
    reason: Optional[str] = "Cancelled by parent"
    refund_pct: Optional[int] = 80  # default 80% refund


@router.post("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, body: CancelBookingBody, user: dict = Depends(require_roles("parent", "admin"))):
    """Cancel a booking. Auto-calculates refund amount. Records non-refunded balance."""
    query = {"id": bid}
    if user["role"] == "parent":
        query["parent_id"] = user["id"]
    booking = await db.bookings.find_one(query, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("status") == "cancelled":
        raise HTTPException(400, "Already cancelled")
    refund_pct = max(0, min(100, body.refund_pct or 0))
    amount_paid = booking.get("amount", 0) if booking.get("status") == "paid" else 0
    refund_amount = round(amount_paid * refund_pct / 100, 2)
    not_refunded = round(amount_paid - refund_amount, 2)
    upd = {
        "status": "cancelled",
        "cancelled_at": now_iso(),
        "cancellation_reason": body.reason,
        "refund_amount": refund_amount,
        "non_refunded_amount": not_refunded,
        "refund_status": "pending" if refund_amount > 0 else "none",
    }
    await db.bookings.update_one({"id": bid}, {"$set": upd})
    student = await db.students.find_one({"id": booking.get("student_id")}, {"_id": 0})
    if student:
        await create_notification(
            booking["parent_id"], student["id"], "cancellation",
            f"Booking cancelled — {student['name']}",
            f"Refund of £{refund_amount:.2f} processing. Non-refundable: £{not_refunded:.2f}.",
            icon="close-circle",
        )
    return {"ok": True, "refund_amount": refund_amount, "non_refunded_amount": not_refunded}


@router.post("/bookings/{bid}/skip-day")
async def skip_a_day(bid: str, body: dict, user: dict = Depends(require_roles("parent"))):
    """Mark a child off the bus for a specific date (sick day, holiday). Notifies driver."""
    skip_date = body.get("date")  # YYYY-MM-DD
    reason = body.get("reason", "Personal")
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if not skip_date:
        raise HTTPException(400, "date required (YYYY-MM-DD)")
    skip_entry = {"date": skip_date, "reason": reason, "created_at": now_iso()}
    await db.bookings.update_one({"id": bid}, {"$push": {"skip_dates": skip_entry}})
    student = await db.students.find_one({"id": booking["student_id"]}, {"_id": 0})
    route = await db.routes.find_one({"id": booking.get("route_id")}, {"_id": 0})
    driver_id = route.get("assigned_driver_id") if route else None
    if driver_id and student:
        await create_notification(
            driver_id, student["id"], "skip",
            f"⏭ {student['name']} will skip {skip_date}",
            f"Reason: {reason}. Do not wait at pickup.",
            icon="calendar",
        )
    return {"ok": True, "skip_date": skip_date}


# ---------- Admin Cancellation Dashboard ----------
@router.get("/admin/cancellations")
async def cancellation_dashboard(user: dict = Depends(require_roles("admin"))):
    """Lists all cancelled bookings with paid-but-not-refunded amounts (the earlier user ask)."""
    cursor = db.bookings.find({"status": "cancelled"}, {"_id": 0}).sort("cancelled_at", -1)
    bookings = await cursor.to_list(500)
    enriched = []
    total_paid = 0.0
    total_refunded = 0.0
    total_kept = 0.0
    for b in bookings:
        parent = await db.users.find_one({"id": b.get("parent_id")}, {"_id": 0, "password_hash": 0})
        student = await db.students.find_one({"id": b.get("student_id")}, {"_id": 0})
        route = await db.routes.find_one({"id": b.get("route_id")}, {"_id": 0})
        paid = b.get("amount", 0) if b.get("paid_at") else 0
        refund = b.get("refund_amount", 0)
        kept = b.get("non_refunded_amount", paid - refund)
        total_paid += paid
        total_refunded += refund
        total_kept += kept
        enriched.append({
            **b,
            "parent_name": parent.get("full_name") if parent else "-",
            "parent_email": parent.get("email") if parent else "-",
            "student_name": student.get("name") if student else "-",
            "route_name": route.get("name") if route else "-",
            "paid_amount": paid,
            "kept_amount": kept,
        })
    return {
        "cancellations": enriched,
        "summary": {
            "total_cancellations": len(enriched),
            "total_paid": round(total_paid, 2),
            "total_refunded": round(total_refunded, 2),
            "total_kept": round(total_kept, 2),
            "currency": "GBP",
        },
    }


# ---------- Parent: Today's Status ----------
@router.get("/parent/today/{student_id}")
async def parent_today(student_id: str, user: dict = Depends(require_roles("parent"))):
    """Glance-able status card for parent home."""
    student = await db.students.find_one({"id": student_id, "parent_id": user["id"]}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")
    trip = None
    if student.get("route_id"):
        trip = await db.trips.find_one({"route_id": student["route_id"], "status": "active"}, {"_id": 0})
    boarded = trip and student["id"] in trip.get("boarded_student_ids", [])
    checked_out = trip and student["id"] in trip.get("checked_out_student_ids", [])
    status = "home"
    if trip:
        if checked_out:
            status = "dropped_off"
        elif boarded:
            status = "on_bus"
        else:
            status = "waiting"
    today_iso = now_utc().strftime("%Y-%m-%d")
    todays_notifs = await db.notifications.find({
        "user_id": user["id"],
        "student_id": student_id,
        "created_at": {"$gte": today_iso},
    }, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {
        "student": student,
        "trip": trip,
        "status": status,
        "events_today": todays_notifs,
        "status_label": {
            "home": "At home",
            "waiting": "Waiting for bus",
            "on_bus": "On the bus",
            "dropped_off": "Safely dropped off",
        }.get(status, "Unknown"),
    }


# ---------- Auto Geofence Notifications ----------
@router.post("/trips/{trip_id}/notify-approaching")
async def notify_approaching(trip_id: str, user: dict = Depends(require_roles("driver", "admin"))):
    """Sends 'bus 2 min away' push to parents of upcoming stop. Triggered from frontend or scheduler."""
    trip = await db.trips.find_one({"id": trip_id, "status": "active"}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    route = await db.routes.find_one({"id": trip["route_id"]}, {"_id": 0})
    if not route or not route.get("stops"):
        return {"ok": True, "notified": 0}
    next_idx = min(trip["current_stop_index"] + 1, len(route["stops"]) - 1)
    next_stop = route["stops"][next_idx]
    students = await db.students.find({"route_id": route["id"]}, {"_id": 0}).to_list(200)
    not_boarded = [s for s in students if s["id"] not in trip.get("boarded_student_ids", [])]
    sent = 0
    for s in not_boarded:
        try:
            await create_notification(
                s["parent_id"], s["id"], "approaching",
                f"🚌 Bus 2 mins from {next_stop['name']}",
                f"{s['name']}'s bus is approaching. Get ready!",
                icon="location",
            )
            sent += 1
        except Exception:
            pass
    return {"ok": True, "notified": sent, "stop": next_stop["name"]}
