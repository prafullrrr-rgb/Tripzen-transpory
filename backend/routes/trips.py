"""Trip lifecycle: start, location, end, scan, SOS, incident, ETA."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import LocationUpdate, ScanRequest, IncidentCreate
from core.security import get_current_user, require_roles, now_iso, now_utc
from services.notifications import create_notification
from services.ws import ws_manager
from services.geo import haversine_m

router = APIRouter(tags=["trips"])


@router.post("/trips/start")
async def start_trip(body: dict, user: dict = Depends(require_roles("driver"))):
    route_id = body.get("route_id")
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(404, "Route not found")
    await db.trips.update_many(
        {"driver_id": user["id"], "status": "active"},
        {"$set": {"status": "completed", "ended_at": now_iso()}},
    )
    first_stop = route["stops"][0] if route["stops"] else None
    trip_id = str(uuid.uuid4())
    trip = {
        "id": trip_id,
        "route_id": route_id,
        "route_name": route["name"],
        "driver_id": user["id"],
        "started_at": now_iso(),
        "ended_at": None,
        "status": "active",
        "current_lat": first_stop["lat"] if first_stop else 51.5074,
        "current_lng": first_stop["lng"] if first_stop else -0.1278,
        "current_stop_index": 0,
        "boarded_student_ids": [],
        "checked_out_student_ids": [],
        "eta_next_stop": first_stop["eta"] if first_stop else None,
    }
    await db.trips.insert_one(trip)
    return {k: v for k, v in trip.items() if k != "_id"}


@router.post("/trips/{trip_id}/location")
async def update_location(trip_id: str, body: LocationUpdate, user: dict = Depends(require_roles("driver"))):
    upd = {"current_lat": body.lat, "current_lng": body.lng}
    if body.stop_index is not None:
        upd["current_stop_index"] = body.stop_index
    await db.trips.update_one({"id": trip_id, "driver_id": user["id"]}, {"$set": upd})
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if trip:
        try:
            await ws_manager.broadcast(trip_id, {"type": "location", "trip": trip})
        except Exception:
            pass
    return trip


@router.post("/trips/{trip_id}/end")
async def end_trip(trip_id: str, user: dict = Depends(require_roles("driver"))):
    await db.trips.update_one(
        {"id": trip_id, "driver_id": user["id"]},
        {"$set": {"status": "completed", "ended_at": now_iso()}},
    )
    return {"ok": True}


@router.post("/trips/{trip_id}/scan")
async def scan_student(trip_id: str, body: ScanRequest, user: dict = Depends(require_roles("driver"))):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    student = await db.students.find_one({"qr_code": body.qr_code}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found for QR")
    if body.action == "board":
        await db.trips.update_one({"id": trip_id}, {"$addToSet": {"boarded_student_ids": student["id"]}})
        await create_notification(
            student["parent_id"], student["id"], "boarding",
            f"{student['name']} has boarded the bus",
            f"Bus on {trip['route_name']} - {now_utc().strftime('%H:%M')}",
            icon="bus",
        )
    else:
        await db.trips.update_one({"id": trip_id}, {"$addToSet": {"checked_out_student_ids": student["id"]}})
        await create_notification(
            student["parent_id"], student["id"], "handover",
            f"{student['name']} has been safely handed over",
            f"Checked out at {now_utc().strftime('%H:%M')}",
            icon="check",
        )
    return {"ok": True, "student": student}


@router.get("/trips/active")
async def active_trips(user: dict = Depends(get_current_user)):
    if user["role"] == "driver":
        cursor = db.trips.find({"driver_id": user["id"], "status": "active"}, {"_id": 0})
    elif user["role"] == "parent":
        students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
        route_ids = [s["route_id"] for s in students if s.get("route_id")]
        cursor = db.trips.find({"route_id": {"$in": route_ids}, "status": "active"}, {"_id": 0})
    else:
        cursor = db.trips.find({"status": "active"}, {"_id": 0})
    return await cursor.to_list(100)


@router.get("/trips/history")
async def trips_history(user: dict = Depends(get_current_user)):
    if user["role"] == "driver":
        cursor = db.trips.find({"driver_id": user["id"]}, {"_id": 0}).sort("started_at", -1).limit(50)
    elif user["role"] == "parent":
        students = await db.students.find({"parent_id": user["id"]}, {"_id": 0}).to_list(100)
        route_ids = [s["route_id"] for s in students if s.get("route_id")]
        cursor = db.trips.find({"route_id": {"$in": route_ids}}, {"_id": 0}).sort("started_at", -1).limit(50)
    else:
        cursor = db.trips.find({}, {"_id": 0}).sort("started_at", -1).limit(100)
    return await cursor.to_list(100)


@router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    return trip


@router.post("/trips/{trip_id}/sos")
async def trigger_sos(trip_id: str, user: dict = Depends(require_roles("driver"))):
    trip = await db.trips.find_one({"id": trip_id, "driver_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    alert_doc = {
        "id": str(uuid.uuid4()),
        "type": "sos",
        "title": f"🚨 EMERGENCY SOS — {trip['route_name']}",
        "message": f"Driver triggered SOS. Location: {trip['current_lat']:.4f}, {trip['current_lng']:.4f}",
        "severity": "critical",
        "created_at": now_iso(),
        "related_trip_id": trip_id,
    }
    await db.alerts.insert_one(alert_doc)
    boarded = trip.get("boarded_student_ids", [])
    if boarded:
        students = await db.students.find({"id": {"$in": boarded}}, {"_id": 0}).to_list(100)
        for s in students:
            await create_notification(
                s["parent_id"], s["id"], "alert",
                f"⚠️ Bus emergency — {s['name']}",
                "Driver has signaled an emergency. Help is being dispatched. Stay calm.",
                icon="warning",
            )
    return {"ok": True, "alert_id": alert_doc["id"], "notified_parents": len(boarded)}


@router.post("/trips/{trip_id}/incident")
async def report_incident(trip_id: str, body: IncidentCreate, user: dict = Depends(require_roles("driver"))):
    trip = await db.trips.find_one({"id": trip_id, "driver_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    incident_id = str(uuid.uuid4())
    doc = {
        "id": incident_id,
        "trip_id": trip_id,
        "driver_id": user["id"],
        "type": body.type,
        "description": body.description,
        "created_at": now_iso(),
    }
    await db.incidents.insert_one(doc)
    severity = "critical" if body.type == "breakdown" else "warning"
    await db.alerts.insert_one({
        "id": str(uuid.uuid4()),
        "type": "incident",
        "title": f"Incident — {body.type.title()} on {trip['route_name']}",
        "message": body.description[:200],
        "severity": severity,
        "created_at": now_iso(),
        "related_trip_id": trip_id,
    })
    boarded = trip.get("boarded_student_ids", [])
    if boarded:
        students = await db.students.find({"id": {"$in": boarded}}, {"_id": 0}).to_list(100)
        for s in students:
            await create_notification(
                s["parent_id"], s["id"], "delay",
                f"Bus update — {s['name']}",
                f"{body.type.title()}: {body.description[:120]}",
                icon="alert-circle",
            )
    return {"ok": True, "incident_id": incident_id}


@router.get("/trips/{trip_id}/eta")
async def trip_eta(trip_id: str, user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    route = await db.routes.find_one({"id": trip["route_id"]}, {"_id": 0})
    if not route or not route.get("stops"):
        return {"eta_minutes": None, "distance_m": 0, "next_stop": None, "geofence_alert": False}
    next_idx = min(trip["current_stop_index"] + 1, len(route["stops"]) - 1)
    next_stop = route["stops"][next_idx]
    dist = haversine_m(trip["current_lat"], trip["current_lng"], next_stop["lat"], next_stop["lng"])
    eta_min = max(1, round(dist / 500))
    geofence = dist <= 500
    return {
        "eta_minutes": eta_min,
        "distance_m": round(dist),
        "next_stop": next_stop,
        "geofence_alert": geofence,
    }
