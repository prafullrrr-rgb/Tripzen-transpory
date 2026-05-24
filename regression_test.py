"""TripZen regression test after server.py refactor (21 modules).

Covers items 1-19 in the review request. Reports only failures.
Uses EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env.
"""
import asyncio
import json
import sys
import uuid
from typing import Optional, Any

import httpx
import websockets


def _load_env():
    with open("/app/frontend/.env") as f:
        for line in f:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")


BASE = _load_env()
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

ADMIN = {"email": "admin@tripzen.com", "password": "admin123"}
DRIVER = {"email": "driver@tripzen.com", "password": "driver123"}
PARENT = {"email": "priya@tripzen.com", "password": "parent123"}

FAILS = []
PASSES = []


def record(name: str, ok: bool, detail: str = ""):
    if ok:
        PASSES.append(name)
        print(f"  PASS  {name}  {detail}")
    else:
        FAILS.append((name, detail))
        print(f"  FAIL  {name}  {detail}")


def login(c: httpx.Client, creds) -> str:
    r = c.post(f"{API}/auth/login", json=creds)
    if r.status_code != 200:
        raise RuntimeError(f"login {creds['email']} -> {r.status_code} {r.text}")
    return r.json()["access_token"]


def H(tok: str):
    return {"Authorization": f"Bearer {tok}"}


def main():
    with httpx.Client(timeout=30.0) as c:
        # ---------------- 1. POST /api/auth/login (3 roles) ----------------
        try:
            ra = c.post(f"{API}/auth/login", json=ADMIN)
            record("1a auth/login admin", ra.status_code == 200 and "access_token" in ra.json(),
                   f"status={ra.status_code}")
            admin_tok = ra.json()["access_token"]

            rd = c.post(f"{API}/auth/login", json=DRIVER)
            record("1b auth/login driver", rd.status_code == 200, f"status={rd.status_code}")
            driver_tok = rd.json()["access_token"]

            rp = c.post(f"{API}/auth/login", json=PARENT)
            record("1c auth/login parent", rp.status_code == 200, f"status={rp.status_code}")
            parent_tok = rp.json()["access_token"]
        except Exception as e:
            record("1 auth/login", False, f"exc={e}")
            return

        # ---------------- 2. GET /api/auth/me ----------------
        for label, tok, role in [("admin", admin_tok, "admin"),
                                  ("driver", driver_tok, "driver"),
                                  ("parent", parent_tok, "parent")]:
            r = c.get(f"{API}/auth/me", headers=H(tok))
            j = r.json() if r.status_code == 200 else {}
            record(f"2 auth/me {label}",
                   r.status_code == 200 and j.get("role") == role,
                   f"status={r.status_code} role={j.get('role')}")

        # ---------------- 3. GET /api/students ----------------
        rp = c.get(f"{API}/students", headers=H(parent_tok))
        record("3a students(parent)", rp.status_code == 200 and isinstance(rp.json(), list) and len(rp.json()) >= 1,
               f"status={rp.status_code} count={len(rp.json()) if rp.status_code==200 else 'NA'}")
        student_id = rp.json()[0]["id"]
        student_qr = rp.json()[0]["qr_code"]

        ra = c.get(f"{API}/students", headers=H(admin_tok))
        record("3b students(admin)", ra.status_code == 200 and isinstance(ra.json(), list),
               f"status={ra.status_code} count={len(ra.json()) if ra.status_code==200 else 'NA'}")

        # ---------------- 4. GET /api/routes ----------------
        rr = c.get(f"{API}/routes", headers=H(admin_tok))
        record("4 routes (admin)", rr.status_code == 200 and isinstance(rr.json(), list) and len(rr.json()) >= 1,
               f"status={rr.status_code}")
        routes = rr.json() if rr.status_code == 200 else []
        # pick a route assigned to the driver
        rd_routes = c.get(f"{API}/routes", headers=H(driver_tok))
        driver_routes = rd_routes.json() if rd_routes.status_code == 200 else []
        if not driver_routes:
            record("4b driver routes", False, "no routes for driver")
            return
        route = driver_routes[0]
        route_id = route["id"]

        # ---------------- ensure no active trip exists ----------------
        active = c.get(f"{API}/trips/active", headers=H(driver_tok))
        if active.status_code == 200 and active.json():
            # End any leftover trip(s)
            for t in active.json() if isinstance(active.json(), list) else [active.json()]:
                if t and t.get("id"):
                    c.post(f"{API}/trips/{t['id']}/end", headers=H(driver_tok))

        # ---------------- 5. trips start / location / scan / end ----------------
        rs = c.post(f"{API}/trips/start", json={"route_id": route_id}, headers=H(driver_tok))
        record("5a trips/start", rs.status_code == 200,
               f"status={rs.status_code} body={rs.text[:160]}")
        if rs.status_code != 200:
            return
        trip = rs.json()
        trip_id = trip["id"]

        rl = c.post(f"{API}/trips/{trip_id}/location",
                    json={"lat": 51.5174, "lng": -0.1278},
                    headers=H(driver_tok))
        record("5b trips/{id}/location", rl.status_code == 200, f"status={rl.status_code}")

        rsc = c.post(f"{API}/trips/{trip_id}/scan",
                     json={"qr_code": student_qr, "action": "board"},
                     headers=H(driver_tok))
        record("5c trips/{id}/scan (board)", rsc.status_code == 200,
               f"status={rsc.status_code} body={rsc.text[:160]}")

        # ---------------- 6. GET /api/trips/active ----------------
        rac = c.get(f"{API}/trips/active", headers=H(driver_tok))
        record("6 trips/active (driver)",
               rac.status_code == 200 and rac.json(),
               f"status={rac.status_code}")

        # ---------------- 9. SOS + Incident BEFORE ending the trip ----------------
        rsos = c.post(f"{API}/trips/{trip_id}/sos", json={"message": "Regression SOS"},
                      headers=H(driver_tok))
        record("9a trips/{id}/sos", rsos.status_code == 200, f"status={rsos.status_code}")

        rinc = c.post(f"{API}/trips/{trip_id}/incident",
                      json={"type": "delay", "description": "Regression incident"},
                      headers=H(driver_tok))
        record("9b trips/{id}/incident", rinc.status_code == 200, f"status={rinc.status_code}")

        # ---------------- 14. GET /api/trips/{id}/eta ----------------
        reta = c.get(f"{API}/trips/{trip_id}/eta", headers=H(driver_tok))
        ok = reta.status_code == 200 and "eta_minutes" in reta.json()
        record("14 trips/{id}/eta", ok, f"status={reta.status_code} body={reta.text[:160]}")

        # ---------------- 16. WebSocket /api/ws/trip/{id} ----------------
        async def ws_test():
            url = f"{WS_BASE}/api/ws/trip/{trip_id}"
            try:
                async with websockets.connect(url, open_timeout=15, close_timeout=5) as ws:
                    msg = await asyncio.wait_for(ws.recv(), timeout=10)
                    payload = json.loads(msg)
                    return (payload.get("type") == "snapshot"
                            and payload.get("trip", {}).get("id") == trip_id), payload
            except Exception as e:
                return False, str(e)

        ok, detail = asyncio.run(ws_test())
        record("16 ws/trip/{id} snapshot", ok, f"detail={str(detail)[:200]}")

        # ---------------- 5d trips/{id}/scan checkout + end ----------------
        rsc2 = c.post(f"{API}/trips/{trip_id}/scan",
                      json={"qr_code": student_qr, "action": "checkout"},
                      headers=H(driver_tok))
        record("5d trips/{id}/scan (checkout)", rsc2.status_code == 200, f"status={rsc2.status_code}")

        rend = c.post(f"{API}/trips/{trip_id}/end", headers=H(driver_tok))
        record("5e trips/{id}/end", rend.status_code == 200, f"status={rend.status_code}")

        # ---------------- 7. Bookings + Pay ----------------
        rb1 = c.post(f"{API}/bookings",
                     json={"student_id": student_id, "plan": "single",
                           "route_id": route_id},
                     headers=H(parent_tok))
        record("7a bookings POST single",
               rb1.status_code == 200 and rb1.json().get("amount") == 4.5,
               f"status={rb1.status_code} body={rb1.text[:200]}")
        if rb1.status_code == 200:
            bid = rb1.json()["id"]
            rpay = c.post(f"{API}/bookings/{bid}/pay", headers=H(parent_tok))
            record("7b bookings/{id}/pay", rpay.status_code == 200,
                   f"status={rpay.status_code} body={rpay.text[:160]}")

        # ---------------- 8. Sibling discount on 2nd monthly ----------------
        # Create+pay 1st monthly, then create 2nd monthly and check discount
        rm1 = c.post(f"{API}/bookings",
                     json={"student_id": student_id, "plan": "monthly",
                           "route_id": route_id},
                     headers=H(parent_tok))
        if rm1.status_code == 200:
            bid1 = rm1.json()["id"]
            c.post(f"{API}/bookings/{bid1}/pay", headers=H(parent_tok))
            rm2 = c.post(f"{API}/bookings",
                         json={"student_id": student_id, "plan": "monthly",
                               "route_id": route_id},
                         headers=H(parent_tok))
            if rm2.status_code == 200:
                amt = rm2.json().get("amount")
                # allow either 71.99 (20% discount on 89.99) or close
                ok = isinstance(amt, (int, float)) and abs(amt - 71.99) < 0.05
                record("8 sibling discount on 2nd monthly", ok,
                       f"amount={amt} (expected ~71.99)")
            else:
                record("8 sibling discount on 2nd monthly", False,
                       f"2nd monthly status={rm2.status_code} body={rm2.text[:160]}")
        else:
            record("8 sibling discount setup", False,
                   f"1st monthly status={rm1.status_code} body={rm1.text[:160]}")

        # ---------------- 10. Messages ----------------
        # find driver id
        rusers = c.get(f"{API}/admin/users", headers=H(admin_tok))
        users = rusers.json() if rusers.status_code == 200 else []
        driver_user = next((u for u in users if u.get("role") == "driver"), None)
        if not driver_user:
            record("10 messages setup", False, "no driver user found")
        else:
            driver_id = driver_user["id"]
            rms = c.post(f"{API}/messages",
                         json={"recipient_id": driver_id, "text": "Regression hi"},
                         headers=H(parent_tok))
            record("10a messages POST", rms.status_code == 200, f"status={rms.status_code}")
            rmg = c.get(f"{API}/messages/{driver_id}", headers=H(parent_tok))
            record("10b GET messages/{other}",
                   rmg.status_code == 200 and isinstance(rmg.json(), list),
                   f"status={rmg.status_code} count={len(rmg.json()) if rmg.status_code==200 else 'NA'}")
            rmt = c.get(f"{API}/messages", headers=H(parent_tok))
            record("10c GET messages (threads)",
                   rmt.status_code == 200 and isinstance(rmt.json(), list),
                   f"status={rmt.status_code}")

        # ---------------- 11. Parent weekly summary ----------------
        rws = c.get(f"{API}/parent/weekly-summary/{student_id}", headers=H(parent_tok))
        record("11 parent/weekly-summary/{sid}",
               rws.status_code == 200 and "summary" in rws.json(),
               f"status={rws.status_code} ai_generated={rws.json().get('ai_generated') if rws.status_code==200 else 'NA'}")

        # ---------------- 12. GDPR export ----------------
        rge = c.get(f"{API}/parent/gdpr-export", headers=H(parent_tok))
        if rge.status_code == 200:
            keys = set(rge.json().keys())
            required = {"user", "children", "bookings", "notifications", "messages", "ratings"}
            record("12 parent/gdpr-export",
                   required.issubset(keys),
                   f"keys={keys}")
        else:
            record("12 parent/gdpr-export", False, f"status={rge.status_code}")

        # ---------------- 13. Ratings (after completed trip) ----------------
        # The trip we just ended had the student boarded → eligible
        if driver_user:
            driver_id = driver_user["id"]
            rrt = c.post(f"{API}/ratings",
                         json={"trip_id": trip_id, "driver_id": driver_id,
                               "student_id": student_id, "stars": 5,
                               "feedback": "Regression test"},
                         headers=H(parent_tok))
            record("13 ratings POST", rrt.status_code == 200,
                   f"status={rrt.status_code} body={rrt.text[:200]}")

        # ---------------- 15. Admin endpoints ----------------
        for ep in ["stats", "users", "revenue", "alerts", "incidents"]:
            r = c.get(f"{API}/admin/{ep}", headers=H(admin_tok))
            record(f"15 admin/{ep}", r.status_code == 200, f"status={r.status_code}")

        # ---------------- 17. POST /api/users/push-token ----------------
        rpt = c.post(f"{API}/users/push-token",
                     json={"token": "ExponentPushToken[regress-abc]", "platform": "ios"},
                     headers=H(parent_tok))
        record("17 users/push-token",
               rpt.status_code == 200 and rpt.json().get("ok") is True,
               f"status={rpt.status_code} body={rpt.text[:120]}")

        # ---------------- 18. payment-intent + confirm-payment ----------------
        rb_new = c.post(f"{API}/bookings",
                        json={"student_id": student_id, "plan": "single",
                              "route_id": route_id},
                        headers=H(parent_tok))
        if rb_new.status_code == 200:
            bid_new = rb_new.json()["id"]
            rpi = c.post(f"{API}/bookings/{bid_new}/payment-intent", headers=H(parent_tok))
            ok = (rpi.status_code == 200 and rpi.json().get("mocked") is True
                  and str(rpi.json().get("client_secret", "")).startswith("pi_mock_"))
            record("18a payment-intent (mocked)", ok,
                   f"status={rpi.status_code} body={rpi.text[:200]}")
            rcp = c.post(f"{API}/bookings/{bid_new}/confirm-payment", headers=H(parent_tok))
            record("18b confirm-payment",
                   rcp.status_code == 200 and rcp.json().get("ok") is True,
                   f"status={rcp.status_code} body={rcp.text[:160]}")
        else:
            record("18 payment-intent setup", False,
                   f"create booking status={rb_new.status_code}")

        # ---------------- 19. WhatsApp (mocked) ----------------
        rwa = c.post(f"{API}/notifications/whatsapp",
                     json={"to_phone": "+447700900222", "message": "Regression WA"},
                     headers=H(admin_tok))
        ok = (rwa.status_code == 200 and rwa.json().get("ok") is True
              and rwa.json().get("mocked") is True)
        record("19 notifications/whatsapp (mocked)", ok,
               f"status={rwa.status_code} body={rwa.text[:160]}")

    # ---------------- SUMMARY ----------------
    print("\n" + "=" * 70)
    print(f"PASSED: {len(PASSES)}    FAILED: {len(FAILS)}")
    if FAILS:
        print("\nFAILURES:")
        for n, d in FAILS:
            print(f"  - {n}: {d}")
        sys.exit(1)
    else:
        print("\nALL PASS — refactor clean")
        sys.exit(0)


if __name__ == "__main__":
    main()
