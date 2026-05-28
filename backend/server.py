"""TripZen Backend — slim entry point.

All route handlers live in `routes/*.py`. Core infrastructure (config, db, security,
models) lives in `core/*.py`. Reusable services (notifications, websockets, geo)
live in `services/*.py`. Demo data seeding lives in `seed.py`.
"""
import asyncio
import logging

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware

from core.db import client, db
from services.ws import ws_manager
from seed import seed_data

from routes.auth import router as auth_router
from routes.students import router as students_router
from routes.bus_routes import router as routes_router
from routes.trips import router as trips_router
from routes.notifications import router as notifications_router
from routes.bookings import router as bookings_router
from routes.admin import router as admin_router
from routes.messages import router as messages_router
from routes.parent import router as parent_router
from routes.integrations import router as integrations_router
from routes.support import router as support_router
from routes.enhancements import router as enhancements_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tripzen")

app = FastAPI(title="TripZen API")

# Mount all routes under /api prefix
api = APIRouter(prefix="/api")
api.include_router(auth_router)
api.include_router(students_router)
api.include_router(routes_router)
api.include_router(trips_router)
api.include_router(notifications_router)
api.include_router(bookings_router)
api.include_router(admin_router)
api.include_router(messages_router)
api.include_router(parent_router)
api.include_router(integrations_router)
api.include_router(support_router)
api.include_router(enhancements_router)
app.include_router(api)


# ----- WebSocket (live trip tracking) -----
@app.websocket("/api/ws/trip/{trip_id}")
async def trip_websocket(websocket: WebSocket, trip_id: str):
    await ws_manager.connect(trip_id, websocket)
    try:
        trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
        if trip:
            await websocket.send_json({"type": "snapshot", "trip": trip})
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if msg.strip().lower() == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text("keepalive")
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws error: %s", e)
    finally:
        ws_manager.disconnect(trip_id, websocket)


# ----- CORS -----
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Lifecycle -----
@app.on_event("startup")
async def on_startup():
    await seed_data()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
