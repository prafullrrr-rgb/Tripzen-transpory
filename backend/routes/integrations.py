"""Push tokens, WhatsApp (Twilio), health check, root."""
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import PushTokenIn, WhatsAppIn
from core.security import get_current_user, now_iso
from core.config import TWILIO_SID, TWILIO_TOKEN, TWILIO_WA_FROM

logger = logging.getLogger("tripzen.integrations")
router = APIRouter(tags=["integrations"])


@router.get("/")
async def root():
    return {"app": "TripZen", "status": "ok"}


@router.post("/users/push-token")
async def save_push_token(body: PushTokenIn, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "push_token": body.token,
            "push_platform": body.platform,
            "push_updated_at": now_iso(),
        }},
    )
    return {"ok": True}


@router.post("/notifications/whatsapp")
async def send_whatsapp(body: WhatsAppIn, user: dict = Depends(get_current_user)):
    if not (TWILIO_SID and TWILIO_TOKEN and TWILIO_WA_FROM):
        logger.info("WhatsApp MOCK send to=%s msg=%s", body.to_phone, body.message[:80])
        return {"ok": True, "mocked": True, "to": body.to_phone}
    try:
        async with httpx.AsyncClient(timeout=10) as client_h:
            to = (
                f"whatsapp:{body.to_phone}"
                if not body.to_phone.startswith("whatsapp:") else body.to_phone
            )
            res = await client_h.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
                data={"From": TWILIO_WA_FROM, "To": to, "Body": body.message},
                auth=(TWILIO_SID, TWILIO_TOKEN),
            )
            if res.status_code >= 400:
                raise HTTPException(502, f"Twilio error: {res.text[:200]}")
            return {"ok": True, "mocked": False, "sid": res.json().get("sid")}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("whatsapp send failed")
        raise HTTPException(500, str(e)[:200])
