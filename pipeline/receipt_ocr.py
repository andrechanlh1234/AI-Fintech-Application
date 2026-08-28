"""Receipt photo -> structured Record.

Tier 2 (vision-model field extraction, via backend/ocr_provider.py) is tried
first now that a GEMINI_API_KEY is configured — it reads the photo directly
instead of raw-OCR-text + regex-guessing, which handles angled/crumpled
receipts and varied layouts far better. Tier 1 (local Tesseract, this file's
original approach) is the fallback when the vision call isn't configured or
fails for any reason, so a scan never comes back empty just because a cloud
call had a bad moment.
"""

import mimetypes
import re
from datetime import date, datetime

from PIL import Image, ImageOps

from pipeline.categorize import categorize, relief_tag_for
from pipeline.models import Record, ReceiptLineItem, ReceiptScanResult

TOTAL_LINE_RE = re.compile(r"(total|jumlah|amount due|grand total)", re.IGNORECASE)
# Tesseract commonly inserts a stray space right after the decimal point on
# thermal-receipt fonts ("RM10. 20") — tolerate it and strip on capture.
MONEY_RE = re.compile(r"(?:rm|myr)?\s?(\d{1,3}(?:,\d{3})*\.\s?\d{2})", re.IGNORECASE)
# Malaysian receipts print SST/GST as its own line, separate from the total
# ("SST 6%: RM3.99" / "GST RM2.50"), and restaurant/hotel receipts often add
# a separate service-charge line ("Service Charge 10%: RM5.00").
TAX_LINE_RE = re.compile(r"\b(sst|gst|ppn|cukai)\b", re.IGNORECASE)
SERVICE_CHARGE_LINE_RE = re.compile(r"service\s*(charge|chg)", re.IGNORECASE)
PERCENT_RE = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*%")

DATE_PATTERNS = [
    (re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b"), "%d/%m/%Y"),
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), "%Y-%m-%d"),
    # \s* (not \s) between day/month/year — thermal-receipt fonts are tight
    # enough that OCR sometimes drops the space entirely ("02OCT 2025").
    (re.compile(r"\b(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})\b", re.IGNORECASE), "%d %b %Y"),
    # 2-digit-year receipts (e.g. "24 Sep 18") — tried last so a 4-digit year
    # is never truncated into this instead.
    (re.compile(r"\b(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2})\b(?!\d)", re.IGNORECASE), "%d %b %y"),
]


# Below this width, Tesseract's character recognition degrades sharply —
# common for photos pulled from a messaging app rather than a fresh camera
# shot. Upscaling before OCR (not after) measurably recovers accuracy.
MIN_OCR_WIDTH = 1400

# Single uniform block of text: matches a receipt's actual layout (one
# narrow column) far better than the default automatic-segmentation mode,
# which tends to fragment thermal-receipt text into scattered blocks.
TESSERACT_CONFIG = "--psm 6"


def preprocess(image_path: str) -> Image.Image:
    """Grayscale + autocontrast + upscale — cheap preprocessing that
    measurably helps Tesseract on phone-camera receipt photos (uneven
    lighting, low contrast, and — for anything already downscaled before
    reaching this pipeline — too few pixels per character)."""
    img = Image.open(image_path)
    # Phone cameras (iPhone in particular) very commonly store the photo's
    # actual pixel data unrotated and record the intended orientation as
    # EXIF metadata instead — PIL doesn't apply that automatically, so
    # without this, a portrait photo taken on a real phone gets OCR'd
    # sideways or upside down, silently producing garbage text.
    img = ImageOps.exif_transpose(img)
    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    if img.width < MIN_OCR_WIDTH:
        scale = MIN_OCR_WIDTH / img.width
        img = img.resize((MIN_OCR_WIDTH, round(img.height * scale)), Image.LANCZOS)
    return img


def extract_text(image_path: str) -> tuple[str, float]:
    """Returns (text, avg_word_confidence in 0-1)."""
    import pytesseract

    img = preprocess(image_path)
    text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG)
    data = pytesseract.image_to_data(img, config=TESSERACT_CONFIG, output_type=pytesseract.Output.DICT)
    confidences = [int(c) for c in data["conf"] if c not in ("-1", -1)]
    avg_conf = (sum(confidences) / len(confidences) / 100) if confidences else 0.0
    return text, avg_conf


def _find_date(text: str) -> date | None:
    for pattern, fmt in DATE_PATTERNS:
        m = pattern.search(text)
        if not m:
            continue
        try:
            if fmt in ("%d %b %Y", "%d %b %y"):
                day, mon, year = m.groups()
                return datetime.strptime(f"{day} {mon[:3]} {year}", fmt).date()
            return datetime.strptime(m.group(0), fmt).date()
        except ValueError:
            continue
    return None


def _to_float(money_match: str) -> float:
    return float(money_match.replace(",", "").replace(" ", ""))


def _find_amount(text: str) -> float | None:
    # Prefer a number on a line that says "total" / "jumlah" — the receipt's
    # own label for the figure we want, not just the biggest number on the page.
    # Most receipts print Sub-Total, then tax/service lines, then the actual
    # Grand/Net Total last — so among "total" lines, take the last one that
    # isn't itself a subtotal.
    total_hits = []
    for line in text.splitlines():
        if TOTAL_LINE_RE.search(line):
            amounts = [_to_float(m) for m in MONEY_RE.findall(line)]
            if amounts:
                total_hits.append((line.lower(), max(amounts)))
    for line, amount in reversed(total_hits):
        if "sub" not in line:
            return amount
    if total_hits:
        return total_hits[-1][1]
    # Fallback: no line was recognisably labelled "total" (a garbled OCR
    # read of that word is the common cause). The total is almost always
    # near the bottom of the receipt, so search the last third of lines
    # before falling back to "biggest number anywhere" — otherwise a single
    # misread line item elsewhere on the receipt can look bigger than the
    # real total and win.
    lines = text.splitlines()
    tail = lines[-max(1, len(lines) // 3) :]
    tail_amounts = [_to_float(m) for line in tail for m in MONEY_RE.findall(line)]
    if tail_amounts:
        return max(tail_amounts)
    all_amounts = [_to_float(m) for m in MONEY_RE.findall(text)]
    return max(all_amounts) if all_amounts else None


def _find_tax_and_service(text: str) -> dict:
    """Scans for a tax (SST/GST) line and a separate service-charge line,
    each independently — a receipt may print one, both, or neither, and
    either may show just the amount, just the rate, or both. Never guesses
    one from the other (a 6% figure elsewhere on the receipt isn't
    necessarily this line's rate) — only what's actually printed on the
    matched line itself."""

    def first_match(pattern: re.Pattern) -> tuple[float | None, float | None]:
        for line in text.splitlines():
            if not pattern.search(line):
                continue
            amounts = MONEY_RE.findall(line)
            pct = PERCENT_RE.search(line)
            amount = _to_float(amounts[0]) if amounts else None
            rate = float(pct.group(1)) if pct else None
            if amount is not None or rate is not None:
                return amount, rate
        return None, None

    tax_amount, tax_rate = first_match(TAX_LINE_RE)
    service_amount, service_rate = first_match(SERVICE_CHARGE_LINE_RE)
    return {
        "tax_amount": tax_amount,
        "tax_rate": tax_rate,
        "service_charge_amount": service_amount,
        "service_charge_rate": service_rate,
    }


# Lines that are almost never the merchant name itself — document headers,
# registration/contact metadata, or a bare date/receipt number.
_NON_VENDOR_LINE_RE = re.compile(
    r"(tax\s*invoice|^invoice\b|^receipt\b|resit|^bill\b|cash\s*sale|"
    r"gst\s*(no|reg)|sst\s*(no|reg)|(co|reg|business)\.?\s*(no|reg)|"
    r"\btel\b|\bfax\b|\bno\.?\s*\d|jalan|lorong|persiaran|\bunit\b|"
    r"\bwww\.|https?:|@)",
    re.IGNORECASE,
)


_PAYMENT_METHODS = {"Cash", "Credit Card", "E-wallet", "Transfer"}


def _norm_payment(v) -> str | None:
    """Coerce a model/OCR guess to exactly one of the four app options."""
    if not v:
        return None
    key = str(v).strip().lower().replace("-", "").replace(" ", "")
    return {
        "cash": "Cash", "tunai": "Cash",
        "creditcard": "Credit Card", "debitcard": "Credit Card", "card": "Credit Card",
        "debit": "Credit Card", "credit": "Credit Card", "visa": "Credit Card", "mastercard": "Credit Card",
        "ewallet": "E-wallet", "wallet": "E-wallet", "grabpay": "E-wallet", "tng": "E-wallet",
        "touchngo": "E-wallet", "boost": "E-wallet", "shopeepay": "E-wallet",
        "transfer": "Transfer", "banktransfer": "Transfer", "ibg": "Transfer", "duitnow": "Transfer",
    }.get(key)


# Tesseract-fallback payment detection — e-wallet / card checked before the
# broad "cash"/"change" match (a card slip often also prints "CHANGE 0.00").
_PAYMENT_RE = [
    (re.compile(r"\b(grab\s*pay|tng|touch\s*.?n.?\s*go|boost|shopee\s*pay|e-?wallet|duitnow\s*qr)\b", re.IGNORECASE), "E-wallet"),
    (re.compile(r"\b(visa|master\s*card|amex|debit|credit\s*card|approval\s*code|card\s*(no|payment|type))\b", re.IGNORECASE), "Credit Card"),
    (re.compile(r"\b(bank\s*transfer|inter\s*bank|ibg|duitnow)\b", re.IGNORECASE), "Transfer"),
    (re.compile(r"\b(cash|tunai)\b|\bchange\b", re.IGNORECASE), "Cash"),
]


def _find_payment_method(text: str) -> str | None:
    for pattern, label in _PAYMENT_RE:
        if pattern.search(text):
            return label
    return None


def _find_vendor(text: str) -> str:
    """First line among the first ~8 that reads like a store name — a store
    name sits at the very top of a receipt. The old approach ('first line
    >= 3 chars that isn't all digits') routinely returned 'TAX INVOICE', a
    GST number, or an address line; this skips those and requires the line
    to be mostly letters."""
    for line in text.splitlines()[:8]:
        cleaned = line.strip(" .:-*|_")
        if len(cleaned) < 3 or cleaned.replace(" ", "").isdigit():
            continue
        if _NON_VENDOR_LINE_RE.search(cleaned):
            continue
        letters = sum(c.isalpha() for c in cleaned)
        if letters < 3 or letters / len(cleaned) < 0.5:
            continue
        return cleaned.title()
    return "Unknown vendor"


def parse_receipt_text(text: str, ocr_confidence: float = 1.0) -> Record:
    vendor = _find_vendor(text)
    amount = _find_amount(text) or 0.0
    txn_date = _find_date(text)
    category = categorize(vendor, text)
    extra = _find_tax_and_service(text)
    extra["payment_method"] = _find_payment_method(text)

    # Extraction confidence combines OCR word confidence with whether we
    # actually found a date/amount at all — a clean scan with no visible
    # total is just as untrustworthy as a blurry one.
    field_penalty = (0.0 if txn_date else 0.15) + (0.0 if amount else 0.25)
    confidence = max(0.0, ocr_confidence - field_penalty)

    return Record(
        source="receipt_photo",
        vendor=vendor,
        txn_date=txn_date,
        amount=amount,
        category=category,
        relief_tag=relief_tag_for(category),
        confidence=confidence,
        raw_text=text,
        extra=extra,
    )


_KNOWN_CATEGORIES = {"Medical", "Education", "EPF / Insurance", "Transport", "Groceries", "Dining", "Lifestyle", "Other"}

LOW_CONFIDENCE_THRESHOLD = 0.55


def _line_item_from_vision_entry(entry: dict, fallback_text: str) -> ReceiptLineItem | None:
    description = (entry.get("description") or "").strip()
    amount = entry.get("amount")
    if not description or amount is None:
        return None
    category = entry.get("category")
    if category not in _KNOWN_CATEGORIES:
        category = categorize(description, fallback_text)
    confidence = entry.get("confidence")
    confidence = float(confidence) if isinstance(confidence, (int, float)) else 0.5
    return ReceiptLineItem(
        description=description,
        amount=float(amount),
        category=category,
        tax_deductible=bool(entry.get("taxDeductible")),
        confidence=max(0.0, min(1.0, confidence)),
    )


def _receipt_result_from_vision_fields(fields: dict, raw_text: str = "") -> ReceiptScanResult:
    vendor = (fields.get("vendor") or "").strip() or "Unknown vendor"
    total = fields.get("total")
    total = float(total) if total is not None else None
    txn_date = None
    if fields.get("date"):
        try:
            txn_date = datetime.strptime(fields["date"], "%Y-%m-%d").date()
        except ValueError:
            pass
    raw_items = fields.get("lineItems") or []
    line_items = [li for li in (_line_item_from_vision_entry(e, vendor) for e in raw_items) if li]
    # Overall confidence is the weakest signal in the receipt, not an
    # average -- one badly-read item (or a missing date/total) should make
    # the whole scan read as "needs a careful look", not get diluted by
    # several clean items sitting alongside it.
    field_penalty = (0.0 if txn_date else 0.15) + (0.0 if total is not None else 0.25)
    item_confidences = [li.confidence for li in line_items]
    overall = min(item_confidences) if item_confidences else 1.0
    confidence = max(0.0, overall - field_penalty)
    return ReceiptScanResult(
        vendor=vendor, txn_date=txn_date, total=total, line_items=line_items,
        confidence=confidence, raw_text=raw_text,
        extra={
            "tax_amount": fields.get("taxAmount"),
            "tax_rate": fields.get("taxRate"),
            "service_charge_amount": fields.get("serviceChargeAmount"),
            "service_charge_rate": fields.get("serviceChargeRate"),
            "payment_method": _norm_payment(fields.get("paymentMethod")),
        },
    )


def process_receipt_image(image_path: str) -> ReceiptScanResult:
    from backend.ocr_provider import VisionOCRNotConfigured, extract_receipt_fields

    try:
        with open(image_path, "rb") as f:
            file_bytes = f.read()
        mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
        fields = extract_receipt_fields(file_bytes, mime_type)
        return _receipt_result_from_vision_fields(fields)
    except VisionOCRNotConfigured:
        pass
    except Exception:
        import logging
        logging.getLogger("cukai.ocr").exception("Vision OCR failed — falling back to Tesseract")

    text, ocr_confidence = extract_text(image_path)
    record = parse_receipt_text(text, ocr_confidence)
    # Tesseract has no way to separate individual items -- it only ever
    # recovers one total for the whole receipt -- so the fallback path
    # surfaces that as a single line item rather than pretending it found
    # several. A low-confidence item still gets flagged "needs review" by
    # the frontend the same way a low-confidence vision-extracted item does.
    line_item = ReceiptLineItem(
        description=record.vendor, amount=record.amount, category=record.category,
        tax_deductible=record.relief_tag is not None, confidence=record.confidence,
    )
    return ReceiptScanResult(
        vendor=record.vendor, txn_date=record.txn_date, total=record.amount or None,
        line_items=[line_item], confidence=record.confidence, raw_text=text, extra=record.extra,
    )
