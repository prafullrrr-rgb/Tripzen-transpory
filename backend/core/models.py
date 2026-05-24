"""All Pydantic models used across routes."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, EmailStr

Role = Literal["parent", "driver", "admin"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str
    role: Role = "parent"
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: Role
    phone: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class StudentCreate(BaseModel):
    name: str
    grade: Optional[str] = None
    school: Optional[str] = None
    avatar_url: Optional[str] = None
    route_id: Optional[str] = None


class Stop(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    order: int
    eta: Optional[str] = None


class RouteCreate(BaseModel):
    name: str
    driver_id: Optional[str] = None
    bus_number: Optional[str] = None
    stops: List[Stop] = []
    shift: Literal["morning", "afternoon"] = "morning"


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    stop_index: Optional[int] = None


class ScanRequest(BaseModel):
    qr_code: str
    action: Literal["board", "checkout"]


class BookingCreate(BaseModel):
    student_id: str
    route_id: str
    plan: Literal["monthly", "single"] = "monthly"


class IncidentCreate(BaseModel):
    type: Literal["delay", "breakdown", "traffic", "behavior", "other"]
    description: str


class RatingCreate(BaseModel):
    trip_id: str
    stars: int = Field(ge=1, le=5)
    feedback: Optional[str] = None


class MessageCreate(BaseModel):
    recipient_id: str
    text: str


class PushTokenIn(BaseModel):
    token: str
    platform: Optional[Literal["ios", "android", "web"]] = None


class WhatsAppIn(BaseModel):
    to_phone: str
    message: str
