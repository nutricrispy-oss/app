"""Tests for the 5 new features:
- holidays in settings & installment bump on new holiday
- skip_sundays in loan calc/create/renew
- profile update (PUT /auth/profile)
- change password (POST /auth/change-password)
- backup (GET /backup) & removed admin/export-all
"""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "nutricrispy@gmail.com"
ADMIN_PW = "Prestamos2026!"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


# ---------- SETTINGS: holidays ----------
class TestSettingsHolidays:
    def test_get_settings_has_holidays_key(self, client):
        r = client.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        d = r.json()
        assert "holidays" in d
        assert isinstance(d["holidays"], list)

    def test_put_settings_persists_holidays(self, client):
        # Read current
        cur = client.get(f"{BASE_URL}/api/settings").json()
        payload = {**cur, "holidays": ["2099-12-25", "2099-01-01"]}
        # Remove any leftover keys not accepted
        payload = {k: payload.get(k, "") for k in
                   ["business_name", "owner_name", "phone", "whatsapp",
                    "address", "city", "currency", "receipt_text", "holidays"]}
        payload["holidays"] = ["2099-12-25", "2099-01-01"]
        r = client.put(f"{BASE_URL}/api/settings", json=payload)
        assert r.status_code == 200
        got = client.get(f"{BASE_URL}/api/settings").json()
        assert set(got["holidays"]) == {"2099-12-25", "2099-01-01"}

        # Cleanup - restore to empty
        payload["holidays"] = cur.get("holidays", []) or []
        client.put(f"{BASE_URL}/api/settings", json=payload)


# ---------- LOAN CALCULATE: skip_sundays + holidays ----------
class TestCalcSchedule:
    def _get_client_id(self, client):
        cs = client.get(f"{BASE_URL}/api/clients").json()
        if not cs:
            pytest.skip("No clients available")
        return cs[0]["id"]

    def test_skip_sundays_no_sunday_in_schedule(self, client):
        cid = self._get_client_id(client)
        # Pick a Sunday as first_due to force adjustment
        # 2099-01-04 is a Sunday
        payload = {
            "client_id": cid, "capital": 100000, "interest_rate": 20,
            "installments": 14, "modality": "diario",
            "start_date": "2099-01-01", "first_due_date": "2099-01-04",
            "skip_sundays": True,
        }
        r = client.post(f"{BASE_URL}/api/loans/calculate", json=payload)
        assert r.status_code == 200, r.text
        sched = r.json()["schedule"]
        for s in sched:
            wd = date.fromisoformat(s["due_date"]).weekday()
            assert wd != 6, f"Found Sunday in schedule: {s['due_date']}"

    def test_holidays_bump_dates(self, client):
        cid = self._get_client_id(client)
        # Ensure first_due lands on a holiday and check it's bumped
        holiday = "2099-03-10"  # arbitrary Tuesday
        # save holiday
        cur = client.get(f"{BASE_URL}/api/settings").json()
        base_payload = {k: cur.get(k, "") for k in
                        ["business_name", "owner_name", "phone", "whatsapp",
                         "address", "city", "currency", "receipt_text"]}
        base_payload["holidays"] = [holiday]
        client.put(f"{BASE_URL}/api/settings", json=base_payload)
        try:
            calc = client.post(f"{BASE_URL}/api/loans/calculate", json={
                "client_id": cid, "capital": 50000, "interest_rate": 20,
                "installments": 3, "modality": "diario",
                "start_date": "2099-03-09", "first_due_date": holiday,
                "skip_sundays": False,
            })
            assert calc.status_code == 200
            first = calc.json()["schedule"][0]["due_date"]
            assert first != holiday, "Holiday date should be bumped"
        finally:
            base_payload["holidays"] = cur.get("holidays", []) or []
            client.put(f"{BASE_URL}/api/settings", json=base_payload)


# ---------- LOAN CREATE persists skip_sundays ----------
class TestLoanCreateSkipSundays:
    def test_create_and_delete_loan_skip_sundays(self, client):
        cs = client.get(f"{BASE_URL}/api/clients").json()
        if not cs:
            pytest.skip("No clients")
        cid = cs[0]["id"]
        payload = {
            "client_id": cid, "capital": 30000, "interest_rate": 20,
            "installments": 10, "modality": "diario",
            "start_date": "2099-01-05", "first_due_date": "2099-01-05",  # Monday
            "skip_sundays": True,
        }
        r = client.post(f"{BASE_URL}/api/loans", json=payload)
        assert r.status_code == 200, r.text
        loan = r.json()
        assert loan.get("skip_sundays") is True
        lid = loan["id"]
        # Verify installments have no Sunday
        detail = client.get(f"{BASE_URL}/api/loans/{lid}").json()
        for inst in detail["installments"]:
            wd = date.fromisoformat(inst["due_date"]).weekday()
            assert wd != 6

        # Cleanup: mark as cancelado via cancel to remove from active
        # We'll just leave TEST loans; but to avoid pollution, cancel
        client.post(f"{BASE_URL}/api/loans/{lid}/cancel", json={"amount": 0, "notes": "TEST cleanup"})


# ---------- Add holiday bumps existing installments ----------
class TestHolidayBumpsExistingInstallments:
    def test_new_holiday_bumps_pending_installments(self, client):
        cs = client.get(f"{BASE_URL}/api/clients").json()
        if not cs:
            pytest.skip("No clients")
        cid = cs[0]["id"]
        due = "2099-06-15"  # Monday
        # create a loan with due date in the future
        r = client.post(f"{BASE_URL}/api/loans", json={
            "client_id": cid, "capital": 10000, "interest_rate": 10,
            "installments": 3, "modality": "diario",
            "start_date": "2099-06-14", "first_due_date": due,
            "skip_sundays": False,
        })
        assert r.status_code == 200
        lid = r.json()["id"]

        # capture current holidays
        cur = client.get(f"{BASE_URL}/api/settings").json()
        base = {k: cur.get(k, "") for k in
                ["business_name", "owner_name", "phone", "whatsapp",
                 "address", "city", "currency", "receipt_text"]}
        base["holidays"] = list(cur.get("holidays", []) or []) + [due]
        try:
            r2 = client.put(f"{BASE_URL}/api/settings", json=base)
            assert r2.status_code == 200
            detail = client.get(f"{BASE_URL}/api/loans/{lid}").json()
            first_inst = [i for i in detail["installments"] if i["number"] == 1][0]
            assert first_inst["due_date"] != due, "First installment should be bumped from holiday"
        finally:
            base["holidays"] = cur.get("holidays", []) or []
            client.put(f"{BASE_URL}/api/settings", json=base)
            client.post(f"{BASE_URL}/api/loans/{lid}/cancel", json={"amount": 0, "notes": "TEST cleanup"})


# ---------- PROFILE UPDATE ----------
class TestProfileUpdate:
    def test_update_profile_name_only(self, client):
        me = client.get(f"{BASE_URL}/api/auth/me").json()
        original_name = me["name"]
        r = client.put(f"{BASE_URL}/api/auth/profile",
                       json={"name": "TEST NAME", "email": me["email"]})
        assert r.status_code == 200
        me2 = client.get(f"{BASE_URL}/api/auth/me").json()
        assert me2["name"] == "TEST NAME"
        # restore
        client.put(f"{BASE_URL}/api/auth/profile",
                   json={"name": original_name, "email": me["email"]})

    def test_profile_duplicate_email_rejected(self, client):
        me = client.get(f"{BASE_URL}/api/auth/me").json()
        # Create a second user via register to test duplicate
        other_email = "test_dupemail_probe@example.com"
        # try register (idempotently)
        s2 = requests.Session()
        s2.post(f"{BASE_URL}/api/auth/register",
                json={"email": other_email, "password": "pw12345", "name": "Dup"})
        r = client.put(f"{BASE_URL}/api/auth/profile",
                       json={"name": me["name"], "email": other_email})
        assert r.status_code == 400


# ---------- CHANGE PASSWORD ----------
class TestChangePassword:
    def test_wrong_current_password(self, client):
        r = client.post(f"{BASE_URL}/api/auth/change-password",
                        json={"current_password": "definitelywrong", "new_password": "whatever123"})
        assert r.status_code == 400
        assert "actual" in r.json().get("detail", "").lower() or "incorrect" in r.json().get("detail", "").lower()

    def test_change_password_and_restore(self, client):
        temp_pw = "TempTest123!"
        r = client.post(f"{BASE_URL}/api/auth/change-password",
                        json={"current_password": ADMIN_PW, "new_password": temp_pw})
        assert r.status_code == 200
        # Login with new
        r2 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": ADMIN_EMAIL, "password": temp_pw}, timeout=10)
        assert r2.status_code == 200
        # Restore back using new client with temp session
        tok = r2.json()["token"]
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        r3 = s.post(f"{BASE_URL}/api/auth/change-password",
                    json={"current_password": temp_pw, "new_password": ADMIN_PW})
        assert r3.status_code == 200
        # Confirm original still works
        r4 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=10)
        assert r4.status_code == 200


# ---------- BACKUP ----------
class TestBackup:
    def test_backup_returns_json_and_attachment(self, client):
        r = client.get(f"{BASE_URL}/api/backup")
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        d = r.json()
        for k in ("clients", "loans", "installments", "payments"):
            assert k in d
            assert isinstance(d[k], list)

    def test_admin_export_all_removed(self, client):
        r = client.get(f"{BASE_URL}/api/admin/export-all")
        assert r.status_code == 404


# ---------- RENEW loan with skip_sundays ----------
class TestRenewSkipSundays:
    def test_renew_stores_skip_sundays(self, client):
        cs = client.get(f"{BASE_URL}/api/clients").json()
        if not cs:
            pytest.skip("No clients")
        cid = cs[0]["id"]
        # create a base loan
        r = client.post(f"{BASE_URL}/api/loans", json={
            "client_id": cid, "capital": 20000, "interest_rate": 10,
            "installments": 3, "modality": "diario",
            "start_date": "2099-09-01", "first_due_date": "2099-09-02",
            "skip_sundays": False,
        })
        assert r.status_code == 200
        lid = r.json()["id"]
        rn = client.post(f"{BASE_URL}/api/loans/{lid}/renew", json={
            "additional_capital": 5000, "interest_rate": 10,
            "installments": 5, "modality": "diario",
            "start_date": "2099-09-10", "first_due_date": "2099-09-13",  # Sunday
            "skip_sundays": True,
        })
        assert rn.status_code == 200
        new_loan = rn.json()
        assert new_loan.get("skip_sundays") is True
        # verify installments have no Sunday
        detail = client.get(f"{BASE_URL}/api/loans/{new_loan['id']}").json()
        for inst in detail["installments"]:
            assert date.fromisoformat(inst["due_date"]).weekday() != 6
        # cleanup: cancel the renewed loan
        client.post(f"{BASE_URL}/api/loans/{new_loan['id']}/cancel",
                    json={"amount": 0, "notes": "TEST cleanup"})
