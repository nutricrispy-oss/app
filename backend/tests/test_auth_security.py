"""Auth security tests: logout JTI revocation, forgot/reset password, password validation, brute force."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://loanpro-19.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "nutricrispy@gmail.com"
ADMIN_PW = "Prestamos2026!"


def _login(email=ADMIN_EMAIL, pw=ADMIN_PW):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    return r


# ---------- BUG FIX #1: Logout JTI revocation ----------
class TestLogoutRevocation:
    def test_logout_revokes_bearer_token(self):
        r = _login()
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}

        me = requests.get(f"{API}/auth/me", headers=h, timeout=20)
        assert me.status_code == 200

        lo = requests.post(f"{API}/auth/logout", headers=h, timeout=20)
        assert lo.status_code == 200

        # Now token must be rejected
        me2 = requests.get(f"{API}/auth/me", headers=h, timeout=20)
        assert me2.status_code == 401
        assert "revocada" in me2.text.lower() or "sesión" in me2.text.lower()

    def test_revoked_token_rejected_on_protected_endpoints(self):
        r = _login()
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        requests.post(f"{API}/auth/logout", headers=h, timeout=20)

        for path in ["/clients", "/loans", "/dashboard", "/settings"]:
            resp = requests.get(f"{API}{path}", headers=h, timeout=20)
            assert resp.status_code == 401, f"{path} returned {resp.status_code}"


# ---------- Password validation ----------
class TestPasswordValidation:
    def _reg(self, pw):
        email = f"TEST_{uuid.uuid4().hex[:8]}@ex.com"
        return requests.post(f"{API}/auth/register",
                             json={"email": email, "password": pw, "name": "T"}, timeout=20), email

    def test_short_password_rejected(self):
        r, _ = self._reg("abc")
        assert r.status_code == 400
        assert "8 caracteres" in r.text

    def test_letters_only_rejected(self):
        r, _ = self._reg("abcdefghij")
        assert r.status_code == 400
        assert "letra" in r.text.lower() and ("número" in r.text.lower() or "numero" in r.text.lower())

    def test_valid_password_accepted(self):
        r, email = self._reg("validpw123")
        assert r.status_code == 200, r.text
        # Cleanup: login and logout
        token = r.json()["token"]
        requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"}, timeout=20)

    def test_change_password_weak_rejected(self):
        r = _login()
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        cp = requests.post(f"{API}/auth/change-password",
                           json={"current_password": ADMIN_PW, "new_password": "abc"},
                           headers=h, timeout=20)
        assert cp.status_code == 400
        assert "8 caracteres" in cp.text
        requests.post(f"{API}/auth/logout", headers=h, timeout=20)


# ---------- Forgot/Reset password ----------
class TestForgotReset:
    def test_forgot_neutral_response_unknown_email(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nobody_{uuid.uuid4().hex}@x.com"}, timeout=20)
        assert r.status_code == 200
        assert "Si el correo" in r.text

    def test_forgot_password_real_email_and_reset_flow(self):
        # Register a temporary user we control
        temp_email = f"TEST_reset_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": temp_email, "password": "initial123", "name": "R"}, timeout=20)
        assert reg.status_code == 200
        old_token = reg.json()["token"]

        # Trigger forgot password
        fp = requests.post(f"{API}/auth/forgot-password", json={"email": temp_email}, timeout=30)
        assert fp.status_code == 200
        assert "Si el correo" in fp.text

        # Fetch token from DB via mongo (direct)
        import pymongo
        m = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = m[os.environ.get("DB_NAME", "prestamos_db")]
        rec = db.password_reset_tokens.find_one({"used": False}, sort=[("created_at", -1)])
        assert rec is not None
        assert rec.get("used") is False
        assert "expires_at" in rec
        token = rec["token"]

        # Reset with weak pw
        weak = requests.post(f"{API}/auth/reset-password",
                             json={"token": token, "password": "abc"}, timeout=20)
        assert weak.status_code == 400

        # Reset with valid pw
        ok = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "password": "newpass123"}, timeout=20)
        assert ok.status_code == 200

        # Old session should be revoked
        me = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {old_token}"}, timeout=20)
        assert me.status_code == 401

        # Reusing token should fail
        again = requests.post(f"{API}/auth/reset-password",
                              json={"token": token, "password": "newpass123"}, timeout=20)
        assert again.status_code == 400
        assert "Token inválido" in again.text or "invalido" in again.text.lower()

        # New login works
        login2 = requests.post(f"{API}/auth/login",
                               json={"email": temp_email, "password": "newpass123"}, timeout=20)
        assert login2.status_code == 200

    def test_forgot_admin_email_triggers_brevo(self):
        """Verify that calling forgot-password for the admin actually inserts a reset token.
        The Brevo HTTP call is fire-and-forget; we verify code path was hit by token creation."""
        import pymongo
        m = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = m[os.environ.get("DB_NAME", "prestamos_db")]
        before = db.password_reset_tokens.count_documents({})
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL}, timeout=30)
        assert r.status_code == 200
        after = db.password_reset_tokens.count_documents({})
        assert after == before + 1


# ---------- Rate limit ----------
class TestRateLimit:
    def test_brute_force_lockout(self):
        # Use a fresh email so we don't lockout admin
        email = f"test_rl_{uuid.uuid4().hex[:8]}@example.com"
        # register
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "goodpass123", "name": "R"}, timeout=20)
        assert r.status_code == 200
        token = r.json()["token"]
        requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"}, timeout=20)

        # 5 wrong attempts → all 401
        for i in range(5):
            resp = requests.post(f"{API}/auth/login",
                                 json={"email": email, "password": "wrongpw123"}, timeout=20)
            assert resp.status_code == 401, f"attempt {i}: {resp.status_code}"

        # 6th → 429
        resp = requests.post(f"{API}/auth/login",
                             json={"email": email, "password": "wrongpw123"}, timeout=20)
        assert resp.status_code == 429
        assert "Demasiados" in resp.text or "intentos" in resp.text.lower()

        # Cleanup: clear login attempts so we can re-login and clean user
        import pymongo
        m = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = m[os.environ.get("DB_NAME", "prestamos_db")]
        db.login_attempts.delete_many({"email": email})

        # Correct login should now succeed
        ok = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": "goodpass123"}, timeout=20)
        assert ok.status_code == 200


# ---------- Cookies ----------
class TestCookies:
    def test_login_sets_httponly_cookie(self):
        r = _login()
        assert r.status_code == 200
        set_cookie = r.headers.get("set-cookie", "")
        assert "access_token" in set_cookie
        assert "HttpOnly" in set_cookie or "httponly" in set_cookie.lower()
        # Secure + SameSite=None
        assert "Secure" in set_cookie or "secure" in set_cookie.lower()
        assert "samesite=none" in set_cookie.lower() or "SameSite=None" in set_cookie


# ---------- Regression: core flow still works ----------
class TestRegression:
    def test_full_flow(self):
        r = _login()
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        # Create client
        c = requests.post(f"{API}/clients",
                         json={"first_name": "TEST_R", "last_name": "Reg"}, headers=h, timeout=20)
        assert c.status_code == 200
        cid = c.json()["id"]
        # Create loan
        l = requests.post(f"{API}/loans", headers=h, timeout=20,
                          json={"client_id": cid, "capital": 100000, "interest_rate": 20,
                                "installments": 5, "modality": "semanal",
                                "start_date": "2026-01-01", "first_due_date": "2026-01-08"})
        assert l.status_code == 200
        lid = l.json()["id"]
        # Pay
        p = requests.post(f"{API}/loans/{lid}/pay", headers=h, json={"amount": 24000}, timeout=20)
        assert p.status_code == 200
        # Dashboard
        d = requests.get(f"{API}/dashboard", headers=h, timeout=20)
        assert d.status_code == 200
        # Logout
        requests.post(f"{API}/auth/logout", headers=h, timeout=20)
