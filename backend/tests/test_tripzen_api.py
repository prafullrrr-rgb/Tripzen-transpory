"""TripZen Backend API Tests"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://app-builder-demo-60.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@tripzen.com", "password": "admin123"}
DRIVER = {"email": "driver@tripzen.com", "password": "driver123"}
PARENT = {"email": "priya@tripzen.com", "password": "parent123"}


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_token(session):
    return _login(session, ADMIN)["access_token"]


@pytest.fixture(scope="session")
def driver_token(session):
    return _login(session, DRIVER)["access_token"]


@pytest.fixture(scope="session")
def parent_token(session):
    return _login(session, PARENT)["access_token"]


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_health(self, session):
        r = session.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_login_admin(self, session):
        data = _login(session, ADMIN)
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@tripzen.com"
        assert "access_token" in data

    def test_login_driver(self, session):
        data = _login(session, DRIVER)
        assert data["user"]["role"] == "driver"

    def test_login_parent(self, session):
        data = _login(session, PARENT)
        assert data["user"]["role"] == "parent"

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "x@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_me_endpoint(self, session, parent_token):
        r = session.get(f"{API}/auth/me", headers=hdr(parent_token))
        assert r.status_code == 200
        assert r.json()["email"] == "priya@tripzen.com"

    def test_me_unauthorized(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_new_user(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@tripzen.com"
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "passw0rd", "full_name": "TEST User", "role": "parent"
        })
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == email
        assert "access_token" in d

    def test_register_duplicate(self, session):
        r = session.post(f"{API}/auth/register", json={
            "email": "admin@tripzen.com", "password": "passw0rd", "full_name": "Dup", "role": "admin"
        })
        assert r.status_code == 400


# ---------- Role-based access ----------
class TestRBAC:
    def test_admin_stats_admin(self, session, admin_token):
        r = session.get(f"{API}/admin/stats", headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_routes", "total_students", "active_buses", "on_time_percent"]:
            assert k in d

    def test_admin_stats_forbidden_for_parent(self, session, parent_token):
        r = session.get(f"{API}/admin/stats", headers=hdr(parent_token))
        assert r.status_code == 403

    def test_admin_stats_forbidden_for_driver(self, session, driver_token):
        r = session.get(f"{API}/admin/stats", headers=hdr(driver_token))
        assert r.status_code == 403

    def test_admin_alerts(self, session, admin_token):
        r = session.get(f"{API}/admin/alerts", headers=hdr(admin_token))
        assert r.status_code == 200
        alerts = r.json()
        assert isinstance(alerts, list)
        assert len(alerts) >= 3
        assert all("severity" in a for a in alerts)

    def test_admin_alerts_forbidden(self, session, parent_token):
        r = session.get(f"{API}/admin/alerts", headers=hdr(parent_token))
        assert r.status_code == 403


# ---------- Students ----------
class TestStudents:
    def test_parent_sees_own_students(self, session, parent_token):
        r = session.get(f"{API}/students", headers=hdr(parent_token))
        assert r.status_code == 200
        students = r.json()
        assert len(students) >= 1
        assert any(s["name"] == "Aarav Sharma" for s in students)
        assert all("qr_code" in s for s in students)

    def test_admin_sees_all_students(self, session, admin_token):
        r = session.get(f"{API}/students", headers=hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Routes ----------
class TestRoutes:
    def test_admin_sees_all_routes(self, session, admin_token):
        r = session.get(f"{API}/routes", headers=hdr(admin_token))
        assert r.status_code == 200
        routes = r.json()
        assert len(routes) >= 2
        names = [rt["name"] for rt in routes]
        assert "Route 3 - Morning" in names

    def test_driver_sees_assigned_routes(self, session, driver_token):
        r = session.get(f"{API}/routes", headers=hdr(driver_token))
        assert r.status_code == 200
        routes = r.json()
        assert len(routes) >= 1


# ---------- Trips ----------
class TestTripsFlow:
    """Full driver trip flow + parent notification"""

    def test_full_trip_flow(self, session, driver_token, parent_token):
        # Get a route for driver
        r = session.get(f"{API}/routes", headers=hdr(driver_token))
        morning = next((rt for rt in r.json() if rt["name"] == "Route 3 - Morning"), None)
        assert morning is not None
        route_id = morning["id"]

        # Start trip
        r = session.post(f"{API}/trips/start", headers=hdr(driver_token), json={"route_id": route_id})
        assert r.status_code == 200, r.text
        trip = r.json()
        assert trip["status"] == "active"
        assert trip["route_id"] == route_id
        trip_id = trip["id"]

        # Active trips for driver returns it
        r = session.get(f"{API}/trips/active", headers=hdr(driver_token))
        assert r.status_code == 200
        active = r.json()
        assert any(t["id"] == trip_id for t in active)

        # Update location
        r = session.post(f"{API}/trips/{trip_id}/location",
                         headers=hdr(driver_token), json={"lat": 51.5200, "lng": -0.1300, "stop_index": 1})
        assert r.status_code == 200
        upd = r.json()
        assert upd["current_lat"] == 51.5200
        assert upd["current_lng"] == -0.1300
        assert upd["current_stop_index"] == 1

        # Get student QR
        r = session.get(f"{API}/students", headers=hdr(parent_token))
        student = r.json()[0]
        qr = student["qr_code"]

        # Scan board
        r = session.post(f"{API}/trips/{trip_id}/scan", headers=hdr(driver_token),
                         json={"qr_code": qr, "action": "board"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # Verify trip has student boarded
        r = session.get(f"{API}/trips/{trip_id}", headers=hdr(driver_token))
        assert student["id"] in r.json()["boarded_student_ids"]

        # Parent notification created
        r = session.get(f"{API}/notifications", headers=hdr(parent_token))
        assert r.status_code == 200
        notifs = r.json()
        assert any("boarded" in n["title"].lower() for n in notifs)

        # Scan checkout
        r = session.post(f"{API}/trips/{trip_id}/scan", headers=hdr(driver_token),
                         json={"qr_code": qr, "action": "checkout"})
        assert r.status_code == 200

        # End trip
        r = session.post(f"{API}/trips/{trip_id}/end", headers=hdr(driver_token))
        assert r.status_code == 200

        # Verify trip ended
        r = session.get(f"{API}/trips/{trip_id}", headers=hdr(driver_token))
        assert r.json()["status"] == "completed"

    def test_scan_invalid_qr(self, session, driver_token):
        r = session.get(f"{API}/routes", headers=hdr(driver_token))
        route_id = r.json()[0]["id"]
        r = session.post(f"{API}/trips/start", headers=hdr(driver_token), json={"route_id": route_id})
        trip_id = r.json()["id"]
        r = session.post(f"{API}/trips/{trip_id}/scan", headers=hdr(driver_token),
                         json={"qr_code": "INVALID-QR", "action": "board"})
        assert r.status_code == 404
        # cleanup
        session.post(f"{API}/trips/{trip_id}/end", headers=hdr(driver_token))

    def test_start_trip_forbidden_for_parent(self, session, parent_token):
        r = session.post(f"{API}/trips/start", headers=hdr(parent_token), json={"route_id": "fake"})
        assert r.status_code == 403


# ---------- Bookings + Payments ----------
class TestBookings:
    def test_create_and_pay_booking(self, session, parent_token):
        # Get student & route
        r = session.get(f"{API}/students", headers=hdr(parent_token))
        student = r.json()[0]
        r = session.get(f"{API}/routes", headers=hdr(parent_token))
        route = r.json()[0]

        # Create booking
        r = session.post(f"{API}/bookings", headers=hdr(parent_token), json={
            "student_id": student["id"], "route_id": route["id"], "plan": "monthly"
        })
        assert r.status_code == 200
        booking = r.json()
        assert booking["status"] == "pending"
        assert booking["amount"] == 89.99
        assert booking["currency"] == "GBP"
        bid = booking["id"]

        # Pay
        r = session.post(f"{API}/bookings/{bid}/pay", headers=hdr(parent_token))
        assert r.status_code == 200
        pay = r.json()
        assert pay["ok"] is True
        assert pay["payment_ref"].startswith("pi_test_")

        # Verify booking is paid
        r = session.get(f"{API}/bookings", headers=hdr(parent_token))
        found = next((b for b in r.json() if b["id"] == bid), None)
        assert found is not None
        assert found["status"] == "paid"
        assert found["payment_ref"] is not None
        assert found["paid_at"] is not None

    def test_booking_forbidden_for_driver(self, session, driver_token):
        r = session.post(f"{API}/bookings", headers=hdr(driver_token),
                         json={"student_id": "x", "route_id": "y", "plan": "monthly"})
        assert r.status_code == 403


# ---------- Notifications ----------
class TestNotifications:
    def test_notifications_for_parent(self, session, parent_token):
        r = session.get(f"{API}/notifications", headers=hdr(parent_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
