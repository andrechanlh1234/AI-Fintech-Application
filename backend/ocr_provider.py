"""Structured field extraction from a receipt or bank-statement image/PDF via
a vision-capable model, instead of raw-OCR-text + regex-guessing.

Currently backed by Gemini (reuses GEMINI_API_KEY / GEMINI_MODEL from
ai_chat.py, no separate config). Deliberately kept behind one narrow
function per document type so a self-hosted model (Qwen2.5-VL, planned once
there's hardware to run it comfortably) can be swapped in later without
touching any caller — just point OCR_PROVIDER at a new implementation of the
same signature.
"""

import base64
import json
import logging
import os

import httpx

from backend.ai_chat import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger("cukai.ocr")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
    logger.propagate = False

OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "gemini")

RECEIPT_PROMPT = (
    "You are extracting structured data from a photo of a single retail receipt, "
    "for a Malaysian personal finance app. Look carefully at every line item "
    "printed on the receipt and return ONLY a JSON object with these exact keys: "
    '"vendor" (string, the merchant/store name as printed), '
    '"date" (string, ISO YYYY-MM-DD, or null if no date is legible), '
    '"total" (number, the final grand total actually paid, or null if no total is legible), '
    '"currency" (string, e.g. "MYR", best guess from context), '
    '"taxAmount" (number, the SST/GST/sales-tax amount printed on its own line '
    "— e.g. a line reading \"SST 6%: RM3.99\" or \"GST: RM2.50\" — or null if no "
    "such line is legible), "
    '"taxRate" (number, the tax percentage from that same line, e.g. 6 for '
    '"SST 6%" — or null if a rate isn\'t printed even when an amount is), '
    '"serviceChargeAmount" (number, a separate service-charge line — e.g. '
    "\"Service Charge 10%: RM5.00\", common on restaurant/hotel receipts — or "
    "null if none is printed), "
    '"serviceChargeRate" (number, the service-charge percentage from that '
    "line, e.g. 10 for a 10% service charge — or null if not printed), "
    '"lineItems" (array, one object per distinct item/line printed on the '
    "receipt — NOT the tax/service-charge/total lines themselves — each with "
    'exact keys: "description" (string, the item name as printed, or your best '
    'short label if the printed text is unclear), "amount" (number, that '
    "item's own price — for a quantity line like \"Milk x2  RM8.00\" use the "
    'line\'s total, not the unit price), "category" (string, exactly one of: '
    '"Medical", "Education", "EPF / Insurance", "Transport", "Groceries", '
    '"Dining", "Lifestyle", "Other"), "taxDeductible" (boolean, whether this '
    "SPECIFIC item plausibly qualifies for a Malaysian LHDN personal tax "
    'relief), "confidence" (number 0-1, how sure you are of this item\'s '
    "description and amount — use a low value like 0.3-0.5 for a line you "
    "genuinely struggled to read, not just as a formality)). "
    "\n\nCategory and taxDeductible reasoning matters most for \"Lifestyle\": "
    "LHDN's Lifestyle relief specifically covers sports equipment (for any "
    "sport, e.g. shoes, apparel, a racket, a yoga mat, a bicycle used for "
    "sport), gym/fitness membership fees, books/journals/magazines, a personal "
    "computer/smartphone/tablet, internet subscriptions, and skill-improvement "
    "course fees — categorise a matching item \"Lifestyle\" with taxDeductible "
    "true even if the store itself isn't a household sporting-goods name. "
    "Groceries, dining, transport fares, and generic shopping that isn't one of "
    "those items are NOT Lifestyle-relief-eligible — set taxDeductible false "
    "for those even though the category itself is real. Medical relief covers "
    "self/spouse/child medical expenses (pharmacy, clinic, hospital, medical "
    "equipment) — set category \"Medical\" and taxDeductible true for those. If "
    "you're genuinely unsure whether an item qualifies, set taxDeductible false "
    "rather than guessing yes. "
    "\n\nNever invent a figure, item, or line that isn't legible in the image — "
    "use null (or omit the item from lineItems) for something you can't "
    "actually read. If the receipt is too unclear to make out any individual "
    "items, return an empty lineItems array rather than fabricating one entry "
    "for the whole total. Return raw JSON only, no markdown fences, no "
    "commentary."
)

STATEMENT_PROMPT = (
    "You are extracting transaction line items from a bank or credit-card statement "
    "(image or PDF page). Return ONLY a JSON object with one key, \"transactions\", "
    "an array of objects each with: "
    '"date" (string, ISO YYYY-MM-DD, or null if not legible), '
    '"description" (string, the transaction description/merchant as printed), '
    '"amount" (number, negative for a debit/spend, positive for a credit/deposit — '
    "infer sign from the statement's own debit/credit columns or +/- notation, "
    "never guess a sign you can't actually determine from the page). "
    "Skip non-transaction lines (headers, running balance, page totals). Never invent "
    "a transaction that isn't printed on the page. Return raw JSON only, no markdown "
    "fences, no commentary."
)


class VisionOCRNotConfigured(Exception):
    pass


def _call_gemini_vision(prompt: str, file_bytes: bytes, mime_type: str) -> dict:
    if not GEMINI_API_KEY:
        raise VisionOCRNotConfigured()
    b64 = base64.b64encode(file_bytes).decode("ascii")
    res = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": b64}},
            ]}],
            "generationConfig": {
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
                # Same fix as ai_chat: gemini-3.x-flash spends a large hidden
                # "thinking" budget at the default effort — enough to push a
                # receipt extraction past the timeout, at which point the whole
                # scan silently drops to the weak Tesseract fallback (and its
                # first-non-numeric-line vendor guess). "low" keeps a receipt
                # read to a few seconds with no quality loss for this
                # structured-extraction task.
                "thinkingConfig": {"thinkingLevel": "low"},
            },
        },
        timeout=60,  # multi-page statement PDFs still need headroom; a receipt is well under this
    )
    res.raise_for_status()
    data = res.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini vision returned no candidates: {data}")
    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError("Gemini vision returned an empty reply")
    return json.loads(text)


def extract_receipt_fields(file_bytes: bytes, mime_type: str) -> dict:
    """Returns {"vendor": str|None, "date": str|None, "amount": float|None,
    "currency": str|None}. Raises VisionOCRNotConfigured or on any API/parse
    failure — callers fall back to the local Tesseract pipeline, same
    pattern as ai_chat.generate_ai_reply's canned-reply fallback."""
    if OCR_PROVIDER != "gemini":
        raise VisionOCRNotConfigured(f"Unknown OCR_PROVIDER: {OCR_PROVIDER}")
    return _call_gemini_vision(RECEIPT_PROMPT, file_bytes, mime_type)


def extract_statement_transactions(file_bytes: bytes, mime_type: str) -> list[dict]:
    """Returns a list of {"date": str|None, "description": str, "amount": float}
    — one per real line item the model actually read off the statement.
    Raises VisionOCRNotConfigured or on any API/parse failure."""
    if OCR_PROVIDER != "gemini":
        raise VisionOCRNotConfigured(f"Unknown OCR_PROVIDER: {OCR_PROVIDER}")
    result = _call_gemini_vision(STATEMENT_PROMPT, file_bytes, mime_type)
    return result.get("transactions") or []
