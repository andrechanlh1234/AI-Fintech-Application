"""Depth guard for the arbitrary JSON blob PUT /state persists
(backend/state_validation.py).

Bug report M7: `PUT /state` already caps serialized size (MAX_STATE_BYTES,
main.py) but had no depth/schema check -- a small but pathologically
nested blob would pass the size cap untouched. Full schema validation
mirroring the frontend's SyncPayload is deliberately not done here: db.py
treats state_json as an opaque blob by design (see its module docstring),
so a depth cap is the targeted fix for "deeply nested", not a shadow
schema for the whole frontend shape.

Imports backend.state_validation, not backend.main -- same reasoning as
test_cors.py: avoids main's load_dotenv() pulling real secrets from
backend/.env into the test process.
"""

from backend.state_validation import exceeds_max_depth, json_depth


def test_scalar_has_depth_zero():
    assert json_depth(None) == 0
    assert json_depth(42) == 0
    assert json_depth("hello") == 0


def test_empty_dict_and_list_have_depth_zero():
    assert json_depth({}) == 0
    assert json_depth([]) == 0


def test_flat_dict_has_depth_one():
    assert json_depth({"a": 1, "b": 2}) == 1


def test_nested_dict_depth_counts_levels():
    assert json_depth({"a": {"b": {"c": 1}}}) == 3


def test_list_nesting_counts_too():
    # dict -> list -> dict -> list -> scalar: 4 container levels deep.
    assert json_depth({"a": [{"b": [1, 2]}]}) == 4


def test_realistic_state_shape_is_well_under_the_limit():
    # Roughly what a real synced blob looks like: a few named lists of
    # small objects, some with one level of nested fields.
    state = {
        "transactions": [{"id": "t1", "amount": 12.5, "meta": {"receiptId": "r1"}}],
        "receipts": [{"id": "r1", "lineItems": [{"description": "Milk", "amount": 8}]}],
        "ob": {"manual": {"bankAccounts": [{"name": "Maybank", "amount": "100"}]}},
    }
    assert not exceeds_max_depth(state)


def test_pathologically_nested_blob_exceeds_the_limit():
    blob: dict = {}
    node = blob
    for _ in range(200):
        node["a"] = {}
        node = node["a"]
    assert exceeds_max_depth(blob)


def test_exceeds_max_depth_respects_a_custom_limit():
    shallow = {"a": {"b": 1}}  # depth 2
    assert exceeds_max_depth(shallow, limit=1) is True
    assert exceeds_max_depth(shallow, limit=2) is False
