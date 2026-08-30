# Supabase migration design

## Context

The backend (`backend/`) currently runs on SQLite: one `users` table plus one
`user_state` table holding a single JSON blob per account (the entire
frontend state — transactions, budgets, subscriptions, net worth — exactly
as `app/src/store/initialState.ts` builds it for localStorage). `GET/PUT
/state` just reads and writes that blob whole; there is no server-side
querying of individual transactions today.

This only runs reachable from `localhost` plus LAN IPs for phone testing —
there is no hosted, durable, multi-device-reachable backend yet. That's the
gap this migration closes, ahead of Capacitor-wrapping the frontend and
beta testing with real users.

The current SQLite DB holds 7 dev/test accounts (the author's own account
plus a few friends who tried it) with small state blobs (33B–2KB). This is
not production data.

## Decisions

**Keep the blob-sync model, move it to Postgres.** The original project
roadmap assumed a relational schema ("tax-relief data is inherently
relational — transaction → category → cap → country ruleset") but the app
was actually built around a single synced JSON blob per user, and nothing
today needs server-side transaction queries. Decomposing into relational
tables now would be a large rewrite (new `/state` contract, frontend sync
logic changes, one-time data migration) for a need that doesn't exist yet.
Deferred until a feature actually requires it (e.g., server-side recurring
payment detection or anomaly flags across accounts).

**Keep custom auth, don't switch to Supabase Auth.** `backend/auth.py`
(bcrypt + JWT), `backend/google_oauth.py` (Google sign-in), and
`backend/email_service.py` (password reset emails) are already built and
working. Supabase Auth's main benefit — Row-Level Security tied to
`auth.uid()` — doesn't apply here since we're not adopting Supabase's auth
session model. Only `backend/db.py`'s storage layer changes.

**No ORM, no `supabase-py` client — raw `psycopg`.** Matches the existing
`get_conn()` context-manager style in `db.py`; the only real code change is
query placeholder syntax (`?` → `%s`) and dropping the SQLite-specific
`_migrate_users_table` rebuild-in-place workaround (Postgres supports
`ALTER COLUMN ... DROP NOT NULL` directly, so this becomes a one-line
migration instead of a table-rebuild dance).

**No data migration script.** The existing SQLite data is dev/test only
(`test@example.com`, `emailtest_*@example.com`, the author's own account,
two friends' test accounts). Start the new schema empty; re-signup/re-test
as needed.

**Local dev points straight at the cloud Supabase project.** One Supabase
project (free tier) for both dev and early testing — no local Postgres via
Docker. Free tier pauses after ~1 week idle and resumes on the next
request; acceptable while actively building. Revisit before real beta
testing (paid tier, per the original roadmap's ~$25/mo estimate).

**Big-bang cutover, no dual-write.** There's no live user base and no data
migration to stage — SQLite is simply replaced by Postgres behind the same
`get_conn()` interface in one PR.

## Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_state (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    state_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Same two-table blob-sync contract as today. `state_json` becomes `JSONB`
instead of `TEXT` — strictly better column type for free (queryable with
Postgres JSON operators later, if ever needed), no behavior change now.

`id` stays application-generated (`main.py`'s existing `str(uuid.uuid4())`
in `signup`), just stored as a native Postgres `UUID` column instead of
SQLite's untyped `TEXT`. No `DEFAULT gen_random_uuid()` — signup needs the
id in hand immediately after insert (to mint the JWT and queue the welcome
email) without a `RETURNING id` round-trip, so generating it application-side
before the insert, as today, stays the simpler path.

## Config changes

- `backend/.env` gains `DATABASE_URL` — Supabase's pooled Postgres
  connection string (port 6543, transaction-mode pooler), appropriate for
  a `--reload`-restartable dev server rather than a long-lived connection
  pool.
- No `SUPABASE_URL` / `SUPABASE_ANON_KEY` needed — bypassing the Supabase
  client entirely, only the raw connection string is used.
- `backend/requirements.txt` adds `psycopg[binary]`; nothing removed
  (`sqlite3` is stdlib, simply unused after the change).

## Code changes

- `backend/db.py`: `get_conn()` connects via `psycopg.connect(DATABASE_URL)`
  instead of `sqlite3.connect(DB_PATH)`. `SCHEMA` becomes the Postgres DDL
  above. `_migrate_users_table`'s rebuild-in-place logic is deleted —
  replaced by a plain `ALTER TABLE users ALTER COLUMN password_hash DROP
  NOT NULL` run once as part of `init_db()`, guarded the same way (check
  current nullability before altering, idempotent on repeated startup).
- `backend/main.py`: no route logic changes — `get_state`/`put_state`
  already treat `state_json` as an opaque blob. Query parameter
  placeholders in any raw SQL move from `?` to `%s`.
- `backend/backup.py`: this file's local `shutil.copy2`-based backup logic
  is SQLite-specific and stops applying (no `cukai.db` file to copy).
  Removed rather than adapted — Supabase's own backup story (or lack of it
  on the free tier) is the explicit trade-off already accepted in the
  original roadmap; revisit alongside the paid-tier upgrade decision, not
  as part of this migration.

## Error handling

Connection failures (network blip, or the free-tier project waking from
idle-pause) should surface as a clean `HTTPException(503, "Database
unavailable, try again shortly")`, not a raw `psycopg.OperationalError`
traceback reaching the client. `get_conn()` wraps the connect call: on
failure, retry once after a 2-second delay (covers the common
idle-project-waking case), then raise the 503 if the retry also fails.

## Testing / verification

No existing automated test suite covers `db.py` or `main.py` (only
`pipeline/tests/` exists, and it tests pure functions unaffected by this
change) — this migration doesn't need to preserve coverage that doesn't
exist. Verification is manual, run once against the new Postgres backend
before considering this done:

- Signup, login, Google OAuth login
- Password reset email flow
- `GET`/`PUT /state` round-trip (confirm a saved blob survives a
  server restart)
- Receipt scan (`/receipts/scan`) and statement upload
  (`/statements/scan`) — unaffected by this change, but confirm end-to-end
  since they sit behind the same auth dependency
- Rate limiting still triggers on repeated failed logins

## Out of scope

- Relational decomposition of `user_state` into per-entity tables
  (transactions, categories, relief_rules, etc.) — deferred, see Decisions
- Switching to Supabase Auth — deferred, see Decisions
- Migrating existing dev/test SQLite data — explicitly dropped
- Capacitor/mobile wrapping — separate, later piece of work
- Paid-tier upgrade / production backup strategy — revisit before beta
  testing, not part of this migration
