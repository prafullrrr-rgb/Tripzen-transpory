"""Parent-only routes: GDPR export/delete, AI weekly summary, ratings."""
import uuid
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import RatingCreate
from core.security import get_current_user, require_roles, now_iso, now_utc
from core.config import EMERGENT_LLM_KEY

logger = logging.getLogger("tripzen.parent")
router = APIRouter(tags=["parent"])


@router.get("/parent/gdpr-export")
async def gdpr_export(user: dict = Depends(require_roles("parent"))):
    students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
    bookings = await db.bookings.find({"parent_id": user["id"]}, {"_id": 0}).to_list(500)
    notifications = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    messages = await db.messages.find(
        {"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}, {"_id": 0}
    ).to_list(500)
    ratings = await db.ratings.find({"parent_id": user["id"]}, {"_id": 0}).to_list(500)
    return {
        "exported_at": now_iso(),
        "user": {k: user.get(k) for k in ["id", "email", "full_name", "role", "phone"]},
        "children": students,
        "bookings": bookings,
        "notifications": notifications,
        "messages": messages,
        "ratings": ratings,
    }


@router.delete("/parent/account")
async def gdpr_delete_account(user: dict = Depends(require_roles("parent"))):
    students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
    for s in students:
        if s.get("route_id"):
            await db.routes.update_one({"id": s["route_id"]}, {"$inc": {"student_count": -1}})
    await db.students.delete_many({"parent_id": user["id"]})
    await db.bookings.delete_many({"parent_id": user["id"]})
    await db.notifications.delete_many({"user_id": user["id"]})
    await db.messages.delete_many({"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]})
    await db.ratings.delete_many({"parent_id": user["id"]})
    await db.users.delete_one({"id": user["id"]})
    return {"ok": True, "deleted_at": now_iso()}


@router.get("/parent/weekly-summary/{student_id}")
async def weekly_summary(student_id: str, user: dict = Depends(require_roles("parent"))):
    student = await db.students.find_one({"id": student_id, "parent_id": user["id"]}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")
    week_ago = (now_utc() - timedelta(days=7)).isoformat()
    notifs = await db.notifications.find(
        {"user_id": user["id"], "student_id": student_id, "created_at": {"$gte": week_ago}},
        {"_id": 0},
    ).to_list(200)
    if not notifs:
        return {
            "summary": f"No trips recorded for {student['name']} in the past week.",
            "count": 0,
            "ai_generated": False,
        }
    events = [f"{n['created_at'][:10]} {n['type']}: {n['title']}" for n in notifs[:50]]
    if not EMERGENT_LLM_KEY:
        return {
            "summary": f"{student['name']} had {len(notifs)} events this week, including boardings, arrivals and updates.",
            "count": len(notifs),
            "ai_generated": False,
        }
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"weekly-{student_id}",
            system_message=(
                "You are TripZen, a friendly child-transport assistant. Generate a warm, reassuring "
                "weekly summary for a parent about their child's school bus trips. Keep it to 3-4 short "
                "sentences. Mention any delays or issues honestly but reassuringly. End on a positive note."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"Child: {student['name']} ({student.get('grade','')}, {student.get('school','')})\n"
            f"Events this week:\n" + "\n".join(events) +
            "\n\nWrite the parent summary now."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        return {"summary": response.strip(), "count": len(notifs), "ai_generated": True}
    except Exception as e:
        logger.exception("weekly-summary LLM failed: %s", e)
        return {
            "summary": f"{student['name']} had {len(notifs)} events this week.",
            "count": len(notifs),
            "ai_generated": False,
            "error": str(e)[:200],
        }


@router.post("/ratings")
async def create_rating(body: RatingCreate, user: dict = Depends(require_roles("parent"))):
    trip = await db.trips.find_one({"id": body.trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    children = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
    child_ids = {c["id"] for c in children}
    if not (set(trip.get("boarded_student_ids", [])) & child_ids):
        raise HTTPException(403, "Your child was not on this trip")
    rid = str(uuid.uuid4())
    doc = {
        "id": rid,
        "trip_id": body.trip_id,
        "driver_id": trip["driver_id"],
        "parent_id": user["id"],
        "stars": body.stars,
        "feedback": body.feedback,
        "created_at": now_iso(),
    }
    await db.ratings.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/ratings/driver/{driver_id}")
async def driver_ratings(driver_id: str, user: dict = Depends(get_current_user)):
    cursor = db.ratings.find({"driver_id": driver_id}, {"_id": 0}).sort("created_at", -1)
    ratings = await cursor.to_list(100)
    if not ratings:
        return {"average": 0, "count": 0, "ratings": []}
    avg = sum(r["stars"] for r in ratings) / len(ratings)
    return {"average": round(avg, 2), "count": len(ratings), "ratings": ratings}
