"""Demo data seeding for TripZen."""
import uuid
import logging

from core.db import db
from core.security import hash_password, now_iso

logger = logging.getLogger("tripzen.seed")


async def seed_data():
    admin = await db.users.find_one({"email": "admin@tripzen.com"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@tripzen.com",
            "full_name": "TripZen Admin",
            "role": "admin",
            "phone": "+447700900000",
            "password_hash": hash_password("admin123"),
            "created_at": now_iso(),
        })
        logger.info("Seeded admin user")

    driver = await db.users.find_one({"email": "driver@tripzen.com"})
    if not driver:
        driver_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": driver_id,
            "email": "driver@tripzen.com",
            "full_name": "John Smith",
            "role": "driver",
            "phone": "+447700900111",
            "password_hash": hash_password("driver123"),
            "created_at": now_iso(),
        })
    else:
        driver_id = driver["id"]

    parent = await db.users.find_one({"email": "priya@tripzen.com"})
    if not parent:
        parent_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": parent_id,
            "email": "priya@tripzen.com",
            "full_name": "Priya Sharma",
            "role": "parent",
            "phone": "+447700900222",
            "password_hash": hash_password("parent123"),
            "created_at": now_iso(),
        })
    else:
        parent_id = parent["id"]

    route = await db.routes.find_one({"name": "Route 3 - Morning"})
    if not route:
        route_id = str(uuid.uuid4())
        stops = [
            {"id": str(uuid.uuid4()), "name": "Green Street Stop", "address": "Green Street, London", "lat": 51.5174, "lng": -0.1378, "order": 0, "eta": "07:30 AM"},
            {"id": str(uuid.uuid4()), "name": "Park Avenue", "address": "Park Avenue, London", "lat": 51.5200, "lng": -0.1300, "order": 1, "eta": "07:38 AM"},
            {"id": str(uuid.uuid4()), "name": "School Road", "address": "School Road, London", "lat": 51.5230, "lng": -0.1220, "order": 2, "eta": "07:50 AM"},
            {"id": str(uuid.uuid4()), "name": "Greenfield School", "address": "Greenfield School, London", "lat": 51.5260, "lng": -0.1150, "order": 3, "eta": "08:05 AM"},
        ]
        await db.routes.insert_one({
            "id": route_id,
            "name": "Route 3 - Morning",
            "driver_id": driver_id,
            "bus_number": "Bus 3",
            "stops": stops,
            "shift": "morning",
            "student_count": 0,
            "created_at": now_iso(),
        })
    else:
        route_id = route["id"]

    if not await db.routes.find_one({"name": "Route 3 - Afternoon"}):
        await db.routes.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Route 3 - Afternoon",
            "driver_id": driver_id,
            "bus_number": "Bus 3",
            "stops": [
                {"id": str(uuid.uuid4()), "name": "Greenfield School", "address": "Greenfield School, London", "lat": 51.5260, "lng": -0.1150, "order": 0, "eta": "03:30 PM"},
                {"id": str(uuid.uuid4()), "name": "School Road", "address": "School Road, London", "lat": 51.5230, "lng": -0.1220, "order": 1, "eta": "03:45 PM"},
                {"id": str(uuid.uuid4()), "name": "Park Avenue", "address": "Park Avenue, London", "lat": 51.5200, "lng": -0.1300, "order": 2, "eta": "04:00 PM"},
                {"id": str(uuid.uuid4()), "name": "Green Street Stop", "address": "Green Street, London", "lat": 51.5174, "lng": -0.1378, "order": 3, "eta": "04:15 PM"},
            ],
            "shift": "afternoon",
            "student_count": 0,
            "created_at": now_iso(),
        })

    student = await db.students.find_one({"name": "Aarav Sharma"})
    if not student:
        sid = str(uuid.uuid4())
        await db.students.insert_one({
            "id": sid,
            "parent_id": parent_id,
            "name": "Aarav Sharma",
            "grade": "Year 4",
            "school": "Greenfield School",
            "avatar_url": "https://images.unsplash.com/photo-1693639257331-0bad8ac3913f?crop=entropy&cs=srgb&fm=jpg&q=85&w=200",
            "route_id": route_id,
            "qr_code": f"TRIPZEN-{sid[:8].upper()}",
            "created_at": now_iso(),
        })
        await db.routes.update_one({"id": route_id}, {"$inc": {"student_count": 1}})

    if await db.alerts.count_documents({}) == 0:
        await db.alerts.insert_many([
            {"id": str(uuid.uuid4()), "type": "delay", "title": "Bus 3 delay", "message": "Running 7 minutes late", "severity": "warning", "created_at": now_iso(), "related_trip_id": None},
            {"id": str(uuid.uuid4()), "type": "checkout", "title": "Student not checked out", "message": "Riya - 08:02 AM", "severity": "warning", "created_at": now_iso(), "related_trip_id": None},
            {"id": str(uuid.uuid4()), "type": "deviation", "title": "Route deviation", "message": "Bus 5 - 08:10 AM", "severity": "info", "created_at": now_iso(), "related_trip_id": None},
        ])

    logger.info("Seed complete")
