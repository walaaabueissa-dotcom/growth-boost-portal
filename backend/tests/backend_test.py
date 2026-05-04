"""Boost Growth Portal v3+v4 backend tests"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@boost-growthsa.com"
ADMIN_PASSWORD = "BoostAdmin@2026"

EXPECTED_THERAPISTS = ["Ms. Maha", "Ms. Fahda", "Ms. Razan", "Ms. Manal", "Ms. Hajer",
                      "Ms. Rahaf", "Ms. Shatha", "Ms. Alhanouf", "Ms. Waad", "Ms. Bodoor",
                      "Ms. Fatimah", "Ms. Shrooq", "Ms. Abeer"]


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def therapists(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/auth/therapists-list")
    assert r.status_code == 200
    return r.json()


def _login_therapist(t):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/therapist-login", json={"therapist_id": t["id"], "pin": "0000"})
    assert r.status_code == 200, r.text
    d = r.json()
    s.headers.update({"Authorization": f"Bearer {d['token']}"})
    s.therapist = d
    return s


@pytest.fixture(scope="session")
def therapist_client(therapists):
    return _login_therapist(therapists[0])


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

    def test_therapists_list_seeded_13(self):
        r = requests.get(f"{BASE_URL}/api/auth/therapists-list")
        assert r.status_code == 200
        lst = r.json()
        assert len(lst) == 13, f"expected 13 therapists, got {len(lst)}"
        names = {t["name"] for t in lst}
        for expected in EXPECTED_THERAPISTS:
            assert expected in names, f"missing therapist {expected}"

    def test_therapist_login_pin_0000(self, therapists):
        for t in therapists[:3]:
            r = requests.post(f"{BASE_URL}/api/auth/therapist-login",
                              json={"therapist_id": t["id"], "pin": "0000"})
            assert r.status_code == 200
            d = r.json()
            assert d["role"] == "therapist"
            assert d["name"] == t["name"]

    def test_therapist_login_wrong_pin(self, therapists):
        r = requests.post(f"{BASE_URL}/api/auth/therapist-login",
                          json={"therapist_id": therapists[0]["id"], "pin": "9999"})
        assert r.status_code == 401


# ---------------- Clients ----------------
class TestClients:
    def test_admin_sees_20_seed_clients_with_full_info(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        clients = r.json()
        assert len(clients) == 20, f"expected 20 seeded clients, got {len(clients)}"
        # Verify full info present on each
        for c in clients:
            assert "file_no" in c and c["file_no"]
            assert "color" in c and c["color"]
            assert "locations" in c and isinstance(c["locations"], list)
            assert "main_therapist_id" in c
            assert "co_therapist_ids" in c and isinstance(c["co_therapist_ids"], list)
            assert "supervisor" in c

    def test_client_locations_have_service_and_address(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/clients")
        clients = r.json()
        # Find one with multiple locations
        any_loc = next((c for c in clients if c["locations"]), None)
        assert any_loc is not None
        for loc in any_loc["locations"]:
            assert "service" in loc
            assert "address" in loc
            assert loc["service"] in ["HS", "SS"]

    def test_therapist_sees_filtered_clients_main_or_co(self, therapists, admin_client):
        # Pick Ms. Razan who is main on Lulu/Abdulrahman
        razan = next((t for t in therapists if t["name"] == "Ms. Razan"), None)
        assert razan
        s = _login_therapist(razan)
        r = s.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        clients = r.json()
        assert len(clients) > 0
        for c in clients:
            assert (c.get("main_therapist_id") == razan["id"] or
                    razan["id"] in (c.get("co_therapist_ids") or []))
        # admin sees more (should be 20 total)
        all_clients = admin_client.get(f"{BASE_URL}/api/clients").json()
        assert len(all_clients) >= len(clients)


# ---------------- Sessions ----------------
class TestSessions:
    @pytest.fixture(scope="class")
    def first_client(self, admin_client):
        return admin_client.get(f"{BASE_URL}/api/clients").json()[0]

    def test_create_session_completed(self, admin_client, first_client, therapists):
        payload = {
            "client_id": first_client["id"],
            "session_date": "2026-01-15",
            "start_time": "14:00",
            "end_time": "16:00",
            "hours": 2.0,
            "status": "Completed",
            "therapist_ids": [therapists[0]["id"], therapists[1]["id"]],
            "note": "TEST_session",
            "location": "HS",
        }
        r = admin_client.post(f"{BASE_URL}/api/sessions", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "Completed"
        assert d["hours"] == 2.0
        assert len(d["therapist_ids"]) == 2
        assert d["client_id"] == first_client["id"]
        # GET to verify persistence
        lst = admin_client.get(f"{BASE_URL}/api/sessions?client_id={first_client['id']}").json()
        assert any(s["id"] == d["id"] for s in lst)
        admin_client.test_session_id = d["id"]

    def test_session_filter_by_client(self, admin_client, first_client):
        r = admin_client.get(f"{BASE_URL}/api/sessions?client_id={first_client['id']}")
        assert r.status_code == 200
        for s in r.json():
            assert s["client_id"] == first_client["id"]

    def test_therapist_sees_only_own_sessions(self, therapists, admin_client, first_client):
        # session was created with therapists[0] and [1]; therapist[2] should NOT see it
        third = _login_therapist(therapists[2])
        r = third.get(f"{BASE_URL}/api/sessions")
        assert r.status_code == 200
        sid = admin_client.test_session_id
        assert not any(s["id"] == sid for s in r.json())
        # therapist[0] should see it
        first = _login_therapist(therapists[0])
        r2 = first.get(f"{BASE_URL}/api/sessions")
        assert any(s["id"] == admin_client.test_session_id for s in r2.json())

    def test_update_session(self, admin_client, first_client, therapists):
        sid = admin_client.test_session_id
        r = admin_client.put(f"{BASE_URL}/api/sessions/{sid}", json={
            "client_id": first_client["id"],
            "session_date": "2026-01-15",
            "start_time": "14:00", "end_time": "15:00",
            "hours": 1.0, "status": "No Show",
            "therapist_ids": [therapists[0]["id"]],
            "note": "TEST_updated", "location": "SS",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "No Show"
        assert r.json()["hours"] == 1.0

    def test_therapist_cannot_edit_other_session(self, admin_client, therapists):
        sid = admin_client.test_session_id
        other = _login_therapist(therapists[2])  # therapist[2] not in session
        r = other.put(f"{BASE_URL}/api/sessions/{sid}", json={
            "client_id": "x", "session_date": "2026-01-15",
            "hours": 0, "status": "Cancelled", "therapist_ids": [],
        })
        assert r.status_code == 403

    def test_delete_session(self, admin_client):
        sid = admin_client.test_session_id
        r = admin_client.delete(f"{BASE_URL}/api/sessions/{sid}")
        assert r.status_code == 200


# ---------------- Schedule (master view) ----------------
class TestSchedule:
    @pytest.fixture(scope="class")
    def cell_id(self, admin_client, therapists):
        payload = {
            "therapist_id": therapists[0]["id"],
            "day": 0, "time_slot": "8:00 AM - 9:00 AM",
            "service_code": "SS", "child_name": "Sulaiman",
            "note": "TEST", "state": "normal",
            "color": "#FFE599",
            "week_start": "2026-01-04",
        }
        r = admin_client.post(f"{BASE_URL}/api/schedule", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["color"] == "#FFE599"
        assert d["service_code"] == "SS"
        return d["id"], therapists[0]["id"]

    def test_schedule_master_view_for_everyone(self, admin_client, therapist_client, cell_id, therapists):
        cid, tid = cell_id
        # Admin sees it
        r = admin_client.get(f"{BASE_URL}/api/schedule?week_start=2026-01-04")
        assert any(c["id"] == cid for c in r.json())
        # therapist[0] sees it
        r2 = therapist_client.get(f"{BASE_URL}/api/schedule?week_start=2026-01-04")
        assert any(c["id"] == cid for c in r2.json())
        # different therapist (not therapists[0]) ALSO sees it (master view)
        other = _login_therapist(therapists[5])
        r3 = other.get(f"{BASE_URL}/api/schedule?week_start=2026-01-04")
        assert any(c["id"] == cid for c in r3.json()), "master view broken: therapist not seeing other therapist's cell"

    def test_update_state_cancel_therapist_notifies(self, admin_client, cell_id):
        cid, tid = cell_id
        r = admin_client.put(f"{BASE_URL}/api/schedule/{cid}", json={
            "therapist_id": tid, "day": 0, "time_slot": "8:00 AM - 9:00 AM",
            "service_code": "SS", "child_name": "Sulaiman",
            "state": "cancel_therapist", "week_start": "2026-01-04",
        })
        assert r.status_code == 200
        assert r.json()["state"] == "cancel_therapist"
        s = _login_therapist({"id": tid})
        nr = s.get(f"{BASE_URL}/api/notifications")
        assert any("Therapist Cancellation" in n["title"] for n in nr.json())

    def test_duplicate_cell(self, admin_client, cell_id):
        cid, _ = cell_id
        r = admin_client.post(f"{BASE_URL}/api/schedule/{cid}/duplicate")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] != cid
        admin_client.delete(f"{BASE_URL}/api/schedule/{d['id']}")

    def test_notify_endpoint(self, admin_client, cell_id):
        cid, _ = cell_id
        r = admin_client.post(f"{BASE_URL}/api/schedule/{cid}/notify",
                              json={"message": "TEST_notify_message"})
        assert r.status_code == 200

    def test_delete_cell(self, admin_client, cell_id):
        cid, _ = cell_id
        r = admin_client.delete(f"{BASE_URL}/api/schedule/{cid}")
        assert r.status_code == 200


# ---------------- Intake (admin only) ----------------
class TestIntakeAdminOnly:
    def test_therapist_cannot_list_intake(self, therapist_client):
        r = therapist_client.get(f"{BASE_URL}/api/intake")
        assert r.status_code == 403, f"Intake should be admin-only, got {r.status_code}"

    def test_therapist_cannot_create_intake(self, therapist_client):
        r = therapist_client.post(f"{BASE_URL}/api/intake",
                                  json={"child_name": "TEST_BadAccess"})
        assert r.status_code == 403

    def test_admin_intake_crud(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/intake",
                              json={"child_name": "TEST_Child", "intake_type": "pre"})
        assert r.status_code == 200
        iid = r.json()["id"]
        u = admin_client.put(f"{BASE_URL}/api/intake/{iid}",
                             json={"child_name": "TEST_Child2", "intake_type": "pre"})
        assert u.status_code == 200
        assert u.json()["child_name"] == "TEST_Child2"
        admin_client.delete(f"{BASE_URL}/api/intake/{iid}")


# ---------------- Requests ----------------
class TestRequests:
    def test_create_request(self, therapist_client):
        r = therapist_client.post(f"{BASE_URL}/api/requests", json={
            "title": "TEST_Reward", "request_type": "reward",
            "reward_type": "certificate", "priority": "high",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "pending"
        assert len(d.get("timeline", [])) == 1
        therapist_client.test_req_id = d["id"]

    def test_admin_status_update_appends_timeline(self, admin_client, therapist_client):
        rid = therapist_client.test_req_id
        r = admin_client.put(f"{BASE_URL}/api/requests/{rid}/status",
                             json={"status": "approved", "admin_note": "OK"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        assert len(r.json()["timeline"]) == 2

    def test_admin_cannot_create_request(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/requests",
                              json={"title": "TEST_admin", "request_type": "general"})
        assert r.status_code == 403


# ---------------- Notifications + Directory ----------------
class TestMisc:
    def test_notifications_list(self, therapist_client):
        r = therapist_client.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200

    def test_directory_crud(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/directory",
                              json={"name": "TEST_Contact", "role": "doctor", "phone": "123"})
        assert r.status_code == 200
        cid = r.json()["id"]
        admin_client.delete(f"{BASE_URL}/api/directory/{cid}")


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
        admin_client.delete(f"{BASE_URL}/api/therapists/{tid}")


# ================================================================
# v4 — Reports, Imports, Historical Loader, Admin Notifications
# ================================================================

# ---------------- Reports Dashboard ----------------
class TestReportsDashboard:
    def test_admin_dashboard_structure(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/reports/dashboard")
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d.keys()) >= {"totals", "per_therapist", "per_client"}
        t = d["totals"]
        for key in ["therapists","clients","sessions","completed_sessions","total_hours",
                    "open_requests","urgent_clients","warning_clients","schedule_cells",
                    "schedule_cancel_therapist","schedule_cancel_child"]:
            assert key in t, f"missing totals.{key}"
        assert t["therapists"] == 13
        assert t["clients"] == 20

    def test_per_therapist_shape(self, admin_client):
        d = admin_client.get(f"{BASE_URL}/api/reports/dashboard").json()
        assert isinstance(d["per_therapist"], list)
        assert len(d["per_therapist"]) == 13
        for t in d["per_therapist"]:
            for k in ("name","color","completed","cancelled","no_show","no_service","hours"):
                assert k in t

    def test_per_client_sorted_by_status(self, admin_client):
        d = admin_client.get(f"{BASE_URL}/api/reports/dashboard").json()
        order = {"urgent":0,"warning":1,"ok":2}
        pc = d["per_client"]
        assert len(pc) == 20
        statuses = [order[c["status"]] for c in pc]
        assert statuses == sorted(statuses), "per_client not sorted urgent->warning->ok"
        for c in pc:
            for k in ("id","name","file_no","color","pkg","used","rem","status"):
                assert k in c

    def test_dashboard_forbidden_for_therapist(self, therapist_client):
        r = therapist_client.get(f"{BASE_URL}/api/reports/dashboard")
        assert r.status_code == 403


# ---------------- Imports (Clients + Intake) ----------------
class TestImports:
    def test_import_clients_csv(self, admin_client):
        csv = "name,file_no,package_hours\nTEST_ImpChild1,IMP001,30\nTEST_ImpChild2,IMP002,18\n,SKIP,24\n"
        files = {"file": ("clients.csv", csv, "text/csv")}
        # Must not include Content-Type json for multipart — use new session headers
        s = requests.Session()
        s.headers.update({"Authorization": admin_client.headers["Authorization"]})
        r = s.post(f"{BASE_URL}/api/import/clients", files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] >= 2  # at least 2 valid rows
        # Cleanup
        clients = admin_client.get(f"{BASE_URL}/api/clients").json()
        for c in clients:
            if (c.get("name") or "").startswith("TEST_ImpChild"):
                admin_client.delete(f"{BASE_URL}/api/clients/{c['id']}")

    def test_import_intake_csv(self, admin_client):
        csv = "child_name,intake_type\nTEST_ImpIntakeA,pre\nTEST_ImpIntakeB,post\n,pre\n"
        files = {"file": ("intake.csv", csv, "text/csv")}
        s = requests.Session()
        s.headers.update({"Authorization": admin_client.headers["Authorization"]})
        r = s.post(f"{BASE_URL}/api/import/intake", files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] >= 2  # at least 2 valid rows
        # Cleanup
        intake = admin_client.get(f"{BASE_URL}/api/intake").json()
        for i in intake:
            if i["child_name"].startswith("TEST_ImpIntake"):
                admin_client.delete(f"{BASE_URL}/api/intake/{i['id']}")

    def test_import_clients_therapist_forbidden(self, therapist_client):
        csv = "name,file_no\nTEST_X,Z1\n"
        s = requests.Session()
        s.headers.update({"Authorization": therapist_client.headers["Authorization"]})
        r = s.post(f"{BASE_URL}/api/import/clients",
                   files={"file": ("c.csv", csv, "text/csv")})
        assert r.status_code == 403


# ---------------- Historical Schedule Loader ----------------
class TestHistoricalLoader:
    def test_weeks_listed(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/import/historical-weeks")
        assert r.status_code == 200
        weeks = r.json()["weeks"]
        assert len(weeks) == 2, f"expected 2 weeks, got {weeks}"
        # Week labels should be strings
        for w in weeks:
            assert isinstance(w, str) and len(w) > 0

    def test_historical_load_inserts_cells(self, admin_client):
        # Count cells with hist: prefix before
        before = admin_client.get(f"{BASE_URL}/api/schedule").json()
        before_hist = [c for c in before if str(c.get("week_start","")).startswith("hist:")]
        # Load (clear_existing=False to not nuke real data)
        r = admin_client.post(f"{BASE_URL}/api/import/historical-load",
                              json={"clear_existing": False})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["weeks_loaded"] == 2
        assert d["cells_inserted"] > 0
        # Verify inserted
        after = admin_client.get(f"{BASE_URL}/api/schedule").json()
        after_hist = [c for c in after if str(c.get("week_start","")).startswith("hist:")]
        assert len(after_hist) >= len(before_hist) + d["cells_inserted"] - 10  # allow small variance
        # Cleanup historical entries
        for c in after_hist:
            admin_client.delete(f"{BASE_URL}/api/schedule/{c['id']}")


# ---------------- Schedule duration field ----------------
class TestScheduleDuration:
    def test_create_cell_with_duration(self, admin_client, therapists):
        payload = {
            "therapist_id": therapists[0]["id"],
            "day": 1, "time_slot": "9:00 AM - 10:00 AM",
            "service_code": "SS", "child_name": "TEST_dur",
            "duration": 2, "state": "normal",
            "week_start": "2026-01-11",
        }
        r = admin_client.post(f"{BASE_URL}/api/schedule", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("duration") == 2
        # Persisted
        lst = admin_client.get(f"{BASE_URL}/api/schedule?week_start=2026-01-11").json()
        saved = next((c for c in lst if c["id"] == d["id"]), None)
        assert saved and saved.get("duration") == 2
        admin_client.delete(f"{BASE_URL}/api/schedule/{d['id']}")


# ---------------- Admin notifications triggers ----------------
def _admin_notif_count(admin_client):
    return len(admin_client.get(f"{BASE_URL}/api/notifications").json())


class TestAdminNotifications:
    def test_new_request_notifies_admin(self, admin_client, therapist_client):
        before = _admin_notif_count(admin_client)
        r = therapist_client.post(f"{BASE_URL}/api/requests", json={
            "title": "TEST_NotifReq", "request_type": "leave",
            "priority": "high", "description": "pls"
        })
        assert r.status_code == 200
        rid = r.json()["id"]
        after = admin_client.get(f"{BASE_URL}/api/notifications").json()
        assert len(after) > before
        assert any("New leave request" in n["title"] for n in after)
        therapist_client.delete(f"{BASE_URL}/api/requests/{rid}")

    def test_session_log_notifies_admin(self, admin_client, therapist_client):
        clients = therapist_client.get(f"{BASE_URL}/api/clients").json()
        assert clients, "therapist[0] has no assigned clients"
        before = _admin_notif_count(admin_client)
        r = therapist_client.post(f"{BASE_URL}/api/sessions", json={
            "client_id": clients[0]["id"], "session_date": "2026-01-20",
            "hours": 1.0, "status": "Completed", "therapist_ids": [], "note": "TEST"
        })
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        after = admin_client.get(f"{BASE_URL}/api/notifications").json()
        assert len(after) > before
        assert any("session logged" in n["title"].lower() for n in after)
        admin_client.delete(f"{BASE_URL}/api/sessions/{sid}")

    def test_cancelled_session_notifies_admin(self, admin_client, therapist_client):
        clients = therapist_client.get(f"{BASE_URL}/api/clients").json()
        before = _admin_notif_count(admin_client)
        r = therapist_client.post(f"{BASE_URL}/api/sessions", json={
            "client_id": clients[0]["id"], "session_date": "2026-01-21",
            "hours": 0, "status": "Cancelled", "therapist_ids": [], "note": "TEST_cxl"
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        after = admin_client.get(f"{BASE_URL}/api/notifications").json()
        # Expect session_log + cancel_alert (2 new)
        assert len(after) >= before + 2
        assert any("Cancelled" in n["title"] for n in after)
        admin_client.delete(f"{BASE_URL}/api/sessions/{sid}")

    def test_low_hours_alert(self, admin_client, therapists):
        """Create a throwaway client with small pkg; log session that leaves ≤4h; assert alert."""
        c = admin_client.post(f"{BASE_URL}/api/clients", json={
            "name": "TEST_LowHrs", "file_no": "LH1", "package_hours": 5,
            "main_therapist_id": therapists[0]["id"], "color": "#FF0000"
        }).json()
        before = _admin_notif_count(admin_client)
        # Log session as admin 3h → rem = 2h ≤ 4 → low_hours alert
        r = admin_client.post(f"{BASE_URL}/api/sessions", json={
            "client_id": c["id"], "session_date": "2026-01-22",
            "hours": 3, "status": "Completed",
            "therapist_ids": [therapists[0]["id"]], "note": "TEST"
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        after = admin_client.get(f"{BASE_URL}/api/notifications").json()
        assert any("has only" in n["title"] and "h left" in n["title"] for n in after), \
            f"low_hours alert not found"
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/sessions/{sid}")
        admin_client.delete(f"{BASE_URL}/api/clients/{c['id']}")

    def test_schedule_cancel_state_notifies_admin(self, admin_client, therapists):
        # create cell
        r = admin_client.post(f"{BASE_URL}/api/schedule", json={
            "therapist_id": therapists[0]["id"], "day": 2,
            "time_slot": "10:00 AM - 11:00 AM", "service_code": "SS",
            "child_name": "TEST_cxl", "state": "normal",
            "week_start": "2026-01-11",
        })
        cid = r.json()["id"]
        before = _admin_notif_count(admin_client)
        u = admin_client.put(f"{BASE_URL}/api/schedule/{cid}", json={
            "therapist_id": therapists[0]["id"], "day": 2,
            "time_slot": "10:00 AM - 11:00 AM", "service_code": "SS",
            "child_name": "TEST_cxl", "state": "cancel_child",
            "week_start": "2026-01-11",
        })
        assert u.status_code == 200
        after = admin_client.get(f"{BASE_URL}/api/notifications").json()
        assert len(after) > before
        assert any("Client cancellation" in n["title"] for n in after)
        admin_client.delete(f"{BASE_URL}/api/schedule/{cid}")
