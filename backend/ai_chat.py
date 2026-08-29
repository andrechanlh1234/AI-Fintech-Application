"""Real AI chat replies.

Primary provider is Groq (OpenAI-compatible Chat Completions, free tier,
very low latency — set GROQ_API_KEY). If that isn't configured, this falls
back to Google's Gemini API (set GEMINI_API_KEY / GEMINI_MODEL). If
neither is configured it raises AiNotConfigured, which the caller
(backend/main.py's /ai/chat) turns into a "source": "canned" response so
the frontend uses its client-side canned-reply generator (aiCraftReply in
app/src/lib/seedData.ts). The same fallback happens if the API call itself
fails for any other reason — a chat reply must never come back as an HTTP
error.

See backend/GROQ_SETUP.md (or backend/GEMINI_SETUP.md) for how to get a
free key.
"""

import json
import logging
import os

import httpx

from backend.my_tax_kb import TAX_KB_PROMPT, looks_tax_related

logger = logging.getLogger("cukai.ai")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Scoped to this one logger only, same as backend/email_service.py —
    # deliberately not touching the root logger's config.
    logger.addHandler(logging.StreamHandler())
    logger.propagate = False

# Groq — primary. `openai/gpt-oss-120b` is a strong general model on Groq's
# free tier and answers a short finance question in well under a second.
# Override with GROQ_MODEL; check the current list at
# https://console.groq.com/docs/models (Groq retires/renames models).
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# Gemini — fallback, kept so an existing GEMINI_API_KEY still works with no
# extra setup. (backend/ocr_provider.py also imports these two names.)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

# Kept accurate to what the app actually does today (app/README.md) so the
# assistant never claims a feature that doesn't exist yet.
SYSTEM_PROMPT = (
    "You are the AI assistant inside Cukai, a personal finance and Malaysian "
    "tax app. Cukai tracks net worth, budgets, transactions, subscriptions, "
    "and LHDN tax relief eligibility, based only on what the user has "
    "actually entered manually or scanned via receipt OCR — there is no "
    "real bank-account linking yet, so never claim to see or access a "
    "user's actual bank accounts. Cukai does not file taxes on the user's "
    "behalf and is not a licensed financial or tax advisor; for anything "
    "specific to a real filing, suggest verifying with LHDN/HASiL or a "
    "qualified professional. When a 'Malaysian tax reference (YA2025)' block "
    "is included below, you may cite its specific relief caps, tax bands, and "
    "qualifying conditions directly, but treat it as a general-knowledge "
    "reference (not a live LHDN confirmation) and never state a tax figure "
    "that is not in that reference or the data snapshot — if it isn't there, "
    "say you don't have it and point the user to LHDN/HASiL. "
    "Stay on topic: personal finance, budgeting, "
    "and Malaysian tax relief. Be concise — a few sentences, not an essay. "
    "If asked about something unrelated, gently redirect to what Cukai can "
    "actually help with. "
    "You may be given a 'Real data snapshot' as JSON — that JSON is the "
    "complete, authoritative set of figures you have about this user; it is "
    "not abbreviated. When answering a question about the user's own net "
    "worth, budget, tax, or subscriptions, use only numbers from that "
    "snapshot — never invent, estimate, or embellish a figure, a trend "
    "driver, or a category that isn't literally present in it. If no "
    "snapshot is given, or the answer needs a figure the snapshot doesn't "
    "have, say plainly that you don't have that data rather than guessing."
)


class AiNotConfigured(Exception):
    """No chat provider has an API key set."""


# Back-compat alias — earlier code (and imports) referred to this name.
GeminiNotConfigured = AiNotConfigured


def _system_text(context: dict | None, user_text: str | None = None) -> str:
    text = SYSTEM_PROMPT
    if context:
        text += "\n\nReal data snapshot (JSON):\n" + json.dumps(context)
    # Only tax-ish messages pay the token cost of the LHDN reference block.
    if user_text and looks_tax_related(user_text):
        text += "\n\n--- Malaysian tax reference (YA2025) ---\n" + TAX_KB_PROMPT
    return text


def _history_pairs(history: list[dict] | None):
    """(role, text) for the last 10 turns, oldest first. `from` is
    "user"|"ai" on the frontend; map "ai" -> assistant/model per provider."""
    for m in (history or [])[-10:]:
        yield ("user" if m.get("from") == "user" else "assistant"), m.get("text", "")


def generate_ai_reply(
    user_text: str,
    history: list[dict] | None = None,
    context: dict | None = None,
) -> tuple[str, str]:
    """Returns (reply_text, provider) where provider is "groq" or "gemini".
    history: optional list of {"from": "user"|"ai", "text": str}, oldest
    first. context: optional real-data snapshot (see selectAiContext on the
    frontend) — every figure in it is real, so it's safe to hand to the
    model as ground truth. Raises AiNotConfigured if no provider key is
    set; raises on any other API-call failure. Callers must catch both and
    fall back — this function never returns a placeholder string."""
    system_text = _system_text(context, user_text)

    if GROQ_API_KEY:
        return _call_groq(user_text, history, system_text), "groq"
    if GEMINI_API_KEY:
        return _call_gemini(user_text, history, system_text), "gemini"
    raise AiNotConfigured()


def _call_groq(user_text: str, history: list[dict] | None, system_text: str) -> str:
    messages = [{"role": "system", "content": system_text}]
    for role, text in _history_pairs(history):
        messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": user_text})

    res = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 800,
            "stream": False,
        },
        timeout=20,
    )
    res.raise_for_status()
    data = res.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"Groq returned no choices: {data}")
    text = (choices[0].get("message", {}).get("content") or "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty reply")
    return text


def _call_gemini(user_text: str, history: list[dict] | None, system_text: str) -> str:
    contents = []
    for role, text in _history_pairs(history):
        contents.append({"role": "user" if role == "user" else "model", "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": user_text}]})

    res = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
        json={
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_text}]},
            "generationConfig": {
                # Generous headroom, not just for the visible reply: Gemini
                # models spend a hidden "thinking" budget before producing
                # output — too low a cap truncates mid-thought before any
                # visible text comes out.
                "maxOutputTokens": 2048,
                # But cap how *much* it thinks. At the default effort,
                # gemini-3.x-flash took ~40s for a one-line finance answer
                # here — past the timeout below, so every reply silently
                # fell back to the canned generator. "low" brings the same
                # prompt to ~5s with no real quality loss for short chat
                # answers. (Gemini 3 param; older models used
                # thinkingBudget and would 400 on this — not a concern
                # while a 3.x model is configured.)
                "thinkingConfig": {"thinkingLevel": "low"},
            },
        },
        timeout=45,  # headroom over the ~5s typical; thinking-model latency is spiky
    )
    res.raise_for_status()
    data = res.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {data}")
    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned an empty reply")
    return text
