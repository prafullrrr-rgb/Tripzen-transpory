"""Backend tests for new admin broadcast + QR badge endpoints and lowered prices."""
import os
import sys
import json
import requests

BASE = "https://app-builder-demo-60.preview.emergentagent.com/api"

ADMIN = ("admin@tripzen.com", "admin123")
PARENT = ("priya@tripzen.com", "parent123")

results = []


def log(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{mark}] {name} :: {detail}")


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # ----- LOGIN -----
    try:
        admin_tok = login(*ADMIN)
        parent_tok = login(*PARENT)
        log("login admin+parent", True, "tokens acquired")
    except Exception as e:
        log("login admin+parent", False, str(e))
        return

    # 1) GET /admin/broadcast/templates
    try:
        r = requests.get(f"{BASE}/admin/broadcast/templates", headers=H(admin_tok), timeout=20)
        ok = r.status_code == 200
        data = r.json() if ok else {}
        tpls = data.get("templates", []) if ok else []
        ids = {t.get("id") for t in tpls}
        expected = {"snow_day", "strike_day", "early_close", "holiday_reminder", "route_change", "delay"}
        ok = ok and len(tpls) == 6 and expected.issubset(ids)
        if ok:
            for t in tpls:
                if not all(k in t for k in ("id", "title", "body", "icon")):
                    ok = False
                    break
        log("GET /admin/broadcast/templates (6 tpls w/ id,title,body,icon)", ok,
            f"status={r.status_code}, count={len(tpls)}, ids={sorted(ids)}")
    except Exception as e:
        log("GET /admin/broadcast/templates", False, str(e))

    # Get total parent count from /admin/stats
    parent_count = None
    try:
        r = requests.get(f"{BASE}/admin/stats", headers=H(admin_tok), timeout=20)
        if r.status_code == 200:
            parent_count = r.json().get("total_parents")
        log("GET /admin/stats (smoke)", r.status_code == 200, f"total_parents={parent_count}")
    except Exception as e:
        log("GET /admin/stats", False, str(e))

    # 2) POST /admin/broadcast template_id=snow_day
    try:
        r = requests.post(f"{BASE}/admin/broadcast", headers=H(admin_tok),
                          json={"template_id": "snow_day"}, timeout=30)
        ok = r.status_code == 200
        data = r.json() if ok else {}
        sent = data.get("sent")
        title = data.get("title", "")
        cond = (data.get("ok") is True
                and "Snow Day" in title
                and isinstance(sent, int)
                and (parent_count is None or sent == parent_count))
        log("POST /admin/broadcast template_id=snow_day", ok and cond,
            f"status={r.status_code}, sent={sent}, title={title!r}, parents={parent_count}")
    except Exception as e:
        log("POST /admin/broadcast snow_day", False, str(e))

    # 3) POST /admin/broadcast custom
    try:
        r = requests.post(f"{BASE}/admin/broadcast", headers=H(admin_tok),
                          json={"title": "Test Custom", "body": "Hello parents", "icon": "megaphone"},
                          timeout=30)
        ok = r.status_code == 200
        data = r.json() if ok else {}
        cond = (data.get("ok") is True
                and data.get("title") == "Test Custom"
                and isinstance(data.get("sent"), int))
        log("POST /admin/broadcast custom title/body", ok and cond,
            f"status={r.status_code}, data={data}")
    except Exception as e:
        log("POST /admin/broadcast custom", False, str(e))

    # 4) POST /admin/broadcast empty body -> 400
    try:
        r = requests.post(f"{BASE}/admin/broadcast", headers=H(admin_tok), json={}, timeout=20)
        ok = r.status_code == 400
        body_txt = r.text
        cond = "Either template_id" in body_txt or "title+body" in body_txt or "required" in body_txt.lower()
        log("POST /admin/broadcast empty -> 400", ok and cond,
            f"status={r.status_code}, body={body_txt[:200]}")
    except Exception as e:
        log("POST /admin/broadcast empty", False, str(e))

    # 5) GET /admin/students/qr-bulk
    try:
        r = requests.get(f"{BASE}/admin/students/qr-bulk", headers=H(admin_tok), timeout=20)
        ok = r.status_code == 200
        data = r.json() if ok else {}
        cards = data.get("cards", [])
        cnt = data.get("count")
        required = {"student_id", "student_name", "grade", "school", "qr_code", "route_name"}
        if cards:
            missing = required - set(cards[0].keys())
            cond = ok and isinstance(cnt, int) and cnt == len(cards) and not missing
            log("GET /admin/students/qr-bulk", cond,
                f"status={r.status_code}, count={cnt}, len(cards)={len(cards)}, missing_keys={missing}")
        else:
            log("GET /admin/students/qr-bulk", ok and cnt == 0,
                f"status={r.status_code}, no cards present, count={cnt}")
    except Exception as e:
        log("GET /admin/students/qr-bulk", False, str(e))

    # 6) GET /admin/students/{id}/qr-card
    student_id = None
    try:
        r = requests.get(f"{BASE}/students", headers=H(admin_tok), timeout=20)
        if r.status_code == 200 and r.json():
            student_id = r.json()[0]["id"]
    except Exception as e:
        log("GET /students (lookup)", False, str(e))

    if student_id:
        try:
            r = requests.get(f"{BASE}/admin/students/{student_id}/qr-card",
                             headers=H(admin_tok), timeout=20)
            ok = r.status_code == 200
            data = r.json() if ok else {}
            required = {"student_id", "student_name", "grade", "school", "qr_code",
                        "route_name", "parent_name", "parent_phone", "issued_date"}
            missing = required - set(data.keys())
            log("GET /admin/students/{id}/qr-card", ok and not missing,
                f"status={r.status_code}, missing={missing}, qr={data.get('qr_code')}")
        except Exception as e:
            log("GET /admin/students/{id}/qr-card", False, str(e))
    else:
        log("GET /admin/students/{id}/qr-card", False, "no student_id available")

    # 7) Parent role enforcement
    try:
        r = requests.post(f"{BASE}/admin/broadcast", headers=H(parent_tok),
                          json={"template_id": "delay"}, timeout=20)
        log("Parent POST /admin/broadcast -> 403", r.status_code == 403,
            f"status={r.status_code}")
    except Exception as e:
        log("Parent POST /admin/broadcast", False, str(e))
    try:
        r = requests.get(f"{BASE}/admin/broadcast/templates", headers=H(parent_tok), timeout=20)
        log("Parent GET /admin/broadcast/templates -> 403", r.status_code == 403,
            f"status={r.status_code}")
    except Exception as e:
        log("Parent GET /admin/broadcast/templates", False, str(e))

    # 8) REGRESSION — lowered subscription prices
    # School plans
    try:
        r = requests.get(f"{BASE}/plans?track=school", timeout=20)
        ok = r.status_code == 200
        plans = {p["id"]: p for p in r.json().get("plans", [])} if ok else {}
        s = plans.get("school_starter") or {}
        g = plans.get("school_growth") or {}
        e_ = plans.get("school_enterprise") or {}
        cond_s = s.get("price_monthly") == 29.00 and s.get("price_annual") == 290.00
        cond_g = g.get("price_monthly") == 79.00 and g.get("price_annual") == 790.00 and g.get("highlight") is True
        cond_e = e_.get("price_monthly") == 199.00 and e_.get("name") == "Pro"
        log("GET /plans?track=school (lowered prices)", ok and cond_s and cond_g and cond_e,
            f"starter={s.get('price_monthly')}/{s.get('price_annual')}, "
            f"growth={g.get('price_monthly')}/{g.get('price_annual')} hl={g.get('highlight')}, "
            f"pro={e_.get('price_monthly')} name={e_.get('name')}")
    except Exception as ex:
        log("GET /plans?track=school", False, str(ex))

    # Operator plans
    try:
        r = requests.get(f"{BASE}/plans?track=operator", timeout=20)
        ok = r.status_code == 200
        plans = {p["id"]: p for p in r.json().get("plans", [])} if ok else {}
        solo = plans.get("fleet_solo") or {}
        growth = plans.get("fleet_growth") or {}
        ent = plans.get("fleet_enterprise") or {}
        cond_solo = solo.get("price_monthly") == 19.00
        cond_growth = growth.get("price_monthly") == 15.00 and growth.get("per_bus") is True
        cond_ent = ent.get("price_monthly") == 299.00 and ent.get("name") == "Pro Fleet"
        log("GET /plans?track=operator (lowered prices)", ok and cond_solo and cond_growth and cond_ent,
            f"solo={solo.get('price_monthly')}, "
            f"growth={growth.get('price_monthly')} per_bus={growth.get('per_bus')}, "
            f"pro_fleet={ent.get('price_monthly')} name={ent.get('name')}")
    except Exception as ex:
        log("GET /plans?track=operator", False, str(ex))

    # Parent plans
    try:
        r = requests.get(f"{BASE}/plans?track=parent", timeout=20)
        ok = r.status_code == 200
        plans = {p["id"]: p for p in r.json().get("plans", [])} if ok else {}
        free = plans.get("parent_free") or {}
        monthly = plans.get("parent_monthly") or {}
        cond_free = free.get("price_monthly") == 0.00
        cond_monthly = monthly.get("price_monthly") == 4.99
        log("GET /plans?track=parent (free + £4.99)", ok and cond_free and cond_monthly,
            f"free={free.get('price_monthly')}, monthly={monthly.get('price_monthly')}")
    except Exception as ex:
        log("GET /plans?track=parent", False, str(ex))

    # 9) Regression smoke
    try:
        r = requests.get(f"{BASE}/auth/me", headers=H(admin_tok), timeout=20)
        log("GET /auth/me (admin)", r.status_code == 200,
            f"status={r.status_code}, role={r.json().get('role') if r.status_code == 200 else 'n/a'}")
    except Exception as ex:
        log("GET /auth/me admin", False, str(ex))
    try:
        r = requests.get(f"{BASE}/admin/stats", headers=H(admin_tok), timeout=20)
        log("GET /admin/stats (admin)", r.status_code == 200,
            f"status={r.status_code}")
    except Exception as ex:
        log("GET /admin/stats admin", False, str(ex))

    # ----- Summary -----
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print()
    print("=" * 60)
    print(f"RESULT: {passed}/{total} PASS")
    print("=" * 60)
    for name, ok, detail in results:
        if not ok:
            print(f"  FAILED: {name} — {detail}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
