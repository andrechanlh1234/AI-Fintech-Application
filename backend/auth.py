"""Password hashing and JWT session tokens.

The signing secret comes from the CUKAI_JWT_SECRET environment variable
when set — required for any real deployment, since every session token
(and therefore every account) is only as safe as this value. For local
dev, where setting an env var every run is friction with no real payoff,
it falls back to a secret generated once and cached on disk (gitignored).
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt

SECRET_PATH = Path(__file__).parent / ".jwt_secret"
ALGORITHM = "HS256"
TOKEN_TTL_DAYS = 30


def _load_or_create_secret() -> str:
    env_secret = os.environ.get("CUKAI_JWT_SECRET")
    if env_secret:
        return env_secret
    if SECRET_PATH.exists():
        return SECRET_PATH.read_text().strip()
    secret = secrets.token_hex(32)
    SECRET_PATH.write_text(secret)
    return secret


SECRET = _load_or_create_secret()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        # Only a plain session token authenticates a request. A token that
        # carries a `purpose` claim (currently just the password-reset token,
        # which is emailed in a link and routinely leaks via server logs,
        # browser history and Referer headers) must never be accepted here —
        # otherwise a leaked reset link is a full 60-minute account takeover.
        if payload.get("purpose"):
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


RESET_TOKEN_TTL_MINUTES = 60


def create_reset_token(user_id: str) -> str:
    # A short-lived JWT with its own "purpose" claim, rather than a new DB
    # table — it's self-verifying (no lookup needed) and expires on its own.
    payload = {
        "sub": user_id,
        "purpose": "reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_reset_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        if payload.get("purpose") != "reset":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
