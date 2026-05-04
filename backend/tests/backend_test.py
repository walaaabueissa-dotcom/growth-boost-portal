"""Boost Growth Portal v2 backend tests"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://growth-boost-14.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@boost-growthsa.com"
ADMIN_PASSWORD = "BoostAdmin@2026"

# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    assert "token" in data
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def therapists(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/auth/therapists-list")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def therapist_client(therapists):
    assert len(therapists) >= 1
    t = therapists[0]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/therapist-login", json={"therapist_id": t["id"], "pin": "0000"})
    assert r.status_code == 200, f"Therapist login failed: {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    s.therapist = data
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_admin_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["email"] == ADMIN_EMAIL
        assert isinstance(d["token"], str) and len(d["token"]) > 20

    def test_admin_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_therapists_list_seeded_15(self):
        r = requests.get(f"{BASE_URL}/api/auth/therapists-list")
        assert r.status_code == 200
        lst = r.json()
        assert len(lst) == 15, f"expected 15 therapists, got {len(lst)}"
        names = {t["name"] for t in lst}
        for expected in ["Ms. Maha", "Ms. Fahda", "Ms. Razan", "Ms. Manal", "Ms. Hajer",
                         "Ms. Rahaf", "Ms. Shatha", "Ms. Alhanouf", "Ms. Waad", "Ms. Bodoor",
                         "Ms. Fatimah", "Ms. Shrooq", "Ms. Abeer", "Ms. Najla", "Ms. Walaa"]:
            assert expected in names, f"missing therapist {expected}"

    def test_therapist_login_pin_0000(self, therapists):
        for t in therapists[:3]:
            r = requests.post(f"{BASE_URL}/api/auth/therapist-login",
                              json={"therapist_id": t["id"], "pin": "0000"})
            assert r.status_code == 200, f"PIN login failed for {t['name']}"
            d = r.json()
            assert d["role"] == "therapist"
            assert d["name"] == t["name"]

    def test_therapist_login_wrong_pin(self, therapists):
        r = requests.post(f"{BASE_URL}/api/auth/therapist-login",
                          json={"therapist_id": therapists[0]["id"], "pin": "9999"})
        assert r.status_code == 401


# ---------------- Clients ----------------
class TestClients:
    def test_admin_sees_21_seed_clients(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        clients = r.json()
        assert len(clients) >= 21, f"expected >=21 seeded clients, got {len(clients)}"

    def test_therapist_sees_filtered_clients(self, therapist_client):
        r = therapist_client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        clients = r.json()
        for c in clients:
            assert c.get("therapist_id") == therapist_client.therapist["id"]


# ---------------- Schedule ----------------
class TestSchedule:
    @pytest.fixture(scope="class")
    def cell_id(self, admin_client, therapists):
        payload = {
            "therapist_id": therapists[0]["id"],
            "day": 0, "time_slot": "8:00 AM - 9:00 AM",
            "service_code": "SS", "child_name": "TEST_Child",
            "note": "TEST", "custom_time": None, "state": "normal",
            "week_start": "2026-01-04",
        }
        r = admin_client.post(f"{BASE_URL}/api/schedule", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["service_code"] == "SS"
        assert d["state"] == "normal"
        assert d["custom_time"] is None
        return d["id"], therapists[0]["id"]

    def test_create_schedule_notifies_therapist(self, admin_client, cell_id, therapists):
        cid, tid = cell_id
        # GET list and confirm exists
        r = admin_client.get(f"{BASE_URL}/api/schedule?week_start=2026-01-04")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert cid in ids

    def test_update_state_cancel_therapist(self, admin_client, cell_id, therapists):
        cid, tid = cell_id
        r = admin_client.put(f"{BASE_URL}/api/schedule/{cid}", json={
            "therapist_id": tid, "day": 0, "time_slot": "8:00 AM - 9:00 AM",
            "service_code": "SS", "child_name": "TEST_Child", "state": "cancel_therapist",
            "week_start": "2026-01-04",
        })
        assert r.status_code == 200
        assert r.json()["state"] == "cancel_therapist"
        # log in as that therapist and check notifications
        s = requests.Session()
        lg = s.post(f"{BASE_URL}/api/auth/therapist-login", json={"therapist_id": tid, "pin": "0000"})
        s.headers.update({"Authorization": f"Bearer {lg.json()['token']}"})
        nr = s.get(f"{BASE_URL}/api/notifications")
        assert nr.status_code == 200
        titles = [n["title"] for n in nr.json()]
        assert any("Therapist Cancellation" in t for t in titles), f"got titles {titles}"

    def test_update_state_cancel_child(self, admin_client, cell_id, therapists):
        cid, tid = cell_id
        r = admin_client.put(f"{BASE_URL}/api/schedule/{cid}", json={
            "therapist_id": tid, "day": 0, "time_slot": "8:00 AM - 9:00 AM",
            "service_code": "SS", "child_name": "TEST_Child", "state": "cancel_child",
            "week_start": "2026-01-04",
        })
        assert r.status_code == 200
        s = requests.Session()
        lg = s.post(f"{BASE_URL}/api/auth/therapist-login", json={"therapist_id": tid, "pin": "0000"})
        s.headers.update({"Authorization": f"Bearer {lg.json()['token']}"})
        nr = s.get(f"{BASE_URL}/api/notifications")
        titles = [n["title"] for n in nr.json()]
        assert any("Client Cancellation" in t for t in titles), f"got titles {titles}"

    def test_duplicate_cell(self, admin_client, cell_id):
        cid, _ = cell_id
        r = admin_client.post(f"{BASE_URL}/api/schedule/{cid}/duplicate")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] != cid
        # delete the duplicate
        admin_client.delete(f"{BASE_URL}/api/schedule/{d['id']}")

    def test_therapist_only_sees_own_schedule(self, therapist_client, admin_client, therapists):
        # create a cell for OTHER therapist
        other = therapists[1]
        r = admin_client.post(f"{BASE_URL}/api/schedule", json={
            "therapist_id": other["id"], "day": 1, "time_slot": "9:00 AM - 10:00 AM",
            "service_code": "HS", "child_name": "TEST_Other", "state": "normal",
            "week_start": "2026-01-04",
        })
        other_cell_id = r.json()["id"]
        # therapist[0] should not see it
        r2 = therapist_client.get(f"{BASE_URL}/api/schedule?week_start=2026-01-04")
        ids = [c["id"] for c in r2.json()]
        assert other_cell_id not in ids
        admin_client.delete(f"{BASE_URL}/api/schedule/{other_cell_id}")

    def test_delete_cell(self, admin_client, cell_id):
        cid, _ = cell_id
        r = admin_client.delete(f"{BASE_URL}/api/schedule/{cid}")
        assert r.status_code == 200


# ---------------- Requests ----------------
class TestRequests:
    def test_create_request_with_full_payload(self, therapist_client):
        payload = {
            "title": "TEST_Reward request",
            "description": "Need certificate",
            "request_type": "reward",
            "reward_type": "certificate",
            "priority": "high",
            "date_from": "2026-01-10",
            "date_to": "2026-01-15",
            "extra_notes": "TEST notes",
        }
        r = therapist_client.post(f"{BASE_URL}/api/requests", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["request_type"] == "reward"
        assert d["reward_type"] == "certificate"
        assert d["priority"] == "high"
        assert d["date_from"] == "2026-01-10"
        assert d["status"] == "pending"
        assert isinstance(d.get("timeline"), list) and len(d["timeline"]) == 1
        assert d["timeline"][0]["event"] == "submitted"
        therapist_client.test_req_id = d["id"]

    def test_update_status_appends_timeline(self, admin_client, therapist_client):
        rid = therapist_client.test_req_id
        r = admin_client.put(f"{BASE_URL}/api/requests/{rid}/status",
                             json={"status": "approved", "admin_note": "OK"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "approved"
        assert len(d["timeline"]) == 2
        assert d["timeline"][1]["event"] == "approved"
        # therapist gets notification
        nr = therapist_client.get(f"{BASE_URL}/api/notifications")
        titles = [n["title"] for n in nr.json()]
        assert any("Request update" in t for t in titles)

    def test_list_requests_filtered_for_therapist(self, therapist_client):
        r = therapist_client.get(f"{BASE_URL}/api/requests")
        assert r.status_code == 200
        for req in r.json():
            assert req["therapist_id"] == therapist_client.therapist["id"]

    def test_admin_cannot_create_request(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/requests",
                              json={"title": "TEST_admin", "request_type": "general"})
        assert r.status_code == 403


# ---------------- Notifications ----------------
class TestNotifications:
    def test_list_and_mark_all(self, therapist_client):
        r = therapist_client.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        notifs = r.json()
        if notifs:
            r2 = therapist_client.post(f"{BASE_URL}/api/notifications/{notifs[0]['id']}/read")
            assert r2.status_code == 200
        r3 = therapist_client.post(f"{BASE_URL}/api/notifications/read-all")
        assert r3.status_code == 200


# ---------------- Directory + Intake CRUD ----------------
class TestDirectory:
    def test_directory_crud(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/directory",
                              json={"name": "TEST_Contact", "role": "doctor", "phone": "123"})
        assert r.status_code == 200
        cid = r.json()["id"]
        lst = admin_client.get(f"{BASE_URL}/api/directory").json()
        assert any(c["id"] == cid for c in lst)
        admin_client.delete(f"{BASE_URL}/api/directory/{cid}")


class TestIntake:
    def test_intake_crud(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/intake",
                              json={"child_name": "TEST_Child", "intake_type": "pre"})
        assert r.status_code == 200
        iid = r.json()["id"]
        u = admin_client.put(f"{BASE_URL}/api/intake/{iid}",
                             json={"child_name": "TEST_Child2", "intake_type": "pre"})
        assert u.status_code == 200
        assert u.json()["child_name"] == "TEST_Child2"
        admin_client.delete(f"{BASE_URL}/api/intake/{iid}")


# ---------------- Sheets upload ----------------
class TestSheets:
    def test_upload_and_download_sheet(self, admin_client):
        clients = admin_client.get(f"{BASE_URL}/api/clients").json()
        assert clients
        cid = clients[0]["id"]
        # Use multipart - need to remove content-type header
        s = requests.Session()
        # re-login admin to get clean session for multipart
        lg = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        token = lg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        data = {"title": "TEST_Sheet", "session_date": "2026-01-04"}
        r = s.post(f"{BASE_URL}/api/clients/{cid}/sheets",
                   data=data, files=files, headers=headers)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        dl = s.get(f"{BASE_URL}/api/sheets/{sid}/download", headers=headers)
        assert dl.status_code == 200
        assert dl.content == b"hello"
        s.delete(f"{BASE_URL}/api/sheets/{sid}", headers=headers)


# ---------------- Therapists CRUD ----------------
class TestTherapistsCRUD:
    def test_create_update_delete(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/therapists",
                              json={"name": "TEST_Therapist", "pin": "1111", "color": "#000000"})
        assert r.status_code == 200
        tid = r.json()["id"]
        u = admin_client.put(f"{BASE_URL}/api/therapists/{tid}",
                             json={"name": "TEST_Therapist2"})
        assert u.status_code == 200
        assert u.json()["name"] == "TEST_Therapist2"
        admin_client.delete(f"{BASE_URL}/api/therapists/{tid}")
