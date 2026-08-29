"""Postgres storage for accounts and each account's synced app-state blob.

One row per user in `users`, one row per user in `user_state` holding the
exact JSON payload the frontend already builds for localStorage (see
app/src/store/initialState.ts) — so the backend doesn't need its own
schema for net worth / budgets / transactions, it just stores and returns
that blob per account.

Connects to whatever Postgres instance DATABASE_URL points at (Supabase,
Neon, or a local Postgres for testing) — set it in backend/.env, e.g.:

    DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

Use Supabase's "Session pooler" connection string (not "Transaction
pooler") — this backend is a long-lived process holding connections open
across requests, not a serverless/edge function.
"""

import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get("DATABASE_URL")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_state (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def init_db() -> None:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set — add it to backend/.env (see db.py's "
            "module docstring for the format)."
        )
    with get_conn() as conn:
        conn.execute(SCHEMA)


@contextmanager
def get_conn():
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
