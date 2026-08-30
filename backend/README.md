# Cukai backend

Real accounts, real per-account data sync, and real receipt OCR for the
`../app` frontend. FastAPI + SQLite — no external services required.

## First-time setup

```bash
# from the repo root
brew install tesseract          # OCR binary (macOS)
python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

Needs Python 3.10+ (the pipeline package uses modern type-hint syntax) —
if system `python3` is older, install one via `brew install python@3.12`.

## Run it

```bash
# from the repo root, so `pipeline` resolves as a package
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

The frontend (`../app`) talks to `http://127.0.0.1:8000` by default —
override with `VITE_API_BASE` in `../app/.env` if needed.

## What's here

- `main.py` — the API: `/auth/signup`, `/auth/login`, `/auth/me`,
  `/state` (GET/PUT — the per-account data sync), `/receipts/scan`
- `auth.py` — bcrypt password hashing, JWT session tokens
- `db.py` — SQLite schema (`users`, `user_state`) and connection helper
- `backup.py` — automatic local backups (below)
- `cukai.db`, `.jwt_secret` — created on first run, gitignored (local
  dev data — delete `cukai.db` to reset all accounts)

`/receipts/scan` wraps `../pipeline/receipt_ocr.py`, which already
existed with its own passing test suite before this backend was built —
this just exposes it over HTTP so the frontend can call it.

## Backups

The server takes a full copy of `cukai.db` into `backups/` on every
startup and every 6 hours while running, keeping the last 14. This runs
inside the app process — no cron/launchd setup needed. To restore, stop
the server and copy the backup you want over `cukai.db`:

```bash
cp backend/backups/cukai-<timestamp>.db backend/cukai.db
```

## Secrets

The JWT signing secret (what makes login sessions trustworthy) reads
from the `CUKAI_JWT_SECRET` environment variable if set. For local dev
this is optional — it falls back to a secret auto-generated into
`.jwt_secret` on first run. **Before this ever runs anywhere but your
own machine, set `CUKAI_JWT_SECRET` explicitly** (e.g. `openssl rand
-hex 32` to generate one) rather than relying on the file fallback.

## Known gaps

- Runs on `localhost` only — not deployed anywhere yet.
- No password reset flow.
- No rate limiting on auth endpoints.
