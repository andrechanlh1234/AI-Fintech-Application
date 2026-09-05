"""Optimistic-concurrency guard for PUT /state (backend/state_sync.py).

Bug report H2 (deep half): the client-side race (SET_AUTH_USER dispatched
only after the remote pull resolves) was already fixed, but PUT /state
itself was still unconditional last-write-wins -- two tabs/devices signed
into the same account, or a slow request racing a fresh one, could still
silently overwrite each other's data server-side. This adds a version
check: the client must echo back the `updated_at` it last saw, and a
write is rejected (409) if the stored value has moved since.

Pure decision logic only, unit-tested here without a DB. The SQL
`UPDATE ... WHERE updated_at = %s` in main.py closes the remaining
SELECT-then-UPDATE race atomically at the database level; that part isn't
unit-testable without a live Postgres and is covered by a live smoke test
instead (see the deploy notes).

Imports backend.state_sync, not backend.main -- same reasoning as
test_cors.py: avoids main's load_dotenv() pulling real secrets from
backend/.env into the test process.
"""

import pytest

from backend.state_sync import ConflictError, check_expected_version


def test_no_stored_row_never_conflicts():
    # First-ever write for this account (e.g. right after signup) -- there
    # is nothing to conflict with yet, regardless of what the client sends.
    check_expected_version(current_updated_at=None, expected_updated_at=None)
    check_expected_version(current_updated_at=None, expected_updated_at="anything")


def test_matching_expected_version_does_not_conflict():
    check_expected_version(current_updated_at="2026-09-05T00:00:00+00:00", expected_updated_at="2026-09-05T00:00:00+00:00")


def test_stored_row_with_no_expected_version_conflicts():
    # A row already exists but the client never told us what it last saw --
    # writing blind here is exactly the H2 data-loss scenario.
    with pytest.raises(ConflictError) as exc_info:
        check_expected_version(current_updated_at="2026-09-05T00:00:00+00:00", expected_updated_at=None)
    assert exc_info.value.current_updated_at == "2026-09-05T00:00:00+00:00"


def test_mismatched_expected_version_conflicts():
    with pytest.raises(ConflictError) as exc_info:
        check_expected_version(current_updated_at="2026-09-05T00:00:01+00:00", expected_updated_at="2026-09-05T00:00:00+00:00")
    assert exc_info.value.current_updated_at == "2026-09-05T00:00:01+00:00"
