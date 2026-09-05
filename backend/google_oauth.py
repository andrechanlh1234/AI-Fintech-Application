"""Google OAuth login ("Continue with Google") — Authorization Code flow.

Config via env vars (see backend/.env, loaded by main.py via python-dotenv
before this module is imported):
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — from Google Cloud Console
  GOOGLE_REDIRECT_URI — defaults to http://127.0.0.1:8000/auth/google/callback
  FRONTEND_URL         — defaults to http://localhost:5173

See backend/GOOGLE_OAUTH_SETUP.md for how to obtain the client id/secret.
Deliberately not behind our own auth — these two routes are how a browser
*gets* a session, not something an already-authenticated request calls.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import RedirectResponse

from backend import auth
from backend.db import get_conn
from backend.email_service import send_welcome_email

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/auth/google/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# CSRF `state`, signed and stateless rather than held in an in-memory set.
# A set worked for a single always-on dev process, but on Render's
# free-tier instance -- which spins down after ~15 min idle and recycles on
# its own -- a login started right before a restart came back with an
# empty set on the other side: /auth/google/callback saw a `state` it had
# never heard of, redirected with oauth_error=bad_state, and the user
# landed back on the login screen with no visible reason why (bug report,
# 2026-09-04). A signed token verifies on its own, so it survives a restart
# between the two requests same as it would across two different workers.
#
# Reuses the session-token secret/algorithm (backend/auth.py) but the two
# are never interchangeable: this module only accepts a token whose
# `purpose` claim is "oauth_state", and auth.decode_token() only accepts
# one with no `purpose` claim at all -- see its docstring.
STATE_TTL_SECONDS = 600  # 10 minutes -- generous for the Google consent screen


def _create_state() -> str:
    payload = {
        "purpose": "oauth_state",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, auth.SECRET, algorithm=auth.ALGORITHM)


def _verify_state(state: str | None) -> bool:
    if not state:
        return False
    try:
        payload = jwt.decode(state, auth.SECRET, algorithms=[auth.ALGORITHM])
    except jwt.PyJWTError:
        return False
    return payload.get("purpose") == "oauth_state"


@router.get("/auth/google/login")
def google_login():
    if not CLIENT_ID:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=not_configured")
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": _create_state(),
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/auth/google/callback")
async def google_callback(
    background_tasks: BackgroundTasks, code: str | None = None, state: str | None = None, error: str | None = None
):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error={error or 'missing_code'}")
    if not _verify_state(state):
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=bad_state")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=token_exchange_failed")
        access_token = token_res.json().get("access_token")
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=token_exchange_failed")

        userinfo_res = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if userinfo_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=userinfo_failed")
        info = userinfo_res.json()

    email = info.get("email")
    google_sub = info.get("sub")
    name = info.get("name")
    if not email or not google_sub:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=no_email")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE email = %s OR google_sub = %s", (email, google_sub)
        ).fetchone()
        if row:
            user_id = row["id"]
            conn.execute("UPDATE users SET google_sub = %s WHERE id = %s", (google_sub, user_id))
        else:
            user_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO users (id, email, password_hash, google_sub, created_at) VALUES (%s, %s, NULL, %s, %s)",
                (user_id, email, google_sub, datetime.now(timezone.utc).isoformat()),
            )
            background_tasks.add_task(send_welcome_email, email, name)

    token = auth.create_token(user_id)
    return RedirectResponse(f"{FRONTEND_URL}/?oauth_token={token}")
