"""Bookings + mock pay + Stripe PaymentIntent + confirm."""
import uuid
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import BookingCreate
from core.security import get_current_user, require_roles, now_iso
from core.config import STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY

logger = logging.getLogger("tripzen.bookings")
router = APIRouter(tags=["bookings"])

PRICE_MAP = {"monthly": 89.99, "single": 4.50}


@router.post("/bookings")
async def create_booking(body: BookingCreate, user: dict = Depends(require_roles("parent"))):
    bid = str(uuid.uuid4())
    base = PRICE_MAP.get(body.plan, 89.99)
    existing_paid = await db.bookings.count_documents({
        "parent_id": user["id"], "status": "paid", "plan": "monthly",
    })
    discount = 0.0
    if body.plan == "monthly" and existing_paid >= 1:
        discount = round(base * 0.20, 2)
    amount = round(base - discount, 2)
    doc = {
        "id": bid,
        "parent_id": user["id"],
        "student_id": body.student_id,
        "route_id": body.route_id,
        "plan": body.plan,
        "amount": amount,
        "base_amount": base,
        "discount": discount,
        "currency": "GBP",
        "status": "pending",
        "created_at": now_iso(),
        "paid_at": None,
        "payment_ref": None,
    }
    await db.bookings.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/bookings")
async def list_bookings(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"parent_id": user["id"]}
    cursor = db.bookings.find(query, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@router.post("/bookings/{bid}/pay")
async def pay_booking(bid: str, user: dict = Depends(require_roles("parent"))):
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    payment_ref = f"pi_test_{uuid.uuid4().hex[:16]}"
    await db.bookings.update_one(
        {"id": bid},
        {"$set": {"status": "paid", "paid_at": now_iso(), "payment_ref": payment_ref}},
    )
    return {"ok": True, "payment_ref": payment_ref, "amount": booking["amount"]}


@router.post("/bookings/{bid}/payment-intent")
async def create_payment_intent(bid: str, user: dict = Depends(require_roles("parent"))):
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["status"] == "paid":
        raise HTTPException(400, "Already paid")
    amount_pence = int(round(booking["amount"] * 100))
    if not STRIPE_SECRET_KEY:
        return {
            "client_secret": f"pi_mock_{uuid.uuid4().hex[:16]}_secret_mock",
            "publishable_key": STRIPE_PUBLISHABLE_KEY,
            "amount": booking["amount"],
            "currency": booking["currency"].lower(),
            "mocked": True,
        }
    try:
        async with httpx.AsyncClient(timeout=15) as client_h:
            res = await client_h.post(
                "https://api.stripe.com/v1/payment_intents",
                data={
                    "amount": amount_pence,
                    "currency": booking["currency"].lower(),
                    "metadata[booking_id]": bid,
                    "metadata[parent_id]": user["id"],
                    "automatic_payment_methods[enabled]": "true",
                },
                auth=(STRIPE_SECRET_KEY, ""),
            )
            data = res.json()
            if res.status_code >= 400:
                raise HTTPException(502, data.get("error", {}).get("message", "Stripe error"))
            await db.bookings.update_one({"id": bid}, {"$set": {"payment_intent_id": data["id"]}})
            return {
                "client_secret": data["client_secret"],
                "publishable_key": STRIPE_PUBLISHABLE_KEY,
                "amount": booking["amount"],
                "currency": booking["currency"].lower(),
                "mocked": False,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Stripe PI failed")
        raise HTTPException(500, str(e)[:200])


@router.post("/bookings/{bid}/confirm-payment")
async def confirm_payment(bid: str, user: dict = Depends(require_roles("parent"))):
    booking = await db.bookings.find_one({"id": bid, "parent_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    pi_id = booking.get("payment_intent_id")
    if STRIPE_SECRET_KEY and pi_id and not pi_id.startswith("pi_mock"):
        try:
            async with httpx.AsyncClient(timeout=10) as client_h:
                r = await client_h.get(
                    f"https://api.stripe.com/v1/payment_intents/{pi_id}",
                    auth=(STRIPE_SECRET_KEY, ""),
                )
                data = r.json()
                if data.get("status") != "succeeded":
                    raise HTTPException(400, f"Payment not completed: {data.get('status')}")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Stripe verify failed: %s", e)
    await db.bookings.update_one(
        {"id": bid},
        {"$set": {"status": "paid", "paid_at": now_iso(), "payment_ref": pi_id or f"pi_test_{uuid.uuid4().hex[:16]}"}},
    )
    return {"ok": True, "amount": booking["amount"]}
