"""Centralised configuration loaded from environment."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "tripzen_db")

JWT_SECRET = os.environ.get("JWT_SECRET", "tripzen-supersecret-change-in-prod")
JWT_ALGO = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "pk_test_mock")

TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WA_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "")
