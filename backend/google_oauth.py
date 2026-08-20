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
import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from backend import auth
from backend.db import get_conn

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/auth/google/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# CSRF state tokens, held in memory. Fine for a single-process local dev
# server; a multi-process production deployment would need a shared store
# (e.g. Redis) instead, since a request can land on a different worker.
_PENDING_STATES: set[str] = set()


@router.get("/auth/google/login")
def google_login():
    if not CLIENT_ID:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=not_configured")
    state = secrets.token_urlsafe(16)
    _PENDING_STATES.add(state)
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/auth/google/callback")
async def google_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error={error or 'missing_code'}")
    if not state or state not in _PENDING_STATES:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=bad_state")
    _PENDING_STATES.discard(state)

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
    if not email or not google_sub:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=no_email")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE email = ? OR google_sub = ?", (email, google_sub)
        ).fetchone()
        if row:
            user_id = row["id"]
            conn.execute("UPDATE users SET google_sub = ? WHERE id = ?", (google_sub, user_id))
        else:
            user_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO users (id, email, password_hash, google_sub, created_at) VALUES (?, ?, NULL, ?, ?)",
                (user_id, email, google_sub, datetime.now(timezone.utc).isoformat()),
            )

    token = auth.create_token(user_id)
    return RedirectResponse(f"{FRONTEND_URL}/?oauth_token={token}")
