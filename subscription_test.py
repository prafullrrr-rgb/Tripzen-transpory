"""Backend test suite for the new subscription endpoints.

Endpoints under test (all prefixed /api):
  - GET  /plans                       (public)
  - GET  /plans?track=school|operator
  - GET  /plans/{plan_id}
  - POST /subscriptions               (admin)
  - GET  /subscriptions/me            (admin)
  - POST /subscriptions/{sub_id}/upgrade
  - POST /subscriptions/{sub_id}/cancel
  - Role enforcement (parent → 403)
  - Duplicate active subscription → 400
"""

import os
import sys
import json
from datetime import datetime, timezone, timedelta

import requests
from dotenv import dotenv_values

ENV = dotenv_values("/app/frontend/.env")
BASE = (ENV.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL", "")).rstrip("/")
if not BASE:
    print("FATAL: EXPO_PUBLIC_BACKEND_URL not set in /app/frontend/.env")
    sys.exit(2)
API = f"{BASE}/api"
print(f"Testing against: {API}")

results = []  # list of (name, ok, detail)


def record(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}  {detail}")
    results.append((name, ok, detail))


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    admin_token = login("admin@tripzen.com", "admin123")
    parent_token = login("priya@tripzen.com", "parent123")
    print("Logins OK\n")

    # 1. GET /plans (no auth)
    print("Test 1: GET /api/plans (no auth)")
    r = requests.get(f"{API}/plans", timeout=15)
    if r.status_code != 200:
        record("1. GET /plans status 200", False, f"status={r.status_code}")
    else:
        data = r.json()
        plans = data.get("plans", [])
        ok_basic = (
            data.get("trial_days") == 30
            and data.get("currency") == "GBP"
            and isinstance(plans, list)
            and len(plans) == 7
        )
        record("1a. GET /plans returns 7 plans, trial_days=30, GBP", ok_basic,
               f"len={len(plans)} trial_days={data.get('trial_days')} currency={data.get('currency')}")
        # Tracks count
        s = sum(1 for p in plans if p.get("track") == "school")
        o = sum(1 for p in plans if p.get("track") == "operator")
        pa = sum(1 for p in plans if p.get("track") == "parent")
        record("1b. Track distribution 3 school + 3 operator + 1 parent",
               s == 3 and o == 3 and pa == 1, f"school={s} operator={o} parent={pa}")
        # Field check on first plan
        required_fields = {"id", "name", "track", "price_monthly", "price_annual",
                           "currency", "features", "highlight"}
        sample = plans[0]
        missing = required_fields - set(sample.keys())
        record("1c. Plan has required fields", not missing,
               f"missing={missing}" if missing else f"sample_id={sample.get('id')}")
        # features is a list
        record("1d. features is array", isinstance(sample.get("features"), list),
               f"type={type(sample.get('features')).__name__}")

    # 2. GET /plans?track=school
    print("\nTest 2: GET /api/plans?track=school")
    r = requests.get(f"{API}/plans", params={"track": "school"}, timeout=15)
    if r.status_code != 200:
        record("2. GET /plans?track=school status 200", False, f"status={r.status_code}")
    else:
        plans = r.json().get("plans", [])
        ok_count = len(plans) == 3 and all(p["track"] == "school" for p in plans)
        record("2a. Exactly 3 school plans", ok_count, f"len={len(plans)}")
        by_id = {p["id"]: p for p in plans}
        starter = by_id.get("school_starter")
        growth = by_id.get("school_growth")
        ent = by_id.get("school_enterprise")
        record("2b. school_starter price_monthly=199",
               bool(starter) and starter["price_monthly"] == 199.00,
               f"price={starter.get('price_monthly') if starter else None}")
        record("2c. school_growth price_monthly=499 highlight=true",
               bool(growth) and growth["price_monthly"] == 499.00 and growth["highlight"] is True,
               f"price={growth.get('price_monthly') if growth else None} highlight={growth.get('highlight') if growth else None}")
        record("2d. school_enterprise price_monthly=1499",
               bool(ent) and ent["price_monthly"] == 1499.00,
               f"price={ent.get('price_monthly') if ent else None}")

    # 3. GET /plans?track=operator
    print("\nTest 3: GET /api/plans?track=operator")
    r = requests.get(f"{API}/plans", params={"track": "operator"}, timeout=15)
    if r.status_code != 200:
        record("3. GET /plans?track=operator status 200", False, f"status={r.status_code}")
    else:
        plans = r.json().get("plans", [])
        ok_count = len(plans) == 3 and all(p["track"] == "operator" for p in plans)
        record("3a. Exactly 3 operator plans", ok_count, f"len={len(plans)}")
        by_id = {p["id"]: p for p in plans}
        solo = by_id.get("fleet_solo")
        growth = by_id.get("fleet_growth")
        ent = by_id.get("fleet_enterprise")
        record("3b. fleet_solo present", bool(solo), f"present={bool(solo)}")
        record("3c. fleet_growth per_bus=true highlight=true",
               bool(growth) and growth.get("per_bus") is True and growth.get("highlight") is True,
               f"per_bus={growth.get('per_bus') if growth else None} highlight={growth.get('highlight') if growth else None}")
        record("3d. fleet_enterprise present", bool(ent), f"present={bool(ent)}")

    # 4. GET /plans/school_growth
    print("\nTest 4: GET /api/plans/school_growth")
    r = requests.get(f"{API}/plans/school_growth", timeout=15)
    if r.status_code != 200:
        record("4. GET /plans/school_growth status 200", False, f"status={r.status_code}")
    else:
        p = r.json()
        record("4a. price_monthly=499.00",
               p.get("price_monthly") == 499.00, f"got={p.get('price_monthly')}")
        record("4b. price_annual=4790.00",
               p.get("price_annual") == 4790.00, f"got={p.get('price_annual')}")
        record("4c. max_students=500",
               p.get("max_students") == 500, f"got={p.get('max_students')}")

    # PRE-CLEANUP: Cancel any pre-existing active/trial subscription for admin
    print("\nPre-cleanup: cancel any existing trial/active subscription for admin")
    r = requests.get(f"{API}/subscriptions/me", headers=hdr(admin_token), timeout=15)
    if r.status_code == 200 and r.json().get("subscription"):
        existing = r.json()["subscription"]
        if existing.get("status") in ("trial", "active"):
            cancel_r = requests.post(f"{API}/subscriptions/{existing['id']}/cancel",
                                     headers=hdr(admin_token), timeout=15)
            print(f"  Cleanup: cancelled existing sub {existing['id']} → {cancel_r.status_code}")

    # 5. POST /subscriptions (admin)
    print("\nTest 5: POST /api/subscriptions (admin) — school_growth monthly")
    body = {"plan_id": "school_growth", "billing_cycle": "monthly", "org_name": "Test School"}
    r = requests.post(f"{API}/subscriptions", json=body, headers=hdr(admin_token), timeout=15)
    sub_id = None
    if r.status_code != 200:
        record("5. POST /subscriptions status 200", False,
               f"status={r.status_code} body={r.text[:300]}")
    else:
        s = r.json()
        sub_id = s.get("id")
        record("5a. Status 200 and id present", bool(sub_id), f"id={sub_id}")
        record("5b. plan_id=school_growth", s.get("plan_id") == "school_growth",
               f"got={s.get('plan_id')}")
        record("5c. plan_name=Growth", s.get("plan_name") == "Growth",
               f"got={s.get('plan_name')}")
        record("5d. track=school", s.get("track") == "school", f"got={s.get('track')}")
        record("5e. status=trial", s.get("status") == "trial", f"got={s.get('status')}")
        record("5f. amount=499.00", s.get("amount") == 499.00, f"got={s.get('amount')}")
        # trial_end ~30 days in future
        te = s.get("trial_end")
        try:
            te_dt = datetime.fromisoformat(te.replace("Z", "+00:00")) if te else None
            now = datetime.now(timezone.utc)
            delta_days = (te_dt - now).days if te_dt else None
            ok_trial = te_dt is not None and 28 <= delta_days <= 31
            record("5g. trial_end ~30 days in future", ok_trial,
                   f"trial_end={te} delta_days={delta_days}")
        except Exception as e:
            record("5g. trial_end ~30 days in future", False, f"parse error: {e}")

    # 6. GET /subscriptions/me
    print("\nTest 6: GET /api/subscriptions/me (admin)")
    r = requests.get(f"{API}/subscriptions/me", headers=hdr(admin_token), timeout=15)
    if r.status_code != 200:
        record("6. GET /subscriptions/me status 200", False, f"status={r.status_code}")
    else:
        data = r.json()
        sub = data.get("subscription")
        record("6a. subscription returned with same id",
               bool(sub) and sub.get("id") == sub_id, f"id={sub.get('id') if sub else None}")
        record("6b. trial_available=false", data.get("trial_available") is False,
               f"got={data.get('trial_available')}")

    # 7. POST /subscriptions/{sub_id}/upgrade
    print("\nTest 7: POST /api/subscriptions/{sub_id}/upgrade → school_enterprise annual")
    if not sub_id:
        record("7. upgrade (skipped, no sub_id)", False, "no subscription created")
    else:
        upbody = {"new_plan_id": "school_enterprise", "billing_cycle": "annual"}
        r = requests.post(f"{API}/subscriptions/{sub_id}/upgrade", json=upbody,
                          headers=hdr(admin_token), timeout=15)
        if r.status_code != 200:
            record("7. upgrade status 200", False,
                   f"status={r.status_code} body={r.text[:300]}")
        else:
            j = r.json()
            record("7a. ok=true", j.get("ok") is True, f"got={j.get('ok')}")
            record("7b. new_plan=Enterprise", j.get("new_plan") == "Enterprise",
                   f"got={j.get('new_plan')}")
            record("7c. amount=14390.00", j.get("amount") == 14390.00, f"got={j.get('amount')}")

    # 8. POST /subscriptions/{sub_id}/cancel
    print("\nTest 8: POST /api/subscriptions/{sub_id}/cancel (admin)")
    if not sub_id:
        record("8. cancel (skipped)", False, "no subscription created")
    else:
        r = requests.post(f"{API}/subscriptions/{sub_id}/cancel",
                          headers=hdr(admin_token), timeout=15)
        if r.status_code != 200:
            record("8. cancel status 200", False, f"status={r.status_code}")
        else:
            record("8a. ok=true", r.json().get("ok") is True, f"got={r.json()}")
        # Verify via /me
        r2 = requests.get(f"{API}/subscriptions/me", headers=hdr(admin_token), timeout=15)
        if r2.status_code == 200 and r2.json().get("subscription"):
            status = r2.json()["subscription"].get("status")
            record("8b. /me status=cancelled", status == "cancelled", f"got={status}")
        else:
            record("8b. /me status=cancelled", False, f"resp={r2.status_code} {r2.text[:200]}")

    # 9. Role enforcement: parent POST /subscriptions → 403
    print("\nTest 9: Role enforcement — parent POST /api/subscriptions should be 403")
    pbody = {"plan_id": "school_starter", "billing_cycle": "monthly"}
    r = requests.post(f"{API}/subscriptions", json=pbody, headers=hdr(parent_token), timeout=15)
    record("9. parent → 403", r.status_code == 403, f"status={r.status_code} body={r.text[:160]}")

    # 10. Duplicate subscription
    print("\nTest 10: Duplicate subscription blocked while one is trial/active")
    # Step 10a: create one (admin) — after our cancel above, no active sub exists
    r = requests.post(f"{API}/subscriptions",
                      json={"plan_id": "school_starter", "billing_cycle": "monthly",
                            "org_name": "Dup Test School"},
                      headers=hdr(admin_token), timeout=15)
    new_sub_id = None
    if r.status_code != 200:
        record("10a. First create succeeds", False,
               f"status={r.status_code} body={r.text[:300]}")
    else:
        new_sub_id = r.json().get("id")
        record("10a. First create succeeds (status=trial)",
               r.json().get("status") == "trial", f"id={new_sub_id}")
    # Step 10b: second create should 400
    r2 = requests.post(f"{API}/subscriptions",
                       json={"plan_id": "school_growth", "billing_cycle": "monthly"},
                       headers=hdr(admin_token), timeout=15)
    is_400 = r2.status_code == 400
    msg_ok = "already" in r2.text.lower() and "active" in r2.text.lower()
    record("10b. Second create returns 400 'already has an active subscription'",
           is_400 and msg_ok, f"status={r2.status_code} body={r2.text[:200]}")

    # Cleanup: cancel the dup test subscription
    if new_sub_id:
        requests.post(f"{API}/subscriptions/{new_sub_id}/cancel",
                      headers=hdr(admin_token), timeout=15)
        print(f"  Final cleanup: cancelled {new_sub_id}")

    # Summary
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed}/{total} PASSED")
    print("=" * 60)
    if passed < total:
        print("\nFailures:")
        for name, ok, detail in results:
            if not ok:
                print(f"  [FAIL] {name} — {detail}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
