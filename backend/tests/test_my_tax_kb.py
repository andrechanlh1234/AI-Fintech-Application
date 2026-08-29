"""Malaysian tax knowledge base (backend/my_tax_kb.py) and its wiring into
the AI chat system prompt (backend/ai_chat.py)."""

from backend import ai_chat
from backend.my_tax_kb import TAX_KB_PROMPT, looks_tax_related


def test_looks_tax_related_true_for_tax_questions():
    assert looks_tax_related("how much lifestyle relief can I claim")
    assert looks_tax_related("what's my tax bracket")
    assert looks_tax_related("is a gym membership deductible")


def test_looks_tax_related_false_for_non_tax_questions():
    assert not looks_tax_related("what's my net worth")
    assert not looks_tax_related("show recent transactions")


def test_tax_kb_prompt_is_nonempty_string():
    assert isinstance(TAX_KB_PROMPT, str)
    assert TAX_KB_PROMPT.strip()


def test_tax_kb_prompt_contains_housing_loan_tiers_and_self_relief():
    for token in ("7,000", "5,000", "750,000", "9,000"):
        assert token in TAX_KB_PROMPT


# The appended block is introduced by this exact delimiter line; it does not
# appear anywhere in the base SYSTEM_PROMPT.
REF_MARKER = "--- Malaysian tax reference (YA2025) ---"


def test_system_text_includes_reference_only_for_tax_messages():
    with_ref = ai_chat._system_text("...", user_text="lifestyle relief?")
    without_ref = ai_chat._system_text("...", user_text="my net worth?")
    assert REF_MARKER in with_ref
    assert TAX_KB_PROMPT in with_ref
    assert REF_MARKER not in without_ref


def test_system_text_without_user_text_is_unchanged():
    assert REF_MARKER not in ai_chat._system_text(None)
