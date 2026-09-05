"""OAuth CSRF `state` is a signed, stateless token (backend/google_oauth.py),
not an in-memory set.

Bug report (2026-09-04): the old _PENDING_STATES set lived only in process
memory. A Render free-tier instance that restarts (idle spin-down, or any
recycle) between /auth/google/login and /auth/google/callback wiped it, so
a login already in flight came back as oauth_error=bad_state with no visible
error on the frontend -- indistinguishable from the unrelated CORS bug that
was the actual cause of the original report, so this needed fixing too.

Imports backend.google_oauth directly, not backend.main -- same reasoning
as test_cors.py: avoids main's load_dotenv() pulling real secrets from
backend/.env into the test process.
"""

from backend import auth, google_oauth


def test_created_state_verifies():
    state = google_oauth._create_state()
    assert google_oauth._verify_state(state) is True


def test_two_independently_created_states_each_verify():
    # No shared server-side set involved -- each token carries its own proof.
    a = google_oauth._create_state()
    b = google_oauth._create_state()
    assert google_oauth._verify_state(a) is True
    assert google_oauth._verify_state(b) is True


def test_garbage_state_is_rejected():
    assert google_oauth._verify_state("not-a-real-token") is False


def test_none_state_is_rejected():
    assert google_oauth._verify_state(None) is False


def test_empty_state_is_rejected():
    assert google_oauth._verify_state("") is False


def test_expired_state_is_rejected(monkeypatch):
    monkeypatch.setattr(google_oauth, "STATE_TTL_SECONDS", -1)
    state = google_oauth._create_state()
    assert google_oauth._verify_state(state) is False


def test_a_real_session_token_is_not_accepted_as_oauth_state():
    # Defence in depth, mirrors auth.decode_token rejecting anything with a
    # `purpose` claim below: the two token kinds must not be interchangeable.
    session_token = auth.create_token("user-1")
    assert google_oauth._verify_state(session_token) is False


def test_an_oauth_state_is_not_accepted_as_a_session_token():
    state = google_oauth._create_state()
    assert auth.decode_token(state) is None
