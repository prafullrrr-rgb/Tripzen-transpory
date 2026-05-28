"""SaaS subscriptions for schools and bus operators."""
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db
from core.security import get_current_user, require_roles, now_iso, now_utc

logger = logging.getLogger("tripzen.subscriptions")
router = APIRouter(tags=["subscriptions"])


# ----- Pricing catalog (single source of truth) -----
PLANS = {
    # School plans
    "school_starter": {
        "id": "school_starter", "name": "Starter", "track": "school",
        "price_monthly": 199.00, "price_annual": 1990.00,
        "max_students": 100, "max_buses": 5, "currency": "GBP",
        "features": ["live_tracking", "qr_boarding", "push", "chat", "incidents"],
        "highlight": False,
    },
    "school_growth": {
        "id": "school_growth", "name": "Growth", "track": "school",
        "price_monthly": 499.00, "price_annual": 4790.00,
        "max_students": 500, "max_buses": 25, "currency": "GBP",
        "features": ["live_tracking", "qr_boarding", "push", "chat", "incidents",
                     "multi_language", "csv_import", "broadcast", "revenue_dash", "ai_summaries"],
        "highlight": True,  # "Most Popular"
    },
    "school_enterprise": {
        "id": "school_enterprise", "name": "Enterprise", "track": "school",
        "price_monthly": 1499.00, "price_annual": 14390.00,
        "max_students": -1, "max_buses": -1, "currency": "GBP",
        "features": ["live_tracking", "qr_boarding", "push", "chat", "incidents",
                     "multi_language", "csv_import", "broadcast", "revenue_dash", "ai_summaries",
                     "custom_branding", "sso", "api_access", "priority_support"],
        "highlight": False,
    },
    # Bus operator plans
    "fleet_solo": {
        "id": "fleet_solo", "name": "Solo Operator", "track": "operator",
        "price_monthly": 49.00, "price_annual": 490.00,
        "max_buses": 1, "currency": "GBP",
        "features": ["live_tracking", "qr_boarding", "push", "chat", "incidents"],
        "highlight": False,
    },
    "fleet_growth": {
        "id": "fleet_growth", "name": "Fleet", "track": "operator",
        "price_monthly": 39.00, "per_bus": True, "min_buses": 5,
        "price_annual": None,  # billed per bus
        "max_buses": -1, "currency": "GBP",
        "features": ["live_tracking", "qr_boarding", "push", "chat", "incidents",
                     "multi_language", "vehicle_logs"],
        "highlight": True,
    },
    "fleet_enterprise": {
        "id": "fleet_enterprise", "name": "Enterprise Fleet", "track": "operator",
        "price_monthly": 999.00, "price_annual": 9590.00,
        "max_buses": -1, "currency": "GBP",
        "features": ["live_tracking", "qr_boarding", "push", "chat", "incidents",
                     "multi_language", "vehicle_logs", "custom_branding", "api_access", "priority_support"],
        "highlight": False,
    },
    # Direct-to-parent (legacy / fallback)
    "parent_monthly": {
        "id": "parent_monthly", "name": "Family Monthly", "track": "parent",
        "price_monthly": 8.99, "price_annual": 89.99,
        "max_children": 4, "currency": "GBP",
        "features": ["live_tracking", "push", "chat"],
        "highlight": False,
    },
}

FREE_TRIAL_DAYS = 30


# ----- Models -----
class CreateSubscription(BaseModel):
    plan_id: str
    billing_cycle: str = "monthly"  # "monthly" or "annual"
    org_name: Optional[str] = None  # school name or operator name
    bus_count: Optional[int] = 1  # for per-bus plans (fleet_growth)


class ChangePlan(BaseModel):
    new_plan_id: str
    billing_cycle: str = "monthly"


# ----- Public plans listing -----
@router.get("/plans")
async def list_plans(track: Optional[str] = None):
    """Public endpoint — list all pricing plans (optionally filter by track)."""
    plans = list(PLANS.values())
    if track:
        plans = [p for p in plans if p["track"] == track]
    return {"plans": plans, "trial_days": FREE_TRIAL_DAYS, "currency": "GBP"}


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str):
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    return plan


# ----- Subscription CRUD -----
@router.post("/subscriptions")
async def create_subscription(body: CreateSubscription, user: dict = Depends(require_roles("admin"))):
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, "Invalid plan_id")
    if body.billing_cycle not in ("monthly", "annual"):
        raise HTTPException(400, "billing_cycle must be monthly or annual")
    existing = await db.subscriptions.find_one(
        {"org_id": user["id"], "status": {"$in": ["trial", "active"]}}, {"_id": 0}
    )
    if existing:
        raise HTTPException(400, "Organization already has an active subscription. Use /upgrade instead.")
    # Calculate price
    if plan.get("per_bus"):
        bus_count = max(plan.get("min_buses", 1), body.bus_count or 1)
        amount = plan["price_monthly"] * bus_count
    else:
        amount = plan["price_annual"] if body.billing_cycle == "annual" else plan["price_monthly"]
    trial_end = (now_utc() + timedelta(days=FREE_TRIAL_DAYS)).isoformat()
    next_billing = (now_utc() + timedelta(days=FREE_TRIAL_DAYS + (365 if body.billing_cycle == "annual" else 30))).isoformat()
    sub_id = str(uuid.uuid4())
    sub = {
        "id": sub_id,
        "org_id": user["id"],
        "org_name": body.org_name or user.get("full_name", "Organization"),
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "track": plan["track"],
        "billing_cycle": body.billing_cycle,
        "amount": round(amount, 2),
        "currency": plan["currency"],
        "bus_count": body.bus_count if plan.get("per_bus") else None,
        "status": "trial",  # trial → active → past_due → cancelled
        "trial_end": trial_end,
        "current_period_end": next_billing,
        "created_at": now_iso(),
        "cancelled_at": None,
        "features": plan["features"],
    }
    await db.subscriptions.insert_one(sub)
    return {k: v for k, v in sub.items() if k != "_id"}


@router.get("/subscriptions/me")
async def my_subscription(user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"org_id": user["id"]}, {"_id": 0})
    if not sub:
        return {"subscription": None, "trial_available": True, "trial_days": FREE_TRIAL_DAYS}
    return {"subscription": sub, "trial_available": False}


@router.post("/subscriptions/{sub_id}/upgrade")
async def upgrade_plan(sub_id: str, body: ChangePlan, user: dict = Depends(require_roles("admin"))):
    sub = await db.subscriptions.find_one({"id": sub_id, "org_id": user["id"]}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    new_plan = PLANS.get(body.new_plan_id)
    if not new_plan:
        raise HTTPException(400, "Invalid plan")
    if new_plan.get("per_bus"):
        amount = new_plan["price_monthly"] * (sub.get("bus_count") or new_plan.get("min_buses", 1))
    else:
        amount = new_plan["price_annual"] if body.billing_cycle == "annual" else new_plan["price_monthly"]
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {
        "plan_id": new_plan["id"],
        "plan_name": new_plan["name"],
        "track": new_plan["track"],
        "billing_cycle": body.billing_cycle,
        "amount": round(amount, 2),
        "features": new_plan["features"],
        "updated_at": now_iso(),
    }})
    return {"ok": True, "new_plan": new_plan["name"], "amount": round(amount, 2)}


@router.post("/subscriptions/{sub_id}/cancel")
async def cancel_subscription(sub_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.subscriptions.update_one(
        {"id": sub_id, "org_id": user["id"]},
        {"$set": {"status": "cancelled", "cancelled_at": now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Subscription not found")
    return {"ok": True}


@router.post("/subscriptions/{sub_id}/activate")
async def activate_subscription(sub_id: str, user: dict = Depends(require_roles("admin"))):
    """Mark trial as paid/active (would be triggered by Stripe webhook in production)."""
    res = await db.subscriptions.update_one(
        {"id": sub_id, "org_id": user["id"]},
        {"$set": {"status": "active", "activated_at": now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Subscription not found")
    return {"ok": True, "status": "active"}
