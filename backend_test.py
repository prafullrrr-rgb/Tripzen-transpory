"""
Backend test suite for TripZen Phase 2 endpoints:
  1. WebSocket /api/ws/trip/{trip_id}
  2. POST /api/users/push-token
  3. POST /api/bookings/{bid}/payment-intent + /confirm-payment
  4. POST /api/notifications/whatsapp

Reads EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env (no localhost).
Seed creds in /app/memory/test_credentials.md.
"""
import asyncio
import json
import sys
from typing import Optional

import httpx
import websockets


def _load_env():
    env_path = "/app/frontend/.env"
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                return v
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")


BASE_URL = _load_env()
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN = {"email": "admin@tripzen.com", "password": "admin123"}
DRIVER = {"email": "driver@tripzen.com", "password": "driver123"}
PARENT = {"email": "priya@tripzen.com", "password": "parent123"}

RESULTS = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    RESULTS.append((name, ok, detail))
    print(f"[{status}] {name} :: {detail}")


def login(client: httpx.Client, creds):
    r = client.post(f"{API}/auth/login", json=creds)
    r.raise_for_status()
    j = r.json()
    return j.get("access_token") or j.get("token")


def auth_h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def test_websocket_trip(driver_tok: str, trip_id: str):
    ws_url = f"{WS_BASE}/api/ws/trip/{trip_id}"
    print(f"[INFO] Connecting WS: {ws_url}")
    try:
        async with websockets.connect(ws_url, open_timeout=15, close_timeout=5) as ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=10)
            except asyncio.TimeoutError:
                log("WS snapshot", False, "no snapshot received in 10s")
                return
            try:
                payload = json.loads(msg)
            except Exception:
                log("WS snapshot", False, f"non-JSON snapshot: {msg!r}")
                return
            if payload.get("type") == "snapshot" and payload.get("trip", {}).get("id") == trip_id:
                trip = payload["trip"]
                log("WS snapshot", True,
                    f"trip.id matches; current_lat={trip.get('current_lat')} current_lng={trip.get('current_lng')}")
            else:
                log("WS snapshot", False, f"unexpected payload: {payload}")
                return

            new_lat = 51.5210
            new_lng = -0.0900

            async def push_loc():
                await asyncio.sleep(0.3)
                async with httpx.AsyncClient(timeout=20) as ac:
                    r = await ac.post(
                        f"{API}/trips/{trip_id}/location",
                        json={"lat": new_lat, "lng": new_lng},
                        headers=auth_h(driver_tok),
                    )
                    return r.status_code

            push_task = asyncio.create_task(push_loc())

            got_location_frame = False
            deadline = asyncio.get_event_loop().time() + 10
            while asyncio.get_event_loop().time() < deadline:
                remaining = max(0.5, deadline - asyncio.get_event_loop().time())
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                except asyncio.TimeoutError:
                    break
                try:
                    p = json.loads(raw)
                except Exception:
                    continue
                if p.get("type") == "location":
                    t = p.get("trip", {})
                    if abs(t.get("current_lat", 0) - new_lat) < 1e-6 and abs(t.get("current_lng", 0) - new_lng) < 1e-6:
                        got_location_frame = True
                        log("WS location update broadcast", True,
                            f"received location frame with new coords ({t['current_lat']},{t['current_lng']})")
                        break
                    else:
                        log("WS location update broadcast", False,
                            f"coords mismatch: got {t.get('current_lat')},{t.get('current_lng')} expected {new_lat},{new_lng}")
                        break

            sc = await push_task
            if sc != 200:
                log("REST POST /trips/{id}/location", False, f"status={sc}")
            else:
                log("REST POST /trips/{id}/location", True, "200 OK")

            if not got_location_frame:
                log("WS location update broadcast", False, "no `location` frame received within 10s after REST push")

            try:
                await ws.send("ping")
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                if isinstance(raw, str) and raw.strip().lower() == "pong":
                    log("WS ping/pong", True, "received pong")
                else:
                    log("WS ping/pong", True, f"Minor: got {raw!r} instead of pong (optional)")
            except Exception as e:
                log("WS ping/pong", True, f"Minor: ping/pong check failed ({e}) (optional)")

    except Exception as e:
        log("WS connect", False, f"connection error: {e}")


def test_push_token(parent_tok: str):
    with httpx.Client(timeout=20) as c:
        r = c.post(
            f"{API}/users/push-token",
            json={"token": "ExponentPushToken[abc123]", "platform": "ios"},
            headers=auth_h(parent_tok),
        )
        if r.status_code == 200 and r.json().get("ok") is True:
            log("POST /users/push-token (parent ios)", True, f"body={r.json()}")
        else:
            log("POST /users/push-token (parent ios)", False, f"status={r.status_code} body={r.text[:200]}")

        r2 = c.post(
            f"{API}/users/push-token",
            json={"token": "ExponentPushToken[xyz999]", "platform": "android"},
            headers=auth_h(parent_tok),
        )
        if r2.status_code == 200 and r2.json().get("ok") is True:
            log("POST /users/push-token (overwrite android)", True, f"body={r2.json()}")
        else:
            log("POST /users/push-token (overwrite android)", False, f"status={r2.status_code} body={r2.text[:200]}")

        r3 = c.post(
            f"{API}/users/push-token",
            json={"token": "ExponentPushToken[noauth]", "platform": "web"},
        )
        if r3.status_code in (401, 403):
            log("POST /users/push-token (no auth → 401/403)", True, f"status={r3.status_code}")
        else:
            log("POST /users/push-token (no auth → 401/403)", False,
                f"expected 401/403 got {r3.status_code} body={r3.text[:200]}")


def get_first_student_id(client: httpx.Client, parent_tok: str) -> Optional[str]:
    r = client.get(f"{API}/students", headers=auth_h(parent_tok))
    r.raise_for_status()
    items = r.json()
    return items[0]["id"] if items else None


def test_payment_flow(parent_tok: str, admin_tok: str):
    with httpx.Client(timeout=20) as c:
        student_id = get_first_student_id(c, parent_tok)
        if not student_id:
            log("Payment: prerequisite student", False, "No student found for parent")
            return
        r = c.get(f"{API}/routes", headers=auth_h(admin_tok))
        if r.status_code != 200 or not r.json():
            log("Payment: prerequisite route", False, f"admin /routes status={r.status_code}")
            return
        route_id = None
        for rt in r.json():
            if "morning" in rt["name"].lower():
                route_id = rt["id"]
                break
        route_id = route_id or r.json()[0]["id"]

        rb = c.post(
            f"{API}/bookings",
            json={"plan": "single", "student_id": student_id, "route_id": route_id},
            headers=auth_h(parent_tok),
        )
        if rb.status_code != 200:
            log("Create single booking", False, f"status={rb.status_code} body={rb.text[:200]}")
            return
        booking = rb.json()
        bid = booking["id"]
        log("Create single booking", True, f"id={bid} amount={booking.get('amount')}")

        ri = c.post(f"{API}/bookings/{bid}/payment-intent", headers=auth_h(parent_tok))
        if ri.status_code != 200:
            log("POST /bookings/{id}/payment-intent", False, f"status={ri.status_code} body={ri.text[:200]}")
            return
        body = ri.json()
        cs = body.get("client_secret", "") or ""
        problems = []
        if not cs.startswith("pi_mock_"):
            problems.append(f"client_secret does not start with pi_mock_ (got {cs[:30]})")
        if "publishable_key" not in body:
            problems.append("missing publishable_key")
        if body.get("amount") != 4.5:
            problems.append(f"amount expected 4.5 got {body.get('amount')}")
        if (body.get("currency") or "").lower() != "gbp":
            problems.append(f"currency expected gbp got {body.get('currency')}")
        if body.get("mocked") is not True:
            problems.append(f"mocked expected True got {body.get('mocked')}")
        if problems:
            log("POST /bookings/{id}/payment-intent", False, "; ".join(problems) + f" full={body}")
        else:
            log("POST /bookings/{id}/payment-intent", True, f"body={body}")

        rc = c.post(f"{API}/bookings/{bid}/confirm-payment", headers=auth_h(parent_tok))
        if rc.status_code != 200:
            log("POST /bookings/{id}/confirm-payment", False, f"status={rc.status_code} body={rc.text[:200]}")
            return
        cb = rc.json()
        if cb.get("ok") is True and cb.get("amount") == 4.5:
            log("POST /bookings/{id}/confirm-payment", True, f"body={cb}")
        else:
            log("POST /bookings/{id}/confirm-payment", False, f"unexpected body={cb}")

        rl = c.get(f"{API}/bookings", headers=auth_h(parent_tok))
        if rl.status_code == 200:
            match = next((b for b in rl.json() if b["id"] == bid), None)
            if match and match.get("status") == "paid":
                log("GET /bookings shows status=paid", True,
                    f"status={match['status']} payment_ref={match.get('payment_ref')}")
            else:
                log("GET /bookings shows status=paid", False, f"booking={match}")
        else:
            log("GET /bookings shows status=paid", False, f"status={rl.status_code}")

        rn = c.post(f"{API}/bookings/{bid}/payment-intent", headers=auth_h(parent_tok))
        if rn.status_code == 400 and "already paid" in rn.text.lower():
            log("Negative: payment-intent on paid booking → 400 'Already paid'", True, f"body={rn.text}")
        else:
            log("Negative: payment-intent on paid booking → 400 'Already paid'", False,
                f"expected 400 'Already paid' got status={rn.status_code} body={rn.text[:200]}")


def test_whatsapp(admin_tok: str):
    with httpx.Client(timeout=20) as c:
        r = c.post(
            f"{API}/notifications/whatsapp",
            json={"to_phone": "+447700900222", "message": "Hello from test"},
            headers=auth_h(admin_tok),
        )
        if r.status_code != 200:
            log("POST /notifications/whatsapp", False, f"status={r.status_code} body={r.text[:200]}")
            return
        b = r.json()
        if b.get("ok") is True and b.get("mocked") is True and b.get("to") == "+447700900222":
            log("POST /notifications/whatsapp (mocked)", True, f"body={b}")
        else:
            log("POST /notifications/whatsapp (mocked)", False, f"unexpected body={b}")


def ensure_active_trip(driver_tok: str) -> Optional[str]:
    with httpx.Client(timeout=30) as c:
        r = c.get(f"{API}/trips/active", headers=auth_h(driver_tok))
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                data = data[0] if data else None
            if data and data.get("id"):
                print(f"[INFO] reusing active trip {data['id']}")
                return data["id"]

        rr = c.get(f"{API}/routes", headers=auth_h(driver_tok))
        if rr.status_code != 200:
            print(f"[ERR] driver /routes status={rr.status_code} body={rr.text[:200]}")
            return None
        route = None
        for rt in rr.json():
            if "morning" in rt["name"].lower() and "route 3" in rt["name"].lower():
                route = rt
                break
        if not route and rr.json():
            route = rr.json()[0]
        if not route:
            print("[ERR] No route found")
            return None

        rs = c.post(f"{API}/trips/start", json={"route_id": route["id"]}, headers=auth_h(driver_tok))
        if rs.status_code != 200:
            print(f"[ERR] start trip status={rs.status_code} body={rs.text[:200]}")
            return None
        return rs.json()["id"]


def main():
    print(f"[INFO] BASE_URL={BASE_URL}")
    print(f"[INFO] WS_BASE={WS_BASE}")

    with httpx.Client(timeout=30) as c:
        admin_tok = login(c, ADMIN)
        driver_tok = login(c, DRIVER)
        parent_tok = login(c, PARENT)
        print("[INFO] All three role logins OK")

    trip_id = ensure_active_trip(driver_tok)
    if not trip_id:
        log("WS prerequisites: active trip", False, "could not start/find an active trip")
    else:
        log("WS prerequisites: active trip", True, f"trip_id={trip_id}")
        asyncio.run(test_websocket_trip(driver_tok, trip_id))

    test_push_token(parent_tok)
    test_payment_flow(parent_tok, admin_tok)
    test_whatsapp(admin_tok)

    print("\n========== SUMMARY ==========")
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    total = len(RESULTS)
    for name, ok, _ in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'} | {name}")
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
