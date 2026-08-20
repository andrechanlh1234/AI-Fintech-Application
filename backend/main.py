"""Cukai backend: accounts, per-account synced app state, and receipt OCR.

Run from the repo root (so `pipeline` resolves) with:
    backend/.venv/bin/uvicorn backend.main:app --reload --port 8000

Data model is deliberately thin: `user_state.state_json` stores the exact
JSON blob the frontend already builds for localStorage (see
app/src/store/initialState.ts's persistState/loadPersisted) — the backend
doesn't re-model net worth, budgets, or transactions, it just stores and
returns that blob per account.
"""

import json
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

from backend import auth
from backend.db import get_conn, init_db
from pipeline.receipt_ocr import process_receipt_image

app = FastAPI(title="Cukai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ---- schemas ----

class Credentials(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class StatePayload(BaseModel):
    state: dict | None = None


# ---- auth dependency ----

def current_user_id(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if creds is None:
        raise HTTPException(401, "Missing token")
    user_id = auth.decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")
    return user_id


# ---- auth endpoints ----

@app.post("/auth/signup", response_model=AuthResponse)
def signup(body: Credentials):
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
        if existing:
            raise HTTPException(409, "An account with this email already exists")
        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, body.email, auth.hash_password(body.password), datetime.now(timezone.utc).isoformat()),
        )
    return {"token": auth.create_token(user_id), "user": {"id": user_id, "email": body.email}}


@app.post("/auth/login", response_model=AuthResponse)
def login(body: Credentials):
    with get_conn() as conn:
        row = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    if not row or not auth.verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": auth.create_token(row["id"]), "user": {"id": row["id"], "email": body.email}}


@app.get("/auth/me")
def me(user_id: str = Depends(current_user_id)):
    with get_conn() as conn:
        row = conn.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(401, "Account no longer exists")
    return {"id": row["id"], "email": row["email"]}


# ---- state sync endpoints ----

@app.get("/state", response_model=StatePayload)
def get_state(user_id: str = Depends(current_user_id)):
    with get_conn() as conn:
        row = conn.execute("SELECT state_json FROM user_state WHERE user_id = ?", (user_id,)).fetchone()
    return {"state": json.loads(row["state_json"]) if row else None}


@app.put("/state")
def put_state(body: StatePayload, user_id: str = Depends(current_user_id)):
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO user_state (user_id, state_json, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
            """,
            (user_id, json.dumps(body.state), datetime.now(timezone.utc).isoformat()),
        )
    return {"ok": True}


# ---- receipt OCR ----
# Deliberately not behind auth — it's a stateless image-in/record-out
# utility with no access to any account's data, so it also works for
# guests who skipped account creation.

@app.post("/receipts/scan")
async def scan_receipt(file: UploadFile = File(...)):
    suffix = Path(file.filename or "receipt.jpg").suffix or ".jpg"
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            record = process_receipt_image(tmp.name)
        except Exception as e:
            raise HTTPException(422, f"Could not read this receipt: {e}") from e
    return record.to_dict()
