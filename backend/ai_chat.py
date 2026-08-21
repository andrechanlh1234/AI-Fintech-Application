"""Real AI chat replies via Google's Gemini API free tier.

Config via GEMINI_API_KEY (see backend/.env, loaded by main.py via
python-dotenv before this module is imported). If it's unset, this raises
GeminiNotConfigured rather than silently returning something — the caller
(backend/main.py's /ai/chat) turns that into a "source": "canned" response
so the frontend falls back to its existing client-side canned-reply
generator (aiCraftReply in app/src/lib/seedData.ts). The same fallback
happens if the API call itself fails for any other reason; the two are
kept as distinguishable exceptions only so the failure gets logged
differently — a chat reply must never come back as an HTTP error.

See backend/GEMINI_SETUP.md for how to get a free API key.
"""

import json
import logging
import os

import httpx

logger = logging.getLogger("cukai.ai")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Scoped to this one logger only, same as backend/email_service.py —
    # deliberately not touching the root logger's config.
    logger.addHandler(logging.StreamHandler())
    logger.propagate = False

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# Configurable rather than hardcoded so a future Gemini model rename/retire
# doesn't need a code change — see backend/GEMINI_SETUP.md.
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
    "qualified professional. Stay on topic: personal finance, budgeting, "
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


class GeminiNotConfigured(Exception):
    pass


def generate_ai_reply(user_text: str, history: list[dict] | None = None, context: dict | None = None) -> str:
    """history: optional list of {"from": "user"|"ai", "text": str}, oldest
    first. context: optional real-data snapshot (see selectAiContext on the
    frontend) — every figure in it is real, so it's safe to hand to Gemini
    as ground truth. Raises GeminiNotConfigured if no API key is set; raises
    on any other API-call failure. Callers must catch both and fall back —
    this function never returns a placeholder string on failure."""
    if not GEMINI_API_KEY:
        raise GeminiNotConfigured()

    system_text = SYSTEM_PROMPT
    if context:
        system_text += "\n\nReal data snapshot (JSON):\n" + json.dumps(context)

    contents = []
    for m in (history or [])[-10:]:  # last 10 turns is enough context for a finance chat, keeps free-tier token use low
        contents.append({"role": "user" if m.get("from") == "user" else "model", "parts": [{"text": m.get("text", "")}]})
    contents.append({"role": "user", "parts": [{"text": user_text}]})

    res = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
        json={
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_text}]},
            # Generous headroom, not just for the visible reply: newer Gemini
            # models spend a substantial hidden "thinking" token budget
            # before producing output (observed ~350-900 tokens even for a
            # simple prompt) — too low a cap here truncates mid-thought
            # before any visible text comes out at all.
            "generationConfig": {"maxOutputTokens": 2048},
        },
        timeout=30,  # thinking-model latency varies more than a typical API call
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
