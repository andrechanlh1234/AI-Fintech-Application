"""SQLite storage for accounts and each account's synced app-state blob.

One row per user in `users`, one row per user in `user_state` holding the
exact JSON payload the frontend already builds for localStorage (see
app/src/store/initialState.ts) — so the backend doesn't need its own
schema for net worth / budgets / transactions, it just stores and returns
that blob per account.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "cukai.db"

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


def _migrate_users_table(conn: sqlite3.Connection) -> None:
    """Upgrade a `users` table created before Google sign-in existed
    (password_hash NOT NULL, no google_sub column) — SQLite can't ALTER
    COLUMN to drop a NOT NULL constraint, so rebuild the table in place."""
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
    if "google_sub" in cols:
        return  # already migrated (or a fresh DB created with the schema above)
    conn.execute("ALTER TABLE users RENAME TO users_old")
    conn.execute(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            google_sub TEXT UNIQUE,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "INSERT INTO users (id, email, password_hash, created_at) "
        "SELECT id, email, password_hash, created_at FROM users_old"
    )
    conn.execute("DROP TABLE users_old")


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        _migrate_users_table(conn)


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
