"""Password hashing and JWT session tokens.

The signing secret is generated once and cached on disk (gitignored) so
tokens survive server restarts during local dev; in a real deployment this
would come from an environment variable instead.
"""

import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt

SECRET_PATH = Path(__file__).parent / ".jwt_secret"
ALGORITHM = "HS256"
TOKEN_TTL_DAYS = 30


def _load_or_create_secret() -> str:
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
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
