"""Password hashing and JWT session tokens.

The signing secret comes from the CUKAI_JWT_SECRET environment variable
when set — required for any real deployment, since every session token
(and therefore every account) is only as safe as this value. For local
dev, where setting an env var every run is friction with no real payoff,
it falls back to a secret generated once and cached on disk (gitignored).
"""

import hashlib
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
        # Defence in depth: only a plain session token authenticates a
        # request. Reject anything carrying a `purpose` claim.
        if payload.get("purpose"):
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


# ---- password reset: short numeric codes ----
#
# A 6-digit code emailed to the user, entered back in the app — no link, so
# it works from the installed native app with no deep-linking. Codes are
# held in memory (single-process dev server; a multi-worker deployment would
# move this to the DB or Redis), hashed, single-use, 15-minute TTL, capped
# at 5 guesses.

RESET_CODE_TTL_MINUTES = 15
RESET_CODE_MAX_ATTEMPTS = 5
_RESET_CODES: dict[str, dict] = {}  # user_id -> {hash, expires, attempts}


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def create_reset_code(user_id: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    _RESET_CODES[user_id] = {
        "hash": _hash_code(code),
        "expires": datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES),
        "attempts": 0,
    }
    return code


def verify_reset_code(user_id: str, code: str) -> bool:
    entry = _RESET_CODES.get(user_id)
    if not entry:
        return False
    if datetime.now(timezone.utc) >= entry["expires"] or entry["attempts"] >= RESET_CODE_MAX_ATTEMPTS:
        _RESET_CODES.pop(user_id, None)
        return False
    entry["attempts"] += 1
    if secrets.compare_digest(entry["hash"], _hash_code((code or "").strip())):
        _RESET_CODES.pop(user_id, None)  # single use
        return True
    return False
