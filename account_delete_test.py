"""Test suite for DELETE /api/account universal account deletion endpoint.

Required by Apple App Store guideline 5.1.1(v).
"""
import os
import random
import string
import sys

import requests

BASE = os.environ.get("BACKEND_URL", "https://app-builder-demo-60.preview.emergentagent.com") + "/api"

PASS = 0
FAIL = 0
FAILS: list[str] = []


def rand_suffix(n=8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def check(cond: bool, label: str, info: str = ""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ {label}")
    else:
        FAIL += 1
        FAILS.append(f"{label} :: {info}")
        print(f"  ❌ {label} :: {info}")


def register(role: str, email_prefix: str) -> tuple[str, str, dict]:
    email = f"{email_prefix}-{rand_suffix()}@tripzen.com"
    full = {
        "parent": "Test Parent " + rand_suffix(4),
        "driver": "Test Driver " + rand_suffix(4),
        "admin":  "Test Admin "  + rand_suffix(4),
    }[role]
    body = {
        "email": email,
        "password": "test1234",
        "full_name": full,
        "role": role,
        "phone": "+447700900" + str(random.randint(100, 999)),
    }
    r = requests.post(f"{BASE}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, f"register {role} failed {r.status_code}: {r.text}"
    data = r.json()
    return email, data["access_token"], data["user"]


def login(email: str, password: str = "test1234") -> requests.Response:
    return requests.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_role(role: str, extra_summary_key: str | None):
    print(f"\n=== {role.upper()} flow ===")
    email, token, user = register(role, f"delete-test-{role}")
    print(f"  Registered: {email}  id={user['id']}")

    # /auth/me works
    r = requests.get(f"{BASE}/auth/me", headers=auth(token), timeout=20)
    check(r.status_code == 200 and r.json().get("role") == role,
          f"{role}: /auth/me works pre-delete",
          f"status={r.status_code} body={r.text[:200]}")

    # For parent, GET /students should work
    if role == "parent":
        r = requests.get(f"{BASE}/students", headers=auth(token), timeout=20)
        check(r.status_code == 200 and isinstance(r.json(), list),
              "parent: GET /students returns list",
              f"status={r.status_code} body={r.text[:200]}")

    # DELETE /api/account
    r = requests.delete(f"{BASE}/account", headers=auth(token), timeout=30)
    check(r.status_code == 200, f"{role}: DELETE /account returns 200",
          f"status={r.status_code} body={r.text[:300]}")
    if r.status_code == 200:
        body = r.json()
        check(body.get("ok") is True, f"{role}: response ok=true", f"body={body}")
        check("deleted_at" in body and isinstance(body["deleted_at"], str),
              f"{role}: response has deleted_at iso", f"body={body}")
        summary = body.get("summary", {})
        check(summary.get("role") == role, f"{role}: summary.role == {role}",
              f"summary={summary}")
        check(summary.get("user_deleted") is True,
              f"{role}: summary.user_deleted == true", f"summary={summary}")
        check("notifications" in summary, f"{role}: summary.notifications present",
              f"summary={summary}")
        check("messages" in summary, f"{role}: summary.messages present",
              f"summary={summary}")

        if role == "parent":
            check(summary.get("children") == 0, "parent: summary.children == 0",
                  f"summary={summary}")
            check(summary.get("bookings") == 0, "parent: summary.bookings == 0",
                  f"summary={summary}")
            check(summary.get("ratings") == 0, "parent: summary.ratings == 0",
                  f"summary={summary}")

        if extra_summary_key:
            check(summary.get(extra_summary_key) is True,
                  f"{role}: summary.{extra_summary_key} == true",
                  f"summary={summary}")

    # /auth/me with same token should now fail
    r = requests.get(f"{BASE}/auth/me", headers=auth(token), timeout=20)
    check(r.status_code in (401, 404),
          f"{role}: /auth/me after delete returns 401/404",
          f"status={r.status_code} body={r.text[:200]}")

    # login with same creds should fail
    r = login(email)
    check(r.status_code == 401,
          f"{role}: login with deleted creds returns 401",
          f"status={r.status_code} body={r.text[:200]}")


def test_auth():
    print("\n=== AUTH guard ===")
    # No token
    r = requests.delete(f"{BASE}/account", timeout=20)
    check(r.status_code == 401, "DELETE /account no-token -> 401",
          f"status={r.status_code} body={r.text[:200]}")
    # Invalid token
    r = requests.delete(f"{BASE}/account",
                        headers={"Authorization": "Bearer not-a-valid-token"},
                        timeout=20)
    check(r.status_code == 401, "DELETE /account invalid-token -> 401",
          f"status={r.status_code} body={r.text[:200]}")


if __name__ == "__main__":
    print(f"Base: {BASE}")
    test_role("parent", None)
    test_role("driver", "unassigned_routes_trips")
    test_role("admin", "anonymised_broadcasts")
    test_auth()

    print(f"\n==== RESULT: {PASS} PASS / {FAIL} FAIL ====")
    if FAIL:
        print("\nFAILURES:")
        for f in FAILS:
            print(" -", f)
        sys.exit(1)
    sys.exit(0)
