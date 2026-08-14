from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import bcrypt
import jwt
import secrets
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from bson import ObjectId

# ============ SETUP ============
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

app = FastAPI()
api = APIRouter(prefix="/api")

# ============ HELPERS ============
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt): 
    return dt.isoformat() if isinstance(dt, datetime) else dt

def new_id():
    return str(uuid.uuid4())

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False

def create_access(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "type": "access",
                       "exp": now_utc() + timedelta(days=7)}, JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookie(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_h = request.headers.get("Authorization", "")
        if auth_h.startswith("Bearer "):
            token = auth_h[7:]
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(401, "Usuario no encontrado")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")

def clean(doc):
    if doc:
        doc.pop("_id", None)
    return doc

# ============ MODELS ============
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    business_name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    token: str
    password: str

class SettingsIn(BaseModel):
    business_name: Optional[str] = ""
    owner_name: Optional[str] = ""
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    currency: Optional[str] = "Gs."
    receipt_text: Optional[str] = ""

class ClientIn(BaseModel):
    first_name: str
    last_name: str
    document: Optional[str] = ""
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    workplace: Optional[str] = ""
    reference_name: Optional[str] = ""
    reference_phone: Optional[str] = ""
    notes: Optional[str] = ""
    status: Optional[str] = "activo"

class LoanIn(BaseModel):
    client_id: str
    capital: float
    interest_rate: float  # percentage e.g. 26
    installments: int
    modality: Literal["diario", "semanal", "quincenal", "mensual"]
    start_date: str  # YYYY-MM-DD
    first_due_date: str

class PaymentIn(BaseModel):
    installment_id: Optional[str] = None
    amount: float
    notes: Optional[str] = ""

class CancelIn(BaseModel):
    amount: float
    notes: Optional[str] = ""

class RenewIn(BaseModel):
    additional_capital: float
    interest_rate: float
    installments: int
    modality: Literal["diario", "semanal", "quincenal", "mensual"]
    start_date: str
    first_due_date: str

class ExpenseIn(BaseModel):
    concept: str
    category: str
    amount: float
    description: Optional[str] = ""
    notes: Optional[str] = ""
    date: Optional[str] = None

class WithdrawalIn(BaseModel):
    amount: float
    reason: str
    notes: Optional[str] = ""
    date: Optional[str] = None

# ============ AUTH ROUTES ============
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "El correo ya está registrado")
    uid = new_id()
    user = {
        "id": uid, "email": email, "name": data.name,
        "password_hash": hash_pw(data.password),
        "business_name": data.business_name or "",
        "owner_name": data.name, "phone": "", "whatsapp": "",
        "address": "", "city": "", "currency": "Gs.", "receipt_text": "",
        "role": "owner", "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    token = create_access(uid, email)
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(data.password, user["password_hash"]):
        raise HTTPException(401, "Credenciales inválidas")
    token = create_access(user["id"], email)
    set_auth_cookie(response, token)
    user.pop("_id", None); user.pop("password_hash", None)
    return {"user": user, "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.post("/auth/forgot-password")
async def forgot(data: ForgotIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if user:
        tok = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": tok, "user_id": user["id"],
            "expires_at": iso(now_utc() + timedelta(hours=1)),
            "used": False,
        })
        # Log the reset link (in prod send email)
        print(f"[PASSWORD RESET] {FRONTEND_URL}/reset-password?token={tok}")
    return {"ok": True, "message": "Si el correo existe, se enviaron instrucciones."}

@api.post("/auth/reset-password")
async def reset(data: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": data.token, "used": False})
    if not rec:
        raise HTTPException(400, "Token inválido")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(400, "Token expirado")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_pw(data.password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"ok": True}

# ============ SETTINGS ============
@api.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    return {k: user.get(k, "") for k in
            ["business_name", "owner_name", "phone", "whatsapp",
             "address", "city", "currency", "receipt_text"]}

@api.put("/settings")
async def update_settings(data: SettingsIn, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": data.model_dump()})
    return {"ok": True}

# ============ CLIENTS ============
async def next_client_code(user_id: str) -> str:
    count = await db.clients.count_documents({"user_id": user_id})
    return f"C{count+1:04d}"

@api.get("/clients")
async def list_clients(q: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"first_name": rx}, {"last_name": rx},
                        {"document": rx}, {"phone": rx}, {"code": rx}]
    docs = await db.clients.find(query).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]

@api.post("/clients")
async def create_client(data: ClientIn, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"],
                "code": await next_client_code(user["id"]),
                "created_at": iso(now_utc())})
    await db.clients.insert_one(doc)
    return clean(doc)

@api.get("/clients/{cid}")
async def get_client(cid: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": cid, "user_id": user["id"]})
    if not c: raise HTTPException(404, "Cliente no encontrado")
    loans = await db.loans.find({"client_id": cid, "user_id": user["id"]}).sort("created_at", -1).to_list(500)
    return {"client": clean(c), "loans": [clean(l) for l in loans]}

@api.put("/clients/{cid}")
async def update_client(cid: str, data: ClientIn, user=Depends(get_current_user)):
    r = await db.clients.update_one({"id": cid, "user_id": user["id"]},
                                    {"$set": data.model_dump()})
    if not r.matched_count: raise HTTPException(404, "Cliente no encontrado")
    return {"ok": True}

# ============ LOANS ============
def modality_days(m: str) -> int:
    return {"diario": 1, "semanal": 7, "quincenal": 15, "mensual": 30}[m]

def build_schedule(capital: float, rate: float, n: int, modality: str, first_due: str):
    interest = round(capital * rate / 100)
    total = capital + interest
    per = round(total / n)
    step = modality_days(modality)
    d0 = datetime.strptime(first_due, "%Y-%m-%d").date()
    schedule = []
    for i in range(n):
        due = d0 + timedelta(days=step * i)
        amount = per if i < n - 1 else (total - per * (n - 1))
        schedule.append({"number": i + 1, "due_date": due.isoformat(),
                         "amount": amount, "status": "pendiente",
                         "paid_amount": 0, "paid_at": None})
    return interest, total, per, schedule

@api.post("/loans/calculate")
async def calc_loan(data: LoanIn, user=Depends(get_current_user)):
    interest, total, per, schedule = build_schedule(
        data.capital, data.interest_rate, data.installments, data.modality, data.first_due_date)
    return {"interest": interest, "total": total, "installment_amount": per, "schedule": schedule}

@api.get("/loans")
async def list_loans(user=Depends(get_current_user)):
    docs = await db.loans.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    client_ids = list({l["client_id"] for l in docs})
    clients = await db.clients.find(
        {"id": {"$in": client_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "code": 1}
    ).to_list(len(client_ids)) if client_ids else []
    cmap = {c["id"]: c for c in clients}
    result = []
    for l in docs:
        clean(l)
        l["client"] = cmap.get(l["client_id"])
        result.append(l)
    return result

@api.post("/loans")
async def create_loan(data: LoanIn, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": data.client_id, "user_id": user["id"]})
    if not c: raise HTTPException(404, "Cliente no encontrado")
    interest, total, per, schedule = build_schedule(
        data.capital, data.interest_rate, data.installments, data.modality, data.first_due_date)
    lid = new_id()
    for s in schedule:
        s["id"] = new_id()
        s["loan_id"] = lid
    loan = {
        "id": lid, "user_id": user["id"], "client_id": data.client_id,
        "capital": data.capital, "interest_rate": data.interest_rate,
        "interest": interest, "total": total, "installment_amount": per,
        "installments_count": data.installments, "modality": data.modality,
        "start_date": data.start_date, "first_due_date": data.first_due_date,
        "status": "activo", "paid_amount": 0, "renewed_from": None,
        "created_at": iso(now_utc()),
    }
    await db.loans.insert_one(loan)
    await db.installments.insert_many(schedule)
    return clean(loan)

async def loan_stats(loan):
    installs = await db.installments.find({"loan_id": loan["id"]}).sort("number", 1).to_list(500)
    for i in installs: clean(i)
    today = date.today().isoformat()
    paid = sum(i["paid_amount"] for i in installs)
    paid_count = sum(1 for i in installs if i["status"] == "pagada")
    overdue = sum(1 for i in installs if i["status"] in ("pendiente", "pago parcial") and i["due_date"] < today)
    pending = sum(1 for i in installs if i["status"] != "pagada" and i["status"] != "cancelada")
    return {"installments": installs, "paid_amount": paid, "paid_count": paid_count,
            "overdue_count": overdue, "pending_count": pending,
            "balance": loan["total"] - paid}

@api.get("/loans/{lid}")
async def get_loan(lid: str, user=Depends(get_current_user)):
    loan = await db.loans.find_one({"id": lid, "user_id": user["id"]})
    if not loan: raise HTTPException(404, "Préstamo no encontrado")
    clean(loan)
    stats = await loan_stats(loan)
    c = await db.clients.find_one({"id": loan["client_id"]}, {"_id": 0})
    payments = await db.payments.find({"loan_id": lid}).sort("created_at", -1).to_list(500)
    return {"loan": loan, "client": c, **stats, "payments": [clean(p) for p in payments]}

@api.post("/loans/{lid}/pay")
async def pay(lid: str, data: PaymentIn, user=Depends(get_current_user)):
    loan = await db.loans.find_one({"id": lid, "user_id": user["id"]})
    if not loan: raise HTTPException(404, "Préstamo no encontrado")
    remaining = data.amount
    # Find target installment
    if data.installment_id:
        installs = await db.installments.find(
            {"loan_id": lid, "id": data.installment_id}).to_list(1)
    else:
        installs = await db.installments.find(
            {"loan_id": lid, "status": {"$in": ["pendiente", "pago parcial"]}}
        ).sort("number", 1).to_list(500)
    # Apply payment
    for inst in installs:
        if remaining <= 0: break
        due_left = inst["amount"] - inst["paid_amount"]
        pay_amt = min(remaining, due_left)
        new_paid = inst["paid_amount"] + pay_amt
        new_status = "pagada" if new_paid >= inst["amount"] else "pago parcial"
        await db.installments.update_one({"id": inst["id"]}, {"$set": {
            "paid_amount": new_paid, "status": new_status,
            "paid_at": iso(now_utc()) if new_status == "pagada" else inst.get("paid_at"),
        }})
        remaining -= pay_amt
    payment = {"id": new_id(), "loan_id": lid, "user_id": user["id"],
               "client_id": loan["client_id"], "amount": data.amount,
               "type": "cobro", "notes": data.notes,
               "created_at": iso(now_utc())}
    await db.payments.insert_one(payment)
    # Update loan status
    stats = await loan_stats(loan)
    if stats["balance"] <= 0:
        await db.loans.update_one({"id": lid}, {"$set": {"status": "cancelado", "paid_amount": loan["total"]}})
    else:
        await db.loans.update_one({"id": lid}, {"$set": {"paid_amount": loan["total"] - stats["balance"]}})
    return clean(payment)

@api.post("/loans/{lid}/cancel")
async def cancel_loan(lid: str, data: CancelIn, user=Depends(get_current_user)):
    loan = await db.loans.find_one({"id": lid, "user_id": user["id"]})
    if not loan: raise HTTPException(404, "Préstamo no encontrado")
    # Mark remaining installments as cancelled and record payment
    await db.installments.update_many(
        {"loan_id": lid, "status": {"$in": ["pendiente", "pago parcial"]}},
        {"$set": {"status": "cancelada", "paid_at": iso(now_utc())}})
    payment = {"id": new_id(), "loan_id": lid, "user_id": user["id"],
               "client_id": loan["client_id"], "amount": data.amount,
               "type": "cancelacion", "notes": data.notes,
               "created_at": iso(now_utc())}
    await db.payments.insert_one(payment)
    await db.loans.update_one({"id": lid}, {"$set": {
        "status": "cancelado_anticipado",
        "cancelled_at": iso(now_utc()),
        "cancellation_amount": data.amount,
    }})
    return {"ok": True}

@api.post("/loans/{lid}/renew")
async def renew_loan(lid: str, data: RenewIn, user=Depends(get_current_user)):
    old = await db.loans.find_one({"id": lid, "user_id": user["id"]})
    if not old: raise HTTPException(404, "Préstamo no encontrado")
    stats = await loan_stats(old)
    new_capital = stats["balance"] + data.additional_capital
    # Cancel old loan
    await db.installments.update_many(
        {"loan_id": lid, "status": {"$in": ["pendiente", "pago parcial"]}},
        {"$set": {"status": "cancelada"}})
    await db.loans.update_one({"id": lid}, {"$set": {"status": "renovado"}})
    # Create new loan
    interest, total, per, schedule = build_schedule(
        new_capital, data.interest_rate, data.installments, data.modality, data.first_due_date)
    new_lid = new_id()
    for s in schedule:
        s["id"] = new_id(); s["loan_id"] = new_lid
    new_loan = {
        "id": new_lid, "user_id": user["id"], "client_id": old["client_id"],
        "capital": new_capital, "interest_rate": data.interest_rate,
        "interest": interest, "total": total, "installment_amount": per,
        "installments_count": data.installments, "modality": data.modality,
        "start_date": data.start_date, "first_due_date": data.first_due_date,
        "status": "activo", "paid_amount": 0, "renewed_from": lid,
        "additional_capital": data.additional_capital,
        "created_at": iso(now_utc()),
    }
    await db.loans.insert_one(new_loan)
    await db.installments.insert_many(schedule)
    return clean(new_loan)

# ============ EXPENSES / WITHDRAWALS ============
@api.get("/expenses")
async def list_expenses(user=Depends(get_current_user)):
    docs = await db.expenses.find({"user_id": user["id"]}).sort("date", -1).to_list(1000)
    return [clean(d) for d in docs]

@api.post("/expenses")
async def create_expense(data: ExpenseIn, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"],
                "date": data.date or date.today().isoformat(),
                "created_at": iso(now_utc())})
    await db.expenses.insert_one(doc)
    return clean(doc)

@api.get("/withdrawals")
async def list_withdrawals(user=Depends(get_current_user)):
    docs = await db.withdrawals.find({"user_id": user["id"]}).sort("date", -1).to_list(1000)
    return [clean(d) for d in docs]

@api.post("/withdrawals")
async def create_withdrawal(data: WithdrawalIn, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"],
                "date": data.date or date.today().isoformat(),
                "created_at": iso(now_utc())})
    await db.withdrawals.insert_one(doc)
    return clean(doc)

# ============ DASHBOARD / CASH / REPORTS ============
async def compute_stats(user_id: str):
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()

    clients_total = await db.clients.count_documents({"user_id": user_id})
    loans = await db.loans.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "client_id": 1, "capital": 1, "interest": 1, "status": 1, "renewed_from": 1, "additional_capital": 1}
    ).to_list(5000)
    active_loans = [l for l in loans if l["status"] == "activo"]
    active_clients = len({l["client_id"] for l in active_loans})
    capital_lent = sum(l["capital"] for l in active_loans)
    total_granted = sum(l["capital"] for l in loans)

    loan_ids = [l["id"] for l in loans]
    installs = await db.installments.find(
        {"loan_id": {"$in": loan_ids}},
        {"_id": 0, "loan_id": 1, "amount": 1, "paid_amount": 1, "status": 1, "due_date": 1}
    ).to_list(50000) if loan_ids else []
    loan_by_id = {l["id"]: l for l in loans}
    pending_amount = 0
    overdue_count = 0
    late_clients_ids = set()
    for i in installs:
        if i["status"] in ("pendiente", "pago parcial"):
            pending_amount += (i["amount"] - i["paid_amount"])
            if i["due_date"] < today:
                overdue_count += 1
                loan = loan_by_id.get(i["loan_id"])
                if loan: late_clients_ids.add(loan["client_id"])

    payments = await db.payments.find(
        {"user_id": user_id},
        {"_id": 0, "loan_id": 1, "amount": 1, "created_at": 1}
    ).to_list(50000)
    collected_today = 0; collected_week = 0; collected_month = 0
    payments_by_loan = {}
    for p in payments:
        pd = p["created_at"][:10]
        if pd == today: collected_today += p["amount"]
        if pd >= week_start: collected_week += p["amount"]
        if pd >= month_start: collected_month += p["amount"]
        payments_by_loan[p["loan_id"]] = payments_by_loan.get(p["loan_id"], 0) + p["amount"]
    interest_collected = 0
    for l in loans:
        lp = payments_by_loan.get(l["id"], 0)
        if lp > l["capital"]:
            interest_collected += min(lp - l["capital"], l.get("interest", 0))

    renewals = [l for l in loans if l.get("renewed_from")]
    renewals_count = len(renewals)
    renewals_amount = sum(l.get("additional_capital", 0) for l in renewals)

    expenses = await db.expenses.find(
        {"user_id": user_id},
        {"_id": 0, "amount": 1, "date": 1}
    ).to_list(5000)
    exp_month = sum(e["amount"] for e in expenses if e["date"] >= month_start)
    withdrawals = await db.withdrawals.find(
        {"user_id": user_id},
        {"_id": 0, "amount": 1, "date": 1}
    ).to_list(5000)
    with_month = sum(w["amount"] for w in withdrawals if w["date"] >= month_start)

    total_collected = sum(p["amount"] for p in payments)
    available_balance = total_collected - sum(l["capital"] for l in loans) - sum(e["amount"] for e in expenses) - sum(w["amount"] for w in withdrawals) + sum(l["capital"] for l in loans if l["status"] != "activo")

    return {
        "stats": {
            "clients_total": clients_total,
            "active_clients": active_clients,
            "active_loans": len(active_loans),
            "capital_lent": capital_lent,
            "total_granted": total_granted,
            "pending_amount": pending_amount,
            "collected_today": collected_today,
            "collected_week": collected_week,
            "collected_month": collected_month,
            "interest_collected": interest_collected,
            "renewals_count": renewals_count,
            "renewals_amount": renewals_amount,
            "expenses_month": exp_month,
            "withdrawals_month": with_month,
            "available_balance": available_balance,
            "overdue_count": overdue_count,
            "late_clients_count": len(late_clients_ids),
        },
        "payments": payments,
    }

@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    result = await compute_stats(user["id"])
    trend = []
    today = date.today()
    payments = result["payments"]
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        total = sum(p["amount"] for p in payments if p["created_at"][:10] == d)
        trend.append({"date": d, "amount": total})
    return {**result["stats"], "trend_7d": trend}

@api.get("/cash/today")
async def cash_today(user=Depends(get_current_user)):
    today = date.today().isoformat()
    payments = await db.payments.find({"user_id": user["id"]}).to_list(50000)
    loans = await db.loans.find({"user_id": user["id"]}).to_list(5000)
    expenses = await db.expenses.find({"user_id": user["id"]}).to_list(5000)
    withdrawals = await db.withdrawals.find({"user_id": user["id"]}).to_list(5000)
    income = sum(p["amount"] for p in payments if p["created_at"][:10] == today)
    new_loans = sum(l["capital"] for l in loans if l["created_at"][:10] == today and not l.get("renewed_from"))
    renewals = sum(l.get("additional_capital", 0) for l in loans if l["created_at"][:10] == today and l.get("renewed_from"))
    exp = sum(e["amount"] for e in expenses if e["date"] == today)
    wit = sum(w["amount"] for w in withdrawals if w["date"] == today)
    prev_close = await db.cash_closes.find({"user_id": user["id"]}).sort("date", -1).to_list(1)
    initial = prev_close[0]["final"] if prev_close else 0
    final = initial + income - new_loans - renewals - exp - wit
    return {
        "date": today, "initial_balance": initial, "income": income,
        "new_loans": new_loans, "renewals": renewals,
        "expenses": exp, "withdrawals": wit, "final_balance": final,
    }

@api.post("/cash/close")
async def cash_close(user=Depends(get_current_user)):
    data = await cash_today(user)
    doc = {"id": new_id(), "user_id": user["id"], **data,
           "final": data["final_balance"], "closed_at": iso(now_utc())}
    await db.cash_closes.insert_one(doc)
    return clean(doc)

@api.get("/cash/closes")
async def cash_closes(user=Depends(get_current_user)):
    docs = await db.cash_closes.find({"user_id": user["id"]}).sort("date", -1).to_list(200)
    return [clean(d) for d in docs]

@api.get("/reports")
async def reports(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    client_id: Optional[str] = None,
    modality: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user)
):
    lq = {"user_id": user["id"]}
    if client_id: lq["client_id"] = client_id
    if modality: lq["modality"] = modality
    if status: lq["status"] = status
    if from_date or to_date:
        rng = {}
        if from_date: rng["$gte"] = from_date
        if to_date: rng["$lte"] = to_date + "T23:59:59"
        lq["created_at"] = rng
    loans = await db.loans.find(lq).to_list(5000)

    pq = {"user_id": user["id"]}
    if from_date or to_date:
        rng = {}
        if from_date: rng["$gte"] = from_date
        if to_date: rng["$lte"] = to_date + "T23:59:59"
        pq["created_at"] = rng
    payments = await db.payments.find(pq).to_list(50000)

    eq = {"user_id": user["id"]}
    if from_date or to_date:
        rng = {}
        if from_date: rng["$gte"] = from_date
        if to_date: rng["$lte"] = to_date
        eq["date"] = rng
    expenses = await db.expenses.find(eq).to_list(5000)
    withdrawals = await db.withdrawals.find(eq).to_list(5000)

    return {
        "loans": [clean(l) for l in loans],
        "payments": [clean(p) for p in payments],
        "expenses": [clean(e) for e in expenses],
        "withdrawals": [clean(w) for w in withdrawals],
        "totals": {
            "loans_amount": sum(l["capital"] for l in loans),
            "payments_amount": sum(p["amount"] for p in payments),
            "expenses_amount": sum(e["amount"] for e in expenses),
            "withdrawals_amount": sum(w["amount"] for w in withdrawals),
        }
    }

@api.get("/overdue")
async def overdue_list(user=Depends(get_current_user)):
    today = date.today().isoformat()
    loans = await db.loans.find({"user_id": user["id"], "status": "activo"}).to_list(5000)
    loan_ids = [l["id"] for l in loans]
    if not loan_ids:
        return []
    all_overdue = await db.installments.find({
        "loan_id": {"$in": loan_ids},
        "status": {"$in": ["pendiente", "pago parcial"]},
        "due_date": {"$lt": today}
    }, {"_id": 0, "loan_id": 1, "amount": 1, "paid_amount": 1}).to_list(50000)
    by_loan = {}
    for i in all_overdue:
        by_loan.setdefault(i["loan_id"], []).append(i)
    client_ids = list({l["client_id"] for l in loans if l["id"] in by_loan})
    clients = await db.clients.find({"id": {"$in": client_ids}}, {"_id": 0}).to_list(len(client_ids)) if client_ids else []
    cmap = {c["id"]: c for c in clients}
    result = []
    for l in loans:
        if l["id"] in by_loan:
            overdue = by_loan[l["id"]]
            result.append({
                "loan_id": l["id"], "client": cmap.get(l["client_id"]),
                "overdue_count": len(overdue),
                "overdue_amount": sum(i["amount"] - i["paid_amount"] for i in overdue),
            })
    return result

@api.get("/")
async def root():
    return {"status": "ok"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.clients.create_index([("user_id", 1), ("code", 1)])
    await db.loans.create_index([("user_id", 1), ("client_id", 1)])
    await db.installments.create_index([("loan_id", 1), ("number", 1)])
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "name": "Prestamista",
            "password_hash": hash_pw(admin_pw),
            "business_name": "Mi Financiera", "owner_name": "Prestamista",
            "phone": "", "whatsapp": "", "address": "", "city": "",
            "currency": "Gs.", "receipt_text": "Gracias por su preferencia",
            "role": "owner", "created_at": iso(now_utc()),
        })
    elif not verify_pw(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_pw(admin_pw)}})

@app.on_event("shutdown")
async def shutdown():
    client.close()
