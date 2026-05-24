"""TripZen Backend End-to-End Test Suite"""
import os
import sys
import io
import json
import time
import requests
from pathlib import Path

# Read backend URL from frontend .env
ENV_PATH = Path("/app/frontend/.env")
BASE_URL = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

API = f"{BASE_URL}/api"
print(f"Using API base: {API}")

results = []  # list of (name, passed, info)


def record(name, passed, info=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} :: {info}")
    results.append((name, passed, info))


def post(path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", headers=headers, timeout=60, **kw)


def get(path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=headers, timeout=60, **kw)


def put(path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.put(f"{API}{path}", headers=headers, timeout=60, **kw)


def delete(path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.delete(f"{API}{path}", headers=headers, timeout=60, **kw)


# ===================== AUTH =====================
print("\n========== AUTH ==========")
tokens = {}
users = {}

for role, email, pw in [
    ("admin", "admin@tripzen.com", "admin123"),
    ("driver", "driver@tripzen.com", "driver123"),
    ("parent", "priya@tripzen.com", "parent123"),
]:
    r = post("/auth/login", json={"email": email, "password": pw})
    ok = r.status_code == 200 and "access_token" in r.json()
    record(f"Login {role}", ok, f"status={r.status_code} body={r.text[:200]}")
    if ok:
        data = r.json()
        tokens[role] = data["access_token"]
        users[role] = data["user"]

# Test /auth/me
for role, tok in tokens.items():
    r = get("/auth/me", token=tok)
    ok = r.status_code == 200 and r.json().get("role") == role
    record(f"/auth/me {role}", ok, f"status={r.status_code} body={r.text[:120]}")

# Test register a fresh user, then delete to keep state clean (use admin to clean)
import uuid as _uuid
rand_email = f"e2e+{_uuid.uuid4().hex[:8]}@tripzen.test"
r = post("/auth/register", json={"email": rand_email, "password": "TestPass123!", "full_name": "E2E Test User", "role": "parent"})
ok = r.status_code == 200 and "access_token" in r.json()
record("Register new parent", ok, f"status={r.status_code} body={r.text[:120]}")
if ok:
    new_uid = r.json()["user"]["id"]
    delete(f"/admin/users/{new_uid}", token=tokens["admin"])

admin_t = tokens.get("admin")
driver_t = tokens.get("driver")
parent_t = tokens.get("parent")

if not (admin_t and driver_t and parent_t):
    print("Auth failed - aborting.")
    sys.exit(1)

# ===================== STUDENTS CRUD =====================
print("\n========== STUDENTS ==========")
# Parent list
r = get("/students", token=parent_t)
record("Parent list students", r.status_code == 200, f"status={r.status_code} count={len(r.json()) if r.ok else 0}")
parent_students = r.json() if r.ok else []
aarav = next((s for s in parent_students if s["name"] == "Aarav Sharma"), None)
record("Aarav seeded student exists with qr_code", bool(aarav and aarav.get("qr_code")), f"qr={aarav.get('qr_code') if aarav else None}")

# Admin list
r = get("/students", token=admin_t)
record("Admin list students", r.status_code == 200 and isinstance(r.json(), list), f"status={r.status_code} count={len(r.json()) if r.ok else 0}")

# Parent creates a student
r = post("/students", token=parent_t, json={"name": "Riya Sharma E2E", "grade": "Year 2", "school": "Greenfield School"})
ok = r.status_code == 200 and r.json().get("qr_code", "").startswith("TRIPZEN-")
record("Parent create student", ok, f"status={r.status_code} body={r.text[:160]}")
new_student_id = r.json()["id"] if ok else None

# Update
if new_student_id:
    r = put(f"/students/{new_student_id}", token=parent_t, json={"name": "Riya Sharma E2E", "grade": "Year 3", "school": "Greenfield School"})
    record("Parent update student", r.status_code == 200 and r.json().get("grade") == "Year 3", f"status={r.status_code}")

# Delete
if new_student_id:
    r = delete(f"/students/{new_student_id}", token=parent_t)
    record("Parent delete student", r.status_code == 200, f"status={r.status_code}")

# ===================== ROUTES =====================
print("\n========== ROUTES ==========")
r = get("/routes", token=admin_t)
record("Admin list routes", r.status_code == 200 and len(r.json()) >= 2, f"count={len(r.json()) if r.ok else 0}")
all_routes = r.json() if r.ok else []
morning_route = next((rt for rt in all_routes if rt["name"] == "Route 3 - Morning"), None)
record("Route 3 - Morning seeded", bool(morning_route), f"id={morning_route.get('id') if morning_route else None}")

# Driver only sees assigned routes
r = get("/routes", token=driver_t)
ok = r.status_code == 200 and all(rt.get("driver_id") == users["driver"]["id"] for rt in r.json())
record("Driver only sees assigned routes", ok, f"count={len(r.json()) if r.ok else 0}")

# Admin create a route
new_route_body = {
    "name": "E2E Test Route",
    "driver_id": users["driver"]["id"],
    "bus_number": "Bus E2E",
    "shift": "morning",
    "stops": [
        {"id": str(_uuid.uuid4()), "name": "Stop A", "address": "A", "lat": 51.5, "lng": -0.13, "order": 0, "eta": "08:00 AM"},
        {"id": str(_uuid.uuid4()), "name": "Stop B", "address": "B", "lat": 51.51, "lng": -0.12, "order": 1, "eta": "08:10 AM"},
    ],
}
r = post("/routes", token=admin_t, json=new_route_body)
ok = r.status_code == 200 and "id" in r.json()
record("Admin create route", ok, f"status={r.status_code}")
new_route_id = r.json()["id"] if ok else None

# Get one
if new_route_id:
    r = get(f"/routes/{new_route_id}", token=admin_t)
    record("Admin get one route", r.status_code == 200, f"status={r.status_code}")
    # Update
    upd = dict(new_route_body)
    upd["bus_number"] = "Bus E2E v2"
    r = put(f"/routes/{new_route_id}", token=admin_t, json=upd)
    record("Admin update route", r.status_code == 200 and r.json().get("bus_number") == "Bus E2E v2", f"status={r.status_code}")
    # Delete
    r = delete(f"/routes/{new_route_id}", token=admin_t)
    record("Admin delete route", r.status_code == 200, f"status={r.status_code}")

# Negative: parent forbidden to create route
r = post("/routes", token=parent_t, json=new_route_body)
record("Parent cannot create route (403)", r.status_code == 403, f"status={r.status_code}")

# ===================== TRIPS LIFECYCLE =====================
print("\n========== TRIPS ==========")
trip_id = None
if morning_route:
    r = post("/trips/start", token=driver_t, json={"route_id": morning_route["id"]})
    ok = r.status_code == 200 and r.json().get("status") == "active"
    record("Driver starts trip on Route 3 - Morning", ok, f"status={r.status_code} body={r.text[:200]}")
    trip_id = r.json()["id"] if ok else None

# GET /trips/active as driver
r = get("/trips/active", token=driver_t)
ok = r.status_code == 200 and any(t["id"] == trip_id for t in r.json())
record("GET /trips/active returns trip", ok, f"count={len(r.json()) if r.ok else 0}")

# Location update
if trip_id:
    r = post(f"/trips/{trip_id}/location", token=driver_t, json={"lat": 51.5200, "lng": -0.1300, "stop_index": 1})
    ok = r.status_code == 200 and abs(r.json().get("current_lat", 0) - 51.52) < 0.01
    record("Update trip location", ok, f"status={r.status_code} current_lat={r.json().get('current_lat')}")

# Get parent notifications baseline
r = get("/notifications", token=parent_t)
baseline_notifs = len(r.json()) if r.ok else 0

# Scan board with Aarav's QR
if trip_id and aarav:
    r = post(f"/trips/{trip_id}/scan", token=driver_t, json={"qr_code": aarav["qr_code"], "action": "board"})
    ok = r.status_code == 200 and r.json().get("ok")
    record("Scan board Aarav", ok, f"status={r.status_code}")

    # Verify parent received notification
    time.sleep(0.5)
    r = get("/notifications", token=parent_t)
    notifs = r.json() if r.ok else []
    has_board = any(n["type"] == "boarding" and aarav["id"] == n.get("student_id") for n in notifs)
    record("Parent received boarding notification", has_board, f"new_count={len(notifs)} baseline={baseline_notifs}")

    # Scan checkout
    r = post(f"/trips/{trip_id}/scan", token=driver_t, json={"qr_code": aarav["qr_code"], "action": "checkout"})
    record("Scan checkout Aarav", r.status_code == 200, f"status={r.status_code}")

# ETA before ending trip (geofence)
if trip_id:
    r = get(f"/trips/{trip_id}/eta", token=parent_t)
    body = r.json() if r.ok else {}
    ok = r.status_code == 200 and "eta_minutes" in body and "distance_m" in body and "next_stop" in body and "geofence_alert" in body
    record("GET /trips/{id}/eta", ok, f"status={r.status_code} body={r.text[:200]}")

# ===================== DRIVER SOS & INCIDENTS =====================
print("\n========== SOS & INCIDENTS ==========")
sos_alert_id = None
if trip_id:
    r = post(f"/trips/{trip_id}/sos", token=driver_t)
    ok = r.status_code == 200 and r.json().get("ok")
    record("Driver SOS", ok, f"status={r.status_code} body={r.text[:200]}")
    sos_alert_id = r.json().get("alert_id") if ok else None

# Admin alerts contains critical SOS
r = get("/admin/alerts", token=admin_t)
alerts = r.json() if r.ok else []
has_sos = any(a.get("type") == "sos" and a.get("severity") == "critical" and (sos_alert_id is None or a.get("id") == sos_alert_id) for a in alerts)
record("Admin sees SOS critical alert", has_sos, f"alerts_count={len(alerts)}")

# Incident
if trip_id:
    r = post(f"/trips/{trip_id}/incident", token=driver_t, json={"type": "delay", "description": "Traffic on Park Avenue, 10 min delay"})
    ok = r.status_code == 200 and r.json().get("ok")
    record("Driver report incident", ok, f"status={r.status_code}")

r = get("/admin/incidents", token=admin_t)
ok = r.status_code == 200 and any(i.get("type") == "delay" and i.get("trip_id") == trip_id for i in r.json())
record("Admin sees incident", ok, f"count={len(r.json()) if r.ok else 0}")

# ===================== BOOKINGS + SIBLING DISCOUNT =====================
print("\n========== BOOKINGS ==========")
# Cleanup pre-existing paid monthly bookings to ensure deterministic discount test
# Note: we can't delete bookings, so we account for existing paid count
existing = get("/bookings", token=parent_t).json()
existing_paid_monthly = sum(1 for b in existing if b.get("status") == "paid" and b.get("plan") == "monthly")
print(f"  (existing paid monthly bookings: {existing_paid_monthly})")

if morning_route and aarav:
    # First booking
    r = post("/bookings", token=parent_t, json={"student_id": aarav["id"], "route_id": morning_route["id"], "plan": "monthly"})
    ok = r.status_code == 200
    record("Create first monthly booking", ok, f"status={r.status_code} body={r.text[:200]}")
    booking1 = r.json() if ok else None
    if booking1:
        # If no previous paid monthly, expect amount=89.99 discount=0
        if existing_paid_monthly == 0:
            expect_amount = 89.99
            expect_discount = 0.0
        else:
            expect_amount = 71.99
            expect_discount = 18.00
        ok_amt = abs(booking1["amount"] - expect_amount) < 0.01 and abs(booking1["discount"] - expect_discount) < 0.01
        record(f"First booking amount={expect_amount} discount={expect_discount}", ok_amt, f"got amount={booking1['amount']} discount={booking1['discount']}")

        # Pay
        r = post(f"/bookings/{booking1['id']}/pay", token=parent_t)
        record("Pay first booking", r.status_code == 200 and r.json().get("payment_ref", "").startswith("pi_"), f"status={r.status_code}")

        # Second booking should have discount applied
        r = post("/bookings", token=parent_t, json={"student_id": aarav["id"], "route_id": morning_route["id"], "plan": "monthly"})
        ok2 = r.status_code == 200
        record("Create second monthly booking", ok2, f"status={r.status_code}")
        if ok2:
            booking2 = r.json()
            ok_disc = abs(booking2["discount"] - 18.00) < 0.01 and abs(booking2["amount"] - 71.99) < 0.01
            record("Second monthly booking has 20% sibling discount", ok_disc, f"got amount={booking2['amount']} discount={booking2['discount']}")

        # Single plan booking
        r = post("/bookings", token=parent_t, json={"student_id": aarav["id"], "route_id": morning_route["id"], "plan": "single"})
        ok_s = r.status_code == 200 and abs(r.json()["amount"] - 4.50) < 0.01 and r.json()["discount"] == 0.0
        record("Single plan booking = 4.50", ok_s, f"got={r.json() if r.ok else r.text[:120]}")

# ===================== CHAT =====================
print("\n========== CHAT ==========")
driver_uid = users["driver"]["id"]
parent_uid = users["parent"]["id"]
admin_uid = users["admin"]["id"]

# Parent → driver
r = post("/messages", token=parent_t, json={"recipient_id": driver_uid, "text": "Hi, will the bus be on time?"})
record("Parent sends message to driver", r.status_code == 200 and "id" in r.json(), f"status={r.status_code} body={r.text[:200]}")

# Driver fetches conversation
r = get(f"/messages/{parent_uid}", token=driver_t)
msgs = r.json() if r.ok else []
ok = r.status_code == 200 and any(m["text"].startswith("Hi, will the bus") for m in msgs)
record("Driver fetches parent thread", ok, f"count={len(msgs)}")

# Driver replies
r = post("/messages", token=driver_t, json={"recipient_id": parent_uid, "text": "Yes, on schedule!"})
record("Driver replies to parent", r.status_code == 200, f"status={r.status_code}")

# Parent fetches threads
r = get("/messages", token=parent_t)
threads = r.json() if r.ok else []
has_driver_thread = any(t.get("other_id") == driver_uid for t in threads)
record("Parent threads list contains driver", has_driver_thread, f"threads={len(threads)}")

# Negative: parent → another parent (need a 2nd parent)
# create a temp parent
temp_email = f"e2eparent+{_uuid.uuid4().hex[:6]}@tripzen.test"
r = post("/auth/register", json={"email": temp_email, "password": "TestPass123!", "full_name": "Other Parent", "role": "parent"})
if r.status_code == 200:
    temp_parent_id = r.json()["user"]["id"]
    r = post("/messages", token=parent_t, json={"recipient_id": temp_parent_id, "text": "should fail"})
    record("Parent → another parent is 403", r.status_code == 403, f"status={r.status_code}")
    delete(f"/admin/users/{temp_parent_id}", token=admin_t)
else:
    record("Setup temp parent for negative test", False, f"status={r.status_code}")

# ===================== END TRIP + RATING =====================
print("\n========== END TRIP + RATING ==========")
if trip_id:
    r = post(f"/trips/{trip_id}/end", token=driver_t)
    record("Driver ends trip", r.status_code == 200 and r.json().get("ok"), f"status={r.status_code}")

# Rating
if trip_id:
    r = post("/ratings", token=parent_t, json={"trip_id": trip_id, "stars": 5, "feedback": "Great driver, very safe!"})
    record("Parent posts 5-star rating", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

# Driver ratings aggregate
r = get(f"/ratings/driver/{driver_uid}", token=parent_t)
body = r.json() if r.ok else {}
ok = r.status_code == 200 and body.get("average", 0) >= 1 and body.get("count", 0) >= 1
record("GET /ratings/driver/{id}", ok, f"avg={body.get('average')} count={body.get('count')}")

# ===================== AI WEEKLY SUMMARY =====================
print("\n========== AI WEEKLY SUMMARY ==========")
if aarav:
    r = get(f"/parent/weekly-summary/{aarav['id']}", token=parent_t)
    body = r.json() if r.ok else {}
    ok = r.status_code == 200 and isinstance(body.get("summary"), str) and body.get("count", -1) >= 0
    record("Weekly summary returned", ok, f"status={r.status_code} ai_generated={body.get('ai_generated')} summary[:80]={(body.get('summary') or '')[:80]}")

# ===================== GDPR EXPORT =====================
print("\n========== GDPR ==========")
r = get("/parent/gdpr-export", token=parent_t)
body = r.json() if r.ok else {}
needed_keys = {"user", "children", "bookings", "notifications", "messages", "ratings"}
ok = r.status_code == 200 and needed_keys.issubset(body.keys())
record("GDPR export contains required keys", ok, f"status={r.status_code} keys={list(body.keys())[:10]}")

# Do NOT call DELETE /api/parent/account

# ===================== ADMIN STATS / REVENUE / USERS =====================
print("\n========== ADMIN ENDPOINTS ==========")
r = get("/admin/stats", token=admin_t)
body = r.json() if r.ok else {}
needed = {"total_routes", "total_students", "active_buses", "on_time_percent", "completed_today", "total_drivers", "total_parents"}
record("/admin/stats", r.status_code == 200 and needed.issubset(body.keys()), f"keys={list(body.keys())}")

r = get("/admin/revenue", token=admin_t)
body = r.json() if r.ok else {}
record("/admin/revenue", r.status_code == 200 and "total_revenue" in body and "paid_bookings" in body, f"body={body}")

r = get("/admin/users", token=admin_t)
record("/admin/users", r.status_code == 200 and len(r.json()) >= 3, f"count={len(r.json()) if r.ok else 0}")

r = get("/admin/alerts", token=admin_t)
record("/admin/alerts", r.status_code == 200, f"count={len(r.json()) if r.ok else 0}")

r = get("/admin/incidents", token=admin_t)
record("/admin/incidents", r.status_code == 200, f"count={len(r.json()) if r.ok else 0}")

# Negative: parent cannot access admin
r = get("/admin/stats", token=parent_t)
record("Parent cannot access /admin/stats (403)", r.status_code == 403, f"status={r.status_code}")

# ===================== SUMMARY =====================
print("\n========== SUMMARY ==========")
passed = sum(1 for _, ok, _ in results if ok)
failed = [r for r in results if not r[1]]
print(f"PASSED: {passed}/{len(results)}")
print(f"FAILED: {len(failed)}")
for name, _, info in failed:
    print(f"  - {name} :: {info}")

# Exit non-zero if any failures
sys.exit(0 if not failed else 1)
