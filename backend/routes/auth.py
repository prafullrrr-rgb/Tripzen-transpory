"""Authentication routes: /auth/register, /auth/login, /auth/me."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import UserCreate, UserLogin, UserPublic, TokenResponse
from core.security import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    now_iso,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=TokenResponse)
async def register(body: UserCreate):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, body.role)
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user_id, email=body.email.lower(), full_name=body.full_name,
            role=body.role, phone=body.phone,
        ),
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user["id"], email=user["email"], full_name=user["full_name"],
            role=user["role"], phone=user.get("phone"),
        ),
    )


@router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**{k: user.get(k) for k in ["id", "email", "full_name", "role", "phone"]})
