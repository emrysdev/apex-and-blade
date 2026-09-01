"""Apex & Blade backend API regression tests."""
import os
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip()
API = BASE_URL.rstrip('/') + '/api'

ADMIN_EMAIL = "admin@apexblade.com"
ADMIN_PASSWORD = "admin123"


def _future_weekday(offset_start=2):
    """Return a Y-m-d that is not Sunday, at least offset_start days ahead."""
    d = date.today() + timedelta(days=offset_start)
    while d.weekday() == 6:  # Sunday closed
        d += timedelta(days=1)
    return d.isoformat()


@pytest.fixture(scope="session")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    return s


@pytest.fixture(scope="session")
def customer():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_cust_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Test Customer", "email": email, "password": "pass1234", "phone": "5551112222"
    })
    assert r.status_code == 200, r.text
    return s, email


# --- Health / public content ---
class TestPublic:
    def test_root(self, anon):
        r = anon.get(f"{API}/")
        assert r.status_code == 200

    def test_services(self, anon):
        r = anon.get(f"{API}/services")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        assert "id" in data[0] and "price" in data[0] and "duration" in data[0]

    def test_addons(self, anon):
        r = anon.get(f"{API}/addons")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_hairstyles(self, anon):
        r = anon.get(f"{API}/hairstyles")
        assert r.status_code == 200

    def test_gallery(self, anon):
        r = anon.get(f"{API}/gallery")
        assert r.status_code == 200

    def test_settings(self, anon):
        r = anon.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert "hours" in s
        assert s["hours"]["sun"]["closed"] is True

    def test_blackouts_list(self, anon):
        r = anon.get(f"{API}/blackouts")
        assert r.status_code == 200


# --- Auth ---
class TestAuth:
    def test_login_admin(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_invalid(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_and_me(self, customer):
        s, email = customer
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == email.lower()
        assert r.json()["role"] == "customer"

    def test_duplicate_register(self, anon, customer):
        _, email = customer
        r = anon.post(f"{API}/auth/register", json={
            "name": "Dup", "email": email, "password": "x", "phone": ""
        })
        assert r.status_code == 400

    def test_logout(self, anon):
        # register a throwaway user then logout
        s = requests.Session()
        email = f"TEST_lo_{uuid.uuid4().hex[:6]}@example.com"
        r = s.post(f"{API}/auth/register", json={"name": "L", "email": email, "password": "p12345"})
        assert r.status_code == 200
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Availability ---
class TestAvailability:
    def test_slots_valid(self, anon):
        services = anon.get(f"{API}/services").json()
        sid = services[0]["id"]
        d = _future_weekday(3)
        r = anon.get(f"{API}/availability", params={"date": d, "service_id": sid})
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == d
        assert isinstance(data["slots"], list)
        assert len(data["slots"]) > 0

    def test_sunday_closed(self, anon):
        services = anon.get(f"{API}/services").json()
        sid = services[0]["id"]
        d = date.today() + timedelta(days=1)
        while d.weekday() != 6:
            d += timedelta(days=1)
        r = anon.get(f"{API}/availability", params={"date": d.isoformat(), "service_id": sid})
        assert r.status_code == 200
        assert r.json()["slots"] == []

    def test_bad_service(self, anon):
        d = _future_weekday(3)
        r = anon.get(f"{API}/availability", params={"date": d, "service_id": "nope"})
        assert r.status_code == 404


# --- Booking flow ---
class TestBooking:
    def test_guest_booking_and_conflict(self, anon):
        services = anon.get(f"{API}/services").json()
        addons = anon.get(f"{API}/addons").json()
        svc = services[0]
        addon = addons[0]
        d = _future_weekday(4)
        slots = anon.get(f"{API}/availability", params={"date": d, "service_id": svc["id"]}).json()["slots"]
        assert slots
        slot = slots[0]

        payload = {
            "service_id": svc["id"],
            "addon_ids": [addon["id"]],
            "date": d, "start_time": slot,
            "customer_name": "TEST Guest",
            "customer_email": f"TEST_g_{uuid.uuid4().hex[:6]}@x.com",
            "customer_phone": "555",
            "notes": "test"
        }
        r = anon.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "confirmed"
        assert b["total_price"] == round(svc["price"] + addon["price"], 2)
        assert b["reference"].startswith("AB-")

        # Double booking -> 409
        r2 = anon.post(f"{API}/bookings", json=payload)
        assert r2.status_code == 409

        # Booking retrievable by reference
        r3 = anon.get(f"{API}/bookings/reference/{b['reference']}")
        assert r3.status_code == 200
        assert r3.json()["reference"] == b["reference"]

    def test_customer_booking_appears_in_me(self, customer):
        s, email = customer
        services = requests.get(f"{API}/services").json()
        svc = services[1]
        d = _future_weekday(5)
        slots = requests.get(f"{API}/availability", params={"date": d, "service_id": svc["id"]}).json()["slots"]
        slot = slots[0]
        r = s.post(f"{API}/bookings", json={
            "service_id": svc["id"], "addon_ids": [], "date": d, "start_time": slot,
            "customer_name": "TEST", "customer_email": email, "customer_phone": "555"
        })
        assert r.status_code == 200
        ref = r.json()["reference"]

        r2 = s.get(f"{API}/bookings/me")
        assert r2.status_code == 200
        refs = [b["reference"] for b in r2.json()]
        assert ref in refs

        # Cancel
        bid = next(b["id"] for b in r2.json() if b["reference"] == ref)
        r3 = s.post(f"{API}/bookings/{bid}/cancel")
        assert r3.status_code == 200
        # Verify status
        r4 = requests.get(f"{API}/bookings/reference/{ref}")
        assert r4.json()["status"] == "cancelled"


# --- Admin ---
class TestAdmin:
    def test_admin_stats(self, admin):
        r = admin.get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["today_count", "total_bookings", "pending_count", "revenue", "top_services", "busy_days"]:
            assert k in d

    def test_admin_stats_forbidden(self, anon):
        r = anon.get(f"{API}/admin/stats")
        assert r.status_code == 401

    def test_admin_stats_customer_forbidden(self, customer):
        s, _ = customer
        r = s.get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_admin_bookings(self, admin):
        r = admin.get(f"{API}/admin/bookings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_service_crud(self, admin):
        r = admin.post(f"{API}/admin/services", json={
            "name": "TEST_Service", "description": "d", "price": 10.0, "duration": 30,
            "category": "Haircut", "active": True, "featured": False, "image": ""
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        r = admin.put(f"{API}/admin/services/{sid}", json={
            "name": "TEST_Service2", "description": "d", "price": 12.0, "duration": 30,
            "category": "Haircut", "active": True, "featured": False, "image": ""
        })
        assert r.status_code == 200 and r.json()["name"] == "TEST_Service2"
        r = admin.delete(f"{API}/admin/services/{sid}")
        assert r.status_code == 200

    def test_blackout_flow(self, admin, anon):
        services = anon.get(f"{API}/services").json()
        svc = services[0]
        d = _future_weekday(10)
        # ensure clean
        # create blackout
        r = admin.post(f"{API}/admin/blackouts", json={"date": d, "reason": "test"})
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            bid = r.json()["id"]
        else:
            bid = next(x["id"] for x in anon.get(f"{API}/blackouts").json() if x["date"] == d)

        av = anon.get(f"{API}/availability", params={"date": d, "service_id": svc["id"]}).json()
        assert av["slots"] == []

        r2 = admin.delete(f"{API}/admin/blackouts/{bid}")
        assert r2.status_code == 200

    def test_settings_toggle_autoconfirm(self, admin, anon):
        # turn off
        r = admin.put(f"{API}/admin/settings", json={"auto_confirm": False})
        assert r.status_code == 200
        assert r.json()["auto_confirm"] is False

        services = anon.get(f"{API}/services").json()
        svc = services[2]
        d = _future_weekday(7)
        slots = anon.get(f"{API}/availability", params={"date": d, "service_id": svc["id"]}).json()["slots"]
        payload = {
            "service_id": svc["id"], "addon_ids": [], "date": d, "start_time": slots[0],
            "customer_name": "TEST P", "customer_email": f"TEST_p_{uuid.uuid4().hex[:6]}@x.com",
            "customer_phone": "555"
        }
        r = anon.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

        # restore
        r = admin.put(f"{API}/admin/settings", json={"auto_confirm": True})
        assert r.status_code == 200
        assert r.json()["auto_confirm"] is True

    def test_admin_manual_booking_and_status(self, admin):
        services = admin.get(f"{API}/services").json()
        svc = services[0]
        d = _future_weekday(8)
        slots = admin.get(f"{API}/availability", params={"date": d, "service_id": svc["id"]}).json()["slots"]
        r = admin.post(f"{API}/admin/bookings", json={
            "service_id": svc["id"], "addon_ids": [], "date": d, "start_time": slots[-1],
            "customer_name": "TEST Manual", "customer_email": "TEST_m@x.com", "customer_phone": "555"
        })
        assert r.status_code == 200
        bid = r.json()["id"]

        r2 = admin.patch(f"{API}/admin/bookings/{bid}", json={"status": "completed"})
        assert r2.status_code == 200

    def test_addon_crud(self, admin):
        r = admin.post(f"{API}/admin/addons", json={"name": "TEST_A", "price": 5.0, "duration": 5})
        assert r.status_code == 200
        aid = r.json()["id"]
        r = admin.delete(f"{API}/admin/addons/{aid}")
        assert r.status_code == 200

    def test_hairstyle_crud(self, admin):
        r = admin.post(f"{API}/admin/hairstyles", json={"title": "TEST_H", "tag": "t", "image": "http://x"})
        assert r.status_code == 200
        hid = r.json()["id"]
        r = admin.delete(f"{API}/admin/hairstyles/{hid}")
        assert r.status_code == 200

    def test_gallery_crud(self, admin):
        r = admin.post(f"{API}/admin/gallery", json={"title": "TEST_G", "category": "X", "image": "http://x"})
        assert r.status_code == 200
        gid = r.json()["id"]
        r = admin.delete(f"{API}/admin/gallery/{gid}")
        assert r.status_code == 200
