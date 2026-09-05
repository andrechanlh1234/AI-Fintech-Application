"""Depth guard for the arbitrary JSON blob `PUT /state` persists.

`user_state.state_json` is deliberately an opaque JSON blob -- the backend
doesn't model net worth, budgets, or transactions (see backend/db.py's
module docstring) -- so a full schema mirroring the frontend's state shape
would fight that design and needs updating every time the frontend shape
changes. A depth cap is the targeted fix instead: it catches a small but
pathologically nested payload (which the existing MAX_STATE_BYTES size cap
does not, since deep nesting costs very few bytes) without knowing
anything about the frontend's actual field names (bug-report M7).

Kept in its own module (see backend/cors.py for the same reasoning) so it
can be unit-tested without importing backend.main's load_dotenv() side
effect.
"""

from typing import Any

# Generous headroom over any real synced state's nesting (a few levels of
# dict/list -- e.g. state -> receipts -> line items -> fields is 3-4 deep).
MAX_JSON_DEPTH = 30


def json_depth(value: Any, _current: int = 0) -> int:
    """Max dict/list nesting depth of a JSON-shaped value. Scalars (and
    empty dicts/lists) are depth `_current`. Safe to call on anything that
    was itself just decoded from JSON -- such a value cannot contain a
    reference cycle, so this always terminates."""
    if isinstance(value, dict):
        if not value:
            return _current
        return max(json_depth(v, _current + 1) for v in value.values())
    if isinstance(value, list):
        if not value:
            return _current
        return max(json_depth(v, _current + 1) for v in value)
    return _current


def exceeds_max_depth(value: Any, limit: int = MAX_JSON_DEPTH) -> bool:
    return json_depth(value) > limit
