"""Password-reset code logic (backend/auth.py)."""

from datetime import datetime, timedelta, timezone

from backend import auth


def test_reset_code_is_six_digits():
    code = auth.create_reset_code("user-1")
    assert code.isdigit() and len(code) == 6


def test_correct_code_verifies_once_then_is_consumed():
    code = auth.create_reset_code("user-2")
    assert auth.verify_reset_code("user-2", code) is True
    # single use — the same code no longer works
    assert auth.verify_reset_code("user-2", code) is False


def test_wrong_code_fails_and_counts_against_the_attempt_cap():
    code = auth.create_reset_code("user-3")
    for _ in range(auth.RESET_CODE_MAX_ATTEMPTS):
        assert auth.verify_reset_code("user-3", "000000") is False
    # cap reached — even the right code is now rejected
    assert auth.verify_reset_code("user-3", code) is False


def test_unknown_user_fails():
    assert auth.verify_reset_code("nobody", "123456") is False


def test_expired_code_fails():
    code = auth.create_reset_code("user-4")
    auth._RESET_CODES["user-4"]["expires"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert auth.verify_reset_code("user-4", code) is False


def test_whitespace_around_code_is_tolerated():
    code = auth.create_reset_code("user-5")
    assert auth.verify_reset_code("user-5", f"  {code} ") is True
