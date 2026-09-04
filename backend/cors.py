"""CORS allow-list for the API.

Kept in its own module (no `load_dotenv`, no app-graph imports) so the
allow-list logic can be unit-tested without importing `backend.main` — and
therefore without pulling `.env` into the test process, which would leak
real API keys into later tests (e.g. the OCR Tesseract-fallback tests that
assert on a *missing* GEMINI_API_KEY).
"""

import os

# The deployed frontend must reach the API. `FRONTEND_URL` is the same env
# var the email + Google-OAuth code already read; include it here too when
# set. The literal onrender origin is always included as a fallback so a
# missing/empty FRONTEND_URL on the API service does not silently re-break
# the deployed PWA (bug-report deploy blocker, 2026-09-04).
DEPLOYED_WEB_ORIGIN = "https://cukai-web.onrender.com"
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "capacitor://localhost"]


def allowed_origins() -> list[str]:
    origins = list(DEV_ORIGINS)
    frontend_url = os.environ.get("FRONTEND_URL", "").strip()
    if frontend_url:
        origins.append(frontend_url)
    origins.append(DEPLOYED_WEB_ORIGIN)
    # de-dupe, preserve order
    seen: set[str] = set()
    return [o for o in origins if not (o in seen or seen.add(o))]
