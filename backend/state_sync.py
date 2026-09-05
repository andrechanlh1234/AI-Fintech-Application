"""Optimistic-concurrency guard for PUT /state.

`user_state.updated_at` doubles as a version token: the client must echo
back the `updated_at` it last saw (from GET /state, or the previous PUT's
response) as `expected_updated_at`. A write is rejected when the stored
value has moved since -- otherwise a second tab/device, or a slow request
racing a fresh one, can silently overwrite newer data with older data
(bug-report H2, deep half; the client-side race that caused this in
practice was already fixed in StoreProvider.tsx).

Kept in its own module (see backend/cors.py for the same reasoning) so
the decision logic is unit-testable without importing backend.main's
load_dotenv() side effect. The actual SQL in main.py additionally uses
`UPDATE ... WHERE updated_at = %s` to close the remaining
SELECT-then-UPDATE race atomically at the database level -- this module
only covers the decision, not the storage.
"""


class ConflictError(Exception):
    """Raised when a write's expected version doesn't match what's stored."""

    def __init__(self, current_updated_at: str):
        super().__init__(f"state changed since expected version (now {current_updated_at})")
        self.current_updated_at = current_updated_at


def check_expected_version(current_updated_at: str | None, expected_updated_at: str | None) -> None:
    """Raise ConflictError if a stored row exists and its version doesn't
    match what the client expected. No stored row (current_updated_at is
    None) never conflicts -- that's the first write for this account, with
    nothing yet to overwrite."""
    if current_updated_at is None:
        return
    if expected_updated_at != current_updated_at:
        raise ConflictError(current_updated_at)
