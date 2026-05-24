"""TripZen Admin CRUD tests - new endpoints (routes/students PUT+DELETE, /admin/users, /admin/revenue)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://app-builder-demo-60.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@tripzen.com", "password": "admin123"}
DRIVER = {"email": "driver@tripzen.com", "password": "driver123"}
PARENT = {"email": "priya@tripzen.com", "password": "parent123"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token(s):
    return _login(s, ADMIN)


@pytest.fixture(scope="module")
def parent_token(s):
    return _login(s, PARENT)


@pytest.fixture(scope="module")
def driver_token(s):
    return _login(s, DRIVER)


def hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ----- Routes PUT / DELETE -----
class TestRoutesAdminCRUD:
    def test_admin_update_route(self, s, admin_token):
        # Create a temp route to update
        r = s.post(f"{API}/routes", headers=hdr(admin_token), json={
            "name": "TEST_Route_Update", "bus_number": "TBus1", "stops": [], "shift": "morning"
        })
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        # Update name + shift
        r = s.put(f"{API}/routes/{rid}", headers=hdr(admin_token), json={
            "name": "TEST_Route_Updated", "bus_number": "TBus1", "stops": [], "shift": "afternoon"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Route_Updated"
        assert d["shift"] == "afternoon"
        # GET verify persisted
        r = s.get(f"{API}/routes/{rid}", headers=hdr(admin_token))
        assert r.json()["name"] == "TEST_Route_Updated"
        # cleanup
        s.delete(f"{API}/routes/{rid}", headers=hdr(admin_token))

    def test_admin_delete_route_nulls_student_route(self, s, admin_token):
        # Create temp route
        r = s.post(f"{API}/routes", headers=hdr(admin_token), json={
            "name": "TEST_Route_Del", "bus_number": "TBus2", "stops": [], "shift": "morning"
        })
        rid = r.json()["id"]
        # Create temp student on that route
        r = s.post(f"{API}/students", headers=hdr(admin_token), json={
            "name": "TEST_Stud_RouteDel", "grade": "Y1", "school": "T", "route_id": rid
        })
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        # Delete route
        r = s.delete(f"{API}/routes/{rid}", headers=hdr(admin_token))
        assert r.status_code == 200
        # Verify route gone
        r = s.get(f"{API}/routes/{rid}", headers=hdr(admin_token))
        assert r.status_code == 404
        # Verify student route_id is now null
        r = s.get(f"{API}/students", headers=hdr(admin_token))
        st = next((x for x in r.json() if x["id"] == sid), None)
        assert st is not None
        assert st.get("route_id") in (None, "")
        # cleanup
        s.delete(f"{API}/students/{sid}", headers=hdr(admin_token))

    def test_route_put_forbidden_for_parent(self, s, parent_token):
        r = s.put(f"{API}/routes/non-existent", headers=hdr(parent_token), json={
            "name": "x", "stops": [], "shift": "morning"
        })
        assert r.status_code == 403

    def test_route_delete_forbidden_for_parent(self, s, parent_token):
        r = s.delete(f"{API}/routes/non-existent", headers=hdr(parent_token))
        assert r.status_code == 403


# ----- Students PUT / DELETE -----
class TestStudentsCRUD:
    def test_admin_update_student_changes_counts(self, s, admin_token):
        # Two temp routes
        r1 = s.post(f"{API}/routes", headers=hdr(admin_token), json={
            "name": "TEST_R_A", "stops": [], "shift": "morning"})
        r2 = s.post(f"{API}/routes", headers=hdr(admin_token), json={
            "name": "TEST_R_B", "stops": [], "shift": "morning"})
        ra, rb = r1.json()["id"], r2.json()["id"]
        # Student on route A
        r = s.post(f"{API}/students", headers=hdr(admin_token), json={
            "name": "TEST_StudMove", "grade": "Y1", "school": "T", "route_id": ra
        })
        sid = r.json()["id"]
        # Confirm A.student_count = 1
        a = s.get(f"{API}/routes/{ra}", headers=hdr(admin_token)).json()
        assert a["student_count"] == 1
        # Update to route B
        r = s.put(f"{API}/students/{sid}", headers=hdr(admin_token), json={
            "name": "TEST_StudMove", "grade": "Y1", "school": "T", "route_id": rb
        })
        assert r.status_code == 200
        a = s.get(f"{API}/routes/{ra}", headers=hdr(admin_token)).json()
        b = s.get(f"{API}/routes/{rb}", headers=hdr(admin_token)).json()
        assert a["student_count"] == 0
        assert b["student_count"] == 1
        # cleanup
        s.delete(f"{API}/students/{sid}", headers=hdr(admin_token))
        s.delete(f"{API}/routes/{ra}", headers=hdr(admin_token))
        s.delete(f"{API}/routes/{rb}", headers=hdr(admin_token))

    def test_admin_delete_student_decrements_count(self, s, admin_token):
        r1 = s.post(f"{API}/routes", headers=hdr(admin_token), json={
            "name": "TEST_R_Del", "stops": [], "shift": "morning"})
        rid = r1.json()["id"]
        r = s.post(f"{API}/students", headers=hdr(admin_token), json={
            "name": "TEST_StudDel", "grade": "Y2", "school": "T", "route_id": rid})
        sid = r.json()["id"]
        # delete student
        r = s.delete(f"{API}/students/{sid}", headers=hdr(admin_token))
        assert r.status_code == 200
        # count decremented
        a = s.get(f"{API}/routes/{rid}", headers=hdr(admin_token)).json()
        assert a["student_count"] == 0
        # cleanup
        s.delete(f"{API}/routes/{rid}", headers=hdr(admin_token))

    def test_parent_can_update_own_student(self, s, parent_token):
        # Parent's own student (Aarav)
        r = s.get(f"{API}/students", headers=hdr(parent_token))
        st = r.json()[0]
        # Just update name back to itself (idempotent)
        original = st["name"]
        r = s.put(f"{API}/students/{st['id']}", headers=hdr(parent_token), json={
            "name": original, "grade": st.get("grade"), "school": st.get("school"),
            "route_id": st.get("route_id")
        })
        assert r.status_code == 200
        assert r.json()["name"] == original


# ----- /admin/users -----
class TestAdminUsers:
    def test_admin_list_users(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers=hdr(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert all("password_hash" not in u for u in users)
        emails = [u["email"] for u in users]
        assert "admin@tripzen.com" in emails

    def test_admin_users_forbidden_for_parent(self, s, parent_token):
        r = s.get(f"{API}/admin/users", headers=hdr(parent_token))
        assert r.status_code == 403

    def test_admin_create_user(self, s, admin_token):
        email = f"test_drv_{uuid.uuid4().hex[:8]}@tripzen.com"
        r = s.post(f"{API}/admin/users", headers=hdr(admin_token), json={
            "email": email, "password": "passw0rd", "full_name": "TEST Drv", "role": "driver"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email
        assert d["role"] == "driver"
        assert "password_hash" not in d
        uid = d["id"]
        # Newly created driver can login
        r = s.post(f"{API}/auth/login", json={"email": email, "password": "passw0rd"})
        assert r.status_code == 200
        # cleanup
        s.delete(f"{API}/admin/users/{uid}", headers=hdr(admin_token))

    def test_admin_create_duplicate_email(self, s, admin_token):
        r = s.post(f"{API}/admin/users", headers=hdr(admin_token), json={
            "email": "admin@tripzen.com", "password": "x123456",
            "full_name": "Dup", "role": "admin"
        })
        assert r.status_code == 400

    def test_admin_cannot_delete_self(self, s, admin_token):
        r = s.get(f"{API}/auth/me", headers=hdr(admin_token))
        my_id = r.json()["id"]
        r = s.delete(f"{API}/admin/users/{my_id}", headers=hdr(admin_token))
        assert r.status_code == 400

    def test_admin_delete_user_404(self, s, admin_token):
        r = s.delete(f"{API}/admin/users/non-existent-id", headers=hdr(admin_token))
        assert r.status_code == 404

    def test_admin_users_create_forbidden_for_parent(self, s, parent_token):
        r = s.post(f"{API}/admin/users", headers=hdr(parent_token), json={
            "email": "x@x.com", "password": "passw0rd", "full_name": "x", "role": "parent"
        })
        assert r.status_code == 403


# ----- /admin/revenue -----
class TestAdminRevenue:
    def test_admin_revenue_summary(self, s, admin_token):
        r = s.get(f"{API}/admin/revenue", headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_revenue", "paid_bookings", "pending_bookings", "currency"]:
            assert k in d
        assert d["currency"] == "GBP"
        assert isinstance(d["total_revenue"], (int, float))
        assert isinstance(d["paid_bookings"], int)
        assert isinstance(d["pending_bookings"], int)
        # Since previous iteration paid £269.97 (89.99 * 3) we expect non-zero
        assert d["paid_bookings"] >= 1
        assert d["total_revenue"] > 0

    def test_admin_revenue_forbidden_for_parent(self, s, parent_token):
        r = s.get(f"{API}/admin/revenue", headers=hdr(parent_token))
        assert r.status_code == 403

    def test_admin_revenue_forbidden_for_driver(self, s, driver_token):
        r = s.get(f"{API}/admin/revenue", headers=hdr(driver_token))
        assert r.status_code == 403
