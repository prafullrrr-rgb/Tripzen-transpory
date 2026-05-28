"""TripZen v1.1 Enhancement Endpoint Tests.

Tests the new endpoints in /app/backend/routes/enhancements.py plus a regression
smoke. Uses the public EXPO_PUBLIC_BACKEND_URL/api base.
"""
import os
import sys
from typing import Optional

import httpx

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://app-builder-demo-60.preview.emergentagent.com")
API = f"{BASE.rstrip('/')}/api"

ADMIN = ("admin@tripzen.com", "admin123")
DRIVER = ("driver@tripzen.com", "driver123")
PARENT = ("priya@tripzen.com", "parent123")

results: list = []


def log(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}{(' — ' + detail) if detail else ''}")
    results.append((name, ok, detail))


def login(email: str, password: str) -> Optional[str]:
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{API}/auth/login", json={"email": email, "password": password})
        if r.status_code != 200:
            log(f"login {email}", False, f"status={r.status_code} body={r.text[:200]}")
            return None
        return r.json().get("access_token")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def main():
    print(f"\n=== TripZen v1.1 Enhancement Test ===\nAPI = {API}\n")

    admin_tok = login(*ADMIN)
    driver_tok = login(*DRIVER)
    parent_tok = login(*PARENT)
    if not (admin_tok and driver_tok and parent_tok):
        print("FATAL: cannot login one or more roles; aborting.")
        sys.exit(1)
    log("login admin/driver/parent", True)

    with httpx.Client(timeout=30) as c:
        # Driver id
        r = c.get(f"{API}/admin/users", headers=auth(admin_tok))
        if r.status_code != 200:
            log("GET /admin/users", False, f"{r.status_code} {r.text[:200]}")
            sys.exit(1)
        users = r.json()
        driver = next((u for u in users if u["role"] == "driver" and u["email"] == DRIVER[0]), None)
        if not driver:
            log("find seeded driver", False, "no driver with seed email")
            sys.exit(1)
        driver_id = driver["id"]
        log("find driver via /admin/users", True, f"driver_id={driver_id[:8]}…")

        # ===== 1) GET /api/driver-info/{driver_id} =====
        r = c.get(f"{API}/driver-info/{driver_id}", headers=auth(parent_tok))
        if r.status_code != 200:
            log("GET /driver-info/{id} (parent)", False, f"{r.status_code} {r.text[:300]}")
        else:
            data = r.json()
            expected_keys = {
                "full_name", "license_number", "vehicle_plate", "years_driving",
                "verified", "average_rating", "total_ratings", "completed_trips",
            }
            missing = expected_keys - set(data.keys())
            if missing:
                log("GET /driver-info/{id} fields", False, f"missing keys: {missing}")
            elif data.get("verified") is not True:
                log("GET /driver-info/{id} verified", False, f"verified={data.get('verified')}")
            else:
                log("GET /driver-info/{id} (parent)", True,
                    f"full_name={data['full_name']}, avg={data['average_rating']}, trips={data['completed_trips']}")

        # ===== 2) PUT /api/driver-info/me =====
        update_body = {"license_number": "DL-12345", "vehicle_plate": "BV70-XYZ", "years_driving": 5}
        r = c.put(f"{API}/driver-info/me", headers=auth(driver_tok), json=update_body)
        if r.status_code != 200:
            log("PUT /driver-info/me", False, f"{r.status_code} {r.text[:300]}")
        else:
            data = r.json()
            if data.get("ok") is True and data.get("updated") == 3:
                log("PUT /driver-info/me", True, str(data))
            else:
                log("PUT /driver-info/me", False, f"unexpected response: {data}")

        # Verify persistence
        r = c.get(f"{API}/driver-info/{driver_id}", headers=auth(parent_tok))
        if r.status_code == 200:
            d = r.json()
            persisted = (
                d.get("license_number") == "DL-12345"
                and d.get("vehicle_plate") == "BV70-XYZ"
                and d.get("years_driving") == 5
            )
            log("driver-info persistence", persisted,
                f"license={d.get('license_number')}, plate={d.get('vehicle_plate')}, yrs={d.get('years_driving')}")
        else:
            log("driver-info persistence GET", False, f"{r.status_code}")

        # ===== 3) POST /api/bookings/{bid}/cancel =====
        r = c.get(f"{API}/students", headers=auth(parent_tok))
        students = r.json() if r.status_code == 200 else []
        if not students:
            log("preflight: parent has students", False)
            sys.exit(1)
        student = students[0]
        student_id = student["id"]
        route_id = student.get("route_id")
        if not route_id:
            rr = c.get(f"{API}/routes", headers=auth(admin_tok))
            if rr.status_code == 200 and rr.json():
                route_id = rr.json()[0]["id"]
        if not route_id:
            log("preflight: route exists", False)
            sys.exit(1)

        # Create single booking, pay, cancel
        r = c.post(f"{API}/bookings", headers=auth(parent_tok),
                   json={"student_id": student_id, "route_id": route_id, "plan": "single"})
        if r.status_code != 200:
            log("create booking (single)", False, f"{r.status_code} {r.text[:200]}")
            sys.exit(1)
        booking = r.json()
        bid_to_cancel = booking["id"]
        amount = booking["amount"]
        log("create booking (single)", True, f"id={bid_to_cancel[:8]}…, amount=£{amount}")

        r = c.post(f"{API}/bookings/{bid_to_cancel}/pay", headers=auth(parent_tok))
        if r.status_code != 200:
            log("pay booking", False, f"{r.status_code} {r.text[:200]}")
            sys.exit(1)
        log("pay booking", True, f"amount=£{r.json().get('amount')}")

        r = c.post(
            f"{API}/bookings/{bid_to_cancel}/cancel",
            headers=auth(parent_tok),
            json={"reason": "Sick day", "refund_pct": 80},
        )
        if r.status_code != 200:
            log("POST /bookings/{bid}/cancel", False, f"{r.status_code} {r.text[:300]}")
        else:
            data = r.json()
            expected_refund = round(amount * 0.80, 2)
            expected_kept = round(amount - expected_refund, 2)
            ok = (
                data.get("ok") is True
                and abs(data.get("refund_amount", 0) - expected_refund) < 0.01
                and abs(data.get("non_refunded_amount", 0) - expected_kept) < 0.01
            )
            log("POST /bookings/{bid}/cancel (80% refund math)", ok,
                f"amount=£{amount} -> refund={data.get('refund_amount')}, kept={data.get('non_refunded_amount')} "
                f"(expected refund={expected_refund}, kept={expected_kept})")

        # Optionally also verify £89.99 -> 71.99 / 18.00 if no prior paid monthly
        r = c.get(f"{API}/bookings", headers=auth(parent_tok))
        prior_paid_monthly = sum(1 for b in (r.json() or [])
                                 if b.get("status") == "paid" and b.get("plan") == "monthly")
        if prior_paid_monthly == 0:
            r = c.post(f"{API}/bookings", headers=auth(parent_tok),
                       json={"student_id": student_id, "route_id": route_id, "plan": "monthly"})
            if r.status_code == 200 and r.json().get("amount") == 89.99:
                m_bid = r.json()["id"]
                c.post(f"{API}/bookings/{m_bid}/pay", headers=auth(parent_tok))
                r2 = c.post(f"{API}/bookings/{m_bid}/cancel", headers=auth(parent_tok),
                            json={"reason": "Test 89.99 case", "refund_pct": 80})
                if r2.status_code == 200:
                    d = r2.json()
                    ok89 = abs(d.get("refund_amount", 0) - 71.99) < 0.01 and abs(d.get("non_refunded_amount", 0) - 18.0) < 0.01
                    log("cancel £89.99 monthly 80% (71.99/18.00)", ok89, str(d))
                else:
                    log("cancel £89.99 monthly 80%", False, f"{r2.status_code} {r2.text[:200]}")
        else:
            log("£89.99 monthly cancellation scenario", True,
                f"SKIPPED — parent has {prior_paid_monthly} prior paid monthly (sibling discount applies). Generic 80% math verified above.")

        # ===== 4) POST /api/bookings/{bid}/skip-day =====
        r = c.post(f"{API}/bookings", headers=auth(parent_tok),
                   json={"student_id": student_id, "route_id": route_id, "plan": "single"})
        skip_bid = r.json()["id"] if r.status_code == 200 else None
        if skip_bid:
            c.post(f"{API}/bookings/{skip_bid}/pay", headers=auth(parent_tok))
            r = c.post(f"{API}/bookings/{skip_bid}/skip-day",
                       headers=auth(parent_tok),
                       json={"date": "2025-12-15", "reason": "Sick day"})
            if r.status_code != 200:
                log("POST /bookings/{bid}/skip-day", False, f"{r.status_code} {r.text[:300]}")
            else:
                data = r.json()
                ok = data.get("ok") is True and data.get("skip_date") == "2025-12-15"
                log("POST /bookings/{bid}/skip-day", ok, str(data))
        else:
            log("preflight: create booking for skip-day", False)

        # ===== 5) GET /api/admin/cancellations =====
        r = c.get(f"{API}/admin/cancellations", headers=auth(admin_tok))
        if r.status_code != 200:
            log("GET /admin/cancellations", False, f"{r.status_code} {r.text[:300]}")
        else:
            data = r.json()
            summary = data.get("summary", {})
            cancellations = data.get("cancellations", [])
            required_summary_keys = {"total_cancellations", "total_paid", "total_refunded", "total_kept", "currency"}
            missing_keys = required_summary_keys - set(summary.keys())
            if missing_keys:
                log("GET /admin/cancellations summary keys", False, f"missing: {missing_keys}")
            elif summary.get("currency") != "GBP":
                log("GET /admin/cancellations currency", False, f"currency={summary.get('currency')}")
            elif summary.get("total_cancellations", 0) < 1:
                log("GET /admin/cancellations totals", False,
                    f"total_cancellations={summary.get('total_cancellations')} (expected >=1)")
            else:
                first = cancellations[0] if cancellations else {}
                enrich = {"parent_name", "parent_email", "student_name", "route_name",
                          "paid_amount", "refund_amount", "kept_amount"}
                missing_enrich = enrich - set(first.keys())
                if missing_enrich:
                    log("GET /admin/cancellations enrichment fields", False, f"missing: {missing_enrich}")
                else:
                    log("GET /admin/cancellations", True,
                        f"total={summary['total_cancellations']}, paid=£{summary['total_paid']}, "
                        f"refunded=£{summary['total_refunded']}, kept=£{summary['total_kept']}; "
                        f"sample: parent={first.get('parent_name')}, student={first.get('student_name')}, route={first.get('route_name')}")

        # ===== 6) GET /api/parent/today/{student_id} =====
        r = c.get(f"{API}/parent/today/{student_id}", headers=auth(parent_tok))
        if r.status_code != 200:
            log("GET /parent/today/{student_id}", False, f"{r.status_code} {r.text[:300]}")
        else:
            data = r.json()
            required = {"student", "trip", "status", "events_today", "status_label"}
            missing = required - set(data.keys())
            valid_status = {"home", "waiting", "on_bus", "dropped_off"}
            if missing:
                log("GET /parent/today fields", False, f"missing: {missing}")
            elif data.get("status") not in valid_status:
                log("GET /parent/today status value", False,
                    f"status={data.get('status')} not in {valid_status}")
            else:
                log("GET /parent/today/{student_id}", True,
                    f"status={data['status']} ({data['status_label']}), events={len(data['events_today'])}")

        # ===== 7) POST /api/trips/{trip_id}/notify-approaching =====
        r = c.get(f"{API}/routes", headers=auth(driver_tok))
        driver_routes = r.json() if r.status_code == 200 else []
        trip_id_for_smoke = None
        if not driver_routes:
            log("preflight: driver has routes", False)
        else:
            driver_route_id = driver_routes[0]["id"]
            r = c.post(f"{API}/trips/start", headers=auth(driver_tok), json={"route_id": driver_route_id})
            if r.status_code != 200:
                log("start trip", False, f"{r.status_code} {r.text[:200]}")
            else:
                trip = r.json()
                trip_id_for_smoke = trip["id"]
                log("start trip", True, f"trip_id={trip_id_for_smoke[:8]}…")

                r = c.post(f"{API}/trips/{trip_id_for_smoke}/notify-approaching", headers=auth(driver_tok))
                if r.status_code != 200:
                    log("POST /trips/{id}/notify-approaching", False, f"{r.status_code} {r.text[:300]}")
                else:
                    data = r.json()
                    required = {"ok", "notified", "stop"}
                    missing = required - set(data.keys())
                    if missing:
                        log("notify-approaching fields", False, f"missing: {missing} body={data}")
                    elif data.get("ok") is not True:
                        log("notify-approaching ok flag", False, str(data))
                    else:
                        log("POST /trips/{id}/notify-approaching", True,
                            f"notified={data['notified']}, stop={data['stop']}")

        # ===== 8) Regression smoke =====
        r = c.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]})
        log("REGRESSION: POST /auth/login (admin)", r.status_code == 200, f"status={r.status_code}")

        r = c.get(f"{API}/admin/stats", headers=auth(admin_tok))
        log("REGRESSION: GET /admin/stats", r.status_code == 200, f"status={r.status_code}")

        r = c.get(f"{API}/trips/active", headers=auth(driver_tok))
        ok = r.status_code == 200 and isinstance(r.json(), list)
        log("REGRESSION: GET /trips/active (driver)", ok,
            f"status={r.status_code}, count={len(r.json()) if ok else 'n/a'}")

        if trip_id_for_smoke:
            r = c.post(f"{API}/trips/{trip_id_for_smoke}/sos", headers=auth(driver_tok))
            if r.status_code == 200:
                d = r.json()
                log("REGRESSION: POST /trips/{id}/sos", d.get("ok") is True, str(d))
            else:
                log("REGRESSION: POST /trips/{id}/sos", False, f"{r.status_code} {r.text[:200]}")
            # cleanup
            c.post(f"{API}/trips/{trip_id_for_smoke}/end", headers=auth(driver_tok))
        else:
            log("REGRESSION: POST /trips/{id}/sos", False, "no active trip to test SOS on")

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"Total: {len(results)}  Pass: {passed}  Fail: {failed}")
    if failed:
        print("\nFAILURES:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
