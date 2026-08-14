"""Backend regression tests after N+1 query optimizations.

Verifies contract shape/data of:
- GET /api/loans (attached client object)
- GET /api/dashboard (15 KPIs + trend_7d 7 entries)
- GET /api/overdue (loan_id/client/overdue_count/overdue_amount)
- Other endpoints: auth/login, clients, loans/{id}, cash/today, reports, expenses, withdrawals
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://loanpro-19.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "nutricrispy@gmail.com"
ADMIN_PW = "Prestamos2026!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PW},
                      timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------- AUTH ----------
class TestAuth:
    def test_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_login_bad(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"].lower() == ADMIN_EMAIL


# ---------- CLIENTS ----------
class TestClients:
    def test_list_clients(self, client):
        r = client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        for c in docs:
            assert "_id" not in c
            assert "id" in c and "first_name" in c and "last_name" in c


# ---------- LOANS (post N+1 fix) ----------
class TestLoans:
    def test_list_loans_has_client_object(self, client):
        r = client.get(f"{BASE_URL}/api/loans")
        assert r.status_code == 200
        loans = r.json()
        assert isinstance(loans, list)
        if not loans:
            pytest.skip("No loans in system to verify shape")
        for l in loans:
            assert "_id" not in l
            assert "id" in l
            assert "client" in l, "Loan missing 'client' key after N+1 fix"
            if l["client"] is not None:
                c = l["client"]
                # Must contain exactly the projected fields (first_name, last_name, code)
                for k in ("first_name", "last_name", "code"):
                    assert k in c, f"Client sub-object missing '{k}'"
                assert "_id" not in c

    def test_get_loan_detail(self, client):
        r = client.get(f"{BASE_URL}/api/loans")
        loans = r.json()
        if not loans:
            pytest.skip("No loans available")
        lid = loans[0]["id"]
        r2 = client.get(f"{BASE_URL}/api/loans/{lid}")
        assert r2.status_code == 200
        d = r2.json()
        for k in ("loan", "client", "installments", "paid_amount", "paid_count",
                  "overdue_count", "pending_count", "balance", "payments"):
            assert k in d, f"Missing key: {k}"

    def test_get_loan_404(self, client):
        r = client.get(f"{BASE_URL}/api/loans/does-not-exist")
        assert r.status_code == 404


# ---------- DASHBOARD (post duplicate payments fix) ----------
EXPECTED_KPIS = {
    "clients_total", "active_clients", "active_loans", "capital_lent",
    "total_granted", "pending_amount", "collected_today", "collected_week",
    "collected_month", "interest_collected", "renewals_count",
    "renewals_amount", "expenses_month", "withdrawals_month",
    "available_balance",
    # server also returns overdue_count and late_clients_count; but 15 core KPIs must be present
}


class TestDashboard:
    def test_dashboard_returns_all_kpis_and_trend(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        missing = EXPECTED_KPIS - set(d.keys())
        assert not missing, f"Dashboard missing KPIs: {missing}"
        # numeric sanity
        for k in EXPECTED_KPIS:
            assert isinstance(d[k], (int, float)), f"{k} not numeric: {d[k]!r}"
        # trend_7d
        assert "trend_7d" in d
        trend = d["trend_7d"]
        assert isinstance(trend, list) and len(trend) == 7, f"trend_7d must have 7 entries, got {len(trend)}"
        for entry in trend:
            assert "date" in entry and "amount" in entry
            assert isinstance(entry["amount"], (int, float))
        # payments should NOT be leaked into dashboard response
        assert "payments" not in d, "dashboard leaked internal payments array"


# ---------- OVERDUE (post N+1 fix) ----------
class TestOverdue:
    def test_overdue_shape(self, client):
        r = client.get(f"{BASE_URL}/api/overdue")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        for row in arr:
            for k in ("loan_id", "client", "overdue_count", "overdue_amount"):
                assert k in row, f"overdue row missing {k}"
            assert isinstance(row["overdue_count"], int)
            assert isinstance(row["overdue_amount"], (int, float))
            if row["client"] is not None:
                assert "_id" not in row["client"]


# ---------- CASH / REPORTS / EXPENSES / WITHDRAWALS ----------
class TestOtherEndpoints:
    def test_cash_today(self, client):
        r = client.get(f"{BASE_URL}/api/cash/today")
        assert r.status_code == 200
        d = r.json()
        for k in ("date", "initial_balance", "income", "new_loans", "renewals",
                  "expenses", "withdrawals", "final_balance"):
            assert k in d

    def test_reports(self, client):
        r = client.get(f"{BASE_URL}/api/reports")
        assert r.status_code == 200
        d = r.json()
        for k in ("loans", "payments", "expenses", "withdrawals", "totals"):
            assert k in d
        for k in ("loans_amount", "payments_amount", "expenses_amount", "withdrawals_amount"):
            assert k in d["totals"]

    def test_expenses_list(self, client):
        r = client.get(f"{BASE_URL}/api/expenses")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_withdrawals_list(self, client):
        r = client.get(f"{BASE_URL}/api/withdrawals")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unauth_blocked(self):
        r = requests.get(f"{BASE_URL}/api/dashboard", timeout=10)
        assert r.status_code == 401
