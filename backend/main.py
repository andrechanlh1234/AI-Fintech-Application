"""Cukai backend: accounts, per-account synced app state, and receipt OCR.

Run from the repo root (so `pipeline` resolves) with:
    backend/.venv/bin/uvicorn backend.main:app --reload --port 8000

Data model is deliberately thin: `user_state.state_json` stores the exact
JSON blob the frontend already builds for localStorage (see
app/src/store/initialState.ts's persistState/loadPersisted) — the backend
doesn't re-model net worth, budgets, or transactions, it just stores and
returns that blob per account.
"""

from dotenv import load_dotenv

load_dotenv()  # backend/.env, if present — must run before any module below reads os.environ

import json
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

from backend import auth
from backend.cors import allowed_origins
from backend.state_sync import ConflictError, check_expected_version
from backend.state_validation import exceeds_max_depth
from backend.ai_chat import AiNotConfigured, generate_ai_reply
from backend.ai_chat import logger as ai_logger
from backend.db import get_conn, init_db
from backend.email_service import send_password_reset_email, send_welcome_email
from backend.google_oauth import router as google_oauth_router
from backend.rate_limit import enforce_rate_limit
from pipeline.receipt_ocr import process_receipt_image
from pipeline.statement_parser import parse_csv, parse_statement_pdf

app = FastAPI(title="Cukai API")
app.include_router(google_oauth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    # Also allow any private-LAN IP on the dev port, so a phone on the same
    # wifi/hotspot as this machine can reach the backend for real-device
    # testing without needing this list updated every time the network
    # changes. Covers the common private ranges (192.168.x, 172.16-31.x,
    # 10.x) — dev-only, never applies to a real deployment's public origin.
    # The trycloudflare.com clause covers the frontend's Cloudflare Quick
    # Tunnel origin (see vite.config.ts's `preview.allowedHosts`) — a fresh
    # random subdomain each time a tunnel opens, for testing the installed
    # PWA over real HTTPS from a phone.
    allow_origin_regex=(
        r"http://(192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):5173"
        r"|https://[a-z0-9-]+\.trycloudflare\.com"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)

# Upload / payload ceilings. A phone receipt photo or a bank-statement PDF is
# comfortably under 8 MB; a real synced state blob is well under 10 KB. These
# are guardrails against a scripted client exhausting memory on a small host,
# not limits a genuine user should ever hit.
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_STATE_BYTES = 1024 * 1024


@app.on_event("startup")
async def _startup() -> None:
    init_db()
    # No app-level backup loop — Supabase/Postgres does continuous
    # point-in-time-recovery backups on its own (see backend/db.py).


# ---- schemas ----

class Credentials(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class StatePayload(BaseModel):
    state: dict | None = None
    # The `updated_at` this client last saw (from GET /state or a prior
    # PUT's response) -- echoed back so the server can detect a write
    # racing a newer one and reject it instead of silently overwriting
    # (bug-report H2, deep half). None on a client's very first write, when
    # there is nothing yet to have last seen.
    expected_updated_at: str | None = None


class StateResponse(BaseModel):
    state: dict | None = None
    updated_at: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class AiChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    # Real-data snapshot from selectAiContext (net worth, budget, tax,
    # subscriptions) — grounds the reply so Gemini answers from what the user
    # actually entered instead of guessing plausible-sounding figures.
    context: dict | None = None


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
def signup(body: Credentials, background_tasks: BackgroundTasks, request: Request):
    enforce_rate_limit(request, "signup", max_attempts=5, window_seconds=60 * 60)
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = %s", (body.email,)).fetchone()
        if existing:
            raise HTTPException(409, "An account with this email already exists")
        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, email, password_hash, created_at) VALUES (%s, %s, %s, %s)",
            (user_id, body.email, auth.hash_password(body.password), datetime.now(timezone.utc).isoformat()),
        )
    background_tasks.add_task(send_welcome_email, body.email, None)
    return {"token": auth.create_token(user_id), "user": {"id": user_id, "email": body.email}}


@app.post("/auth/login", response_model=AuthResponse)
def login(body: Credentials, request: Request):
    enforce_rate_limit(request, "login", max_attempts=10, window_seconds=15 * 60)
    with get_conn() as conn:
        row = conn.execute("SELECT id, password_hash FROM users WHERE email = %s", (body.email,)).fetchone()
    if not row or not row["password_hash"]:
        raise HTTPException(401, "Incorrect email or password")
    if not auth.verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": auth.create_token(row["id"]), "user": {"id": row["id"], "email": body.email}}


@app.post("/auth/forgot-password")
def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks, request: Request):
    enforce_rate_limit(request, "forgot-password", max_attempts=3, window_seconds=60 * 60)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE email = %s AND password_hash IS NOT NULL", (body.email,)
        ).fetchone()
    # Always return the same response whether or not the account exists (and
    # whether it's a Google-only account with no password to reset) — telling
    # an attacker which emails have accounts is its own information leak.
    if row:
        code = auth.create_reset_code(row["id"])
        background_tasks.add_task(send_password_reset_email, body.email, code)
    return {"ok": True}


@app.post("/auth/reset-password", response_model=AuthResponse)
def reset_password(body: ResetPasswordRequest, request: Request):
    enforce_rate_limit(request, "reset-password", max_attempts=10, window_seconds=60 * 60)
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email FROM users WHERE email = %s AND password_hash IS NOT NULL", (body.email,)
        ).fetchone()
        # Same generic error whether the account is missing or the code is
        # wrong, so this can't be used to probe which emails have accounts.
        if not row or not auth.verify_reset_code(row["id"], body.code):
            raise HTTPException(400, "That code is invalid or has expired")
        conn.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (auth.hash_password(body.new_password), row["id"]),
        )
    # Sign them straight in — they've just proven control of the inbox.
    token = auth.create_token(row["id"])
    return {"token": token, "user": {"id": row["id"], "email": row["email"]}}


@app.get("/auth/me")
def me(user_id: str = Depends(current_user_id)):
    with get_conn() as conn:
        row = conn.execute("SELECT id, email FROM users WHERE id = %s", (user_id,)).fetchone()
    if not row:
        raise HTTPException(401, "Account no longer exists")
    return {"id": row["id"], "email": row["email"]}


# ---- state sync endpoints ----

@app.get("/state", response_model=StateResponse)
def get_state(user_id: str = Depends(current_user_id)):
    with get_conn() as conn:
        row = conn.execute("SELECT state_json, updated_at FROM user_state WHERE user_id = %s", (user_id,)).fetchone()
    if not row:
        return {"state": None, "updated_at": None}
    return {"state": json.loads(row["state_json"]), "updated_at": row["updated_at"]}


@app.put("/state")
def put_state(body: StatePayload, user_id: str = Depends(current_user_id)):
    serialized = json.dumps(body.state)
    if len(serialized) > MAX_STATE_BYTES:
        raise HTTPException(413, "State payload too large")
    # state_json is an opaque blob by design (no schema mirroring the
    # frontend shape -- see db.py), but a pathologically nested small
    # payload slips past the size cap above untouched. Reject it instead
    # of storing it (bug-report M7).
    if exceeds_max_depth(body.state):
        raise HTTPException(413, "State payload too deeply nested")

    with get_conn() as conn:
        row = conn.execute("SELECT updated_at FROM user_state WHERE user_id = %s", (user_id,)).fetchone()
        current_updated_at = row["updated_at"] if row else None
        try:
            check_expected_version(current_updated_at, body.expected_updated_at)
        except ConflictError as exc:
            raise HTTPException(
                409,
                {"message": "state changed since you last loaded it — reload before saving again", "updated_at": exc.current_updated_at},
            ) from exc

        now = datetime.now(timezone.utc).isoformat()
        if row is None:
            conn.execute(
                "INSERT INTO user_state (user_id, state_json, updated_at) VALUES (%s, %s, %s)",
                (user_id, serialized, now),
            )
        else:
            # Re-checks the version atomically against the database's
            # current committed value, closing the gap between the SELECT
            # above and this UPDATE -- a second write landing in that
            # window updates `updated_at` first, so this WHERE clause then
            # matches zero rows instead of clobbering it.
            result = conn.execute(
                "UPDATE user_state SET state_json = %s, updated_at = %s WHERE user_id = %s AND updated_at = %s",
                (serialized, now, user_id, current_updated_at),
            )
            if result.rowcount == 0:
                raise HTTPException(409, {"message": "state changed since you last loaded it — reload before saving again"})
    return {"ok": True, "updated_at": now}


# ---- receipt OCR ----
# Deliberately not behind auth — it's a stateless image-in/record-out
# utility with no access to any account's data, so it also works for
# guests who skipped account creation.

@app.post("/receipts/scan")
async def scan_receipt(request: Request, file: UploadFile = File(...)):
    enforce_rate_limit(request, "scan", max_attempts=30, window_seconds=10 * 60)
    suffix = Path(file.filename or "receipt.jpg").suffix or ".jpg"
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image too large — please use one under 8 MB")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            record = process_receipt_image(tmp.name)
        except Exception as e:
            raise HTTPException(422, f"Could not read this receipt: {e}") from e
    return record.to_dict()


# ---- statement upload ----
# Same auth stance as /receipts/scan — stateless file-in/records-out, no
# account data touched here. The frontend turns the returned records into
# pending review items (accept/reject), same flow as a scanned receipt;
# nothing is written to a real account until the user accepts it.

@app.post("/statements/scan")
async def scan_statement(request: Request, file: UploadFile = File(...)):
    enforce_rate_limit(request, "scan", max_attempts=30, window_seconds=10 * 60)
    filename = file.filename or "statement"
    suffix = Path(filename).suffix.lower()
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large — please use one under 8 MB")

    if suffix == ".csv":
        records, statement_type = parse_csv(data.decode("utf-8", errors="replace"))
    elif suffix == ".pdf":
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
            tmp.write(data)
            tmp.flush()
            try:
                records, statement_type = parse_statement_pdf(tmp.name)
            except Exception as e:
                raise HTTPException(422, f"Could not read this statement: {e}") from e
    else:
        raise HTTPException(400, "Only .csv and .pdf statements are supported")

    return {"statementType": statement_type, "records": [r.to_dict() for r in records]}


# ---- AI chat ----
# Deliberately not behind auth, same reasoning as /receipts/scan — no
# per-account data involved, works for guests too. Rate-limited at 20
# messages / 10 minutes per IP: generous for a real conversation, but
# enough to stop someone from scripting a loop against a free-tier
# Gemini quota that's shared across every user of this backend.

@app.post("/ai/chat")
def ai_chat(body: AiChatRequest, request: Request):
    enforce_rate_limit(request, "ai-chat", max_attempts=20, window_seconds=10 * 60)
    try:
        reply, source = generate_ai_reply(body.message, body.history, body.context)
        return {"reply": reply, "source": source}
    except AiNotConfigured:
        ai_logger.info("No AI provider configured — falling back to canned replies")
        return {"reply": None, "source": "canned"}
    except Exception:
        ai_logger.exception("AI call failed — falling back to canned replies")
        return {"reply": None, "source": "canned"}
