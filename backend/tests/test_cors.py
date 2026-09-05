"""CORS allow-list construction (backend/cors.py:allowed_origins).

Imports backend.cors, not backend.main — the latter runs load_dotenv() at
import time, which would pull backend/.env's real API keys into the test
process and break later tests that assert on a missing key.
allowed_origins() reads os.environ at call time, so monkeypatched env is
all that is needed.
"""

from backend.cors import allowed_origins


def test_deployed_web_origin_is_always_present(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    assert "https://cukai-web.onrender.com" in allowed_origins()


def test_local_dev_origins_are_present(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    origins = allowed_origins()
    assert "http://localhost:5173" in origins
    assert "capacitor://localhost" in origins


def test_frontend_url_env_is_included_when_set(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://staging.example.com")
    assert "https://staging.example.com" in allowed_origins()


def test_no_duplicates_when_frontend_url_equals_the_literal(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://cukai-web.onrender.com")
    origins = allowed_origins()
    assert len(origins) == len(set(origins))


def test_unset_frontend_url_does_not_raise(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    allowed_origins()  # must not raise


def test_blank_frontend_url_is_ignored(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "   ")
    origins = allowed_origins()
    assert "   " not in origins
    assert "" not in origins
