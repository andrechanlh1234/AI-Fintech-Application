"""Receipt photo -> structured Record, via local Tesseract OCR.

This is tier 1 of the feasibility doc's tiered OCR plan (free, offline,
good on clean/flat receipts). It does not attempt to handle heavily
angled or crumpled photos — that's tier 2 (a cloud vision API fallback),
deliberately left as a pluggable seam (`OCR_ENGINE`) rather than built
now, since it needs an API key this environment doesn't have.
"""

import re
from datetime import date, datetime

from PIL import Image, ImageOps

from pipeline.categorize import categorize, relief_tag_for
from pipeline.models import Record

TOTAL_LINE_RE = re.compile(r"(total|jumlah|amount due|grand total)", re.IGNORECASE)
# Tesseract commonly inserts a stray space right after the decimal point on
# thermal-receipt fonts ("RM10. 20") — tolerate it and strip on capture.
MONEY_RE = re.compile(r"(?:rm|myr)?\s?(\d{1,3}(?:,\d{3})*\.\s?\d{2})", re.IGNORECASE)

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


def _find_vendor(text: str) -> str:
    for line in text.splitlines():
        cleaned = line.strip()
        if len(cleaned) >= 3 and not cleaned.replace(" ", "").isdigit():
            return cleaned.title()
    return "Unknown vendor"


def parse_receipt_text(text: str, ocr_confidence: float = 1.0) -> Record:
    vendor = _find_vendor(text)
    amount = _find_amount(text) or 0.0
    txn_date = _find_date(text)
    category = categorize(vendor, text)

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
    )


def process_receipt_image(image_path: str) -> Record:
    text, ocr_confidence = extract_text(image_path)
    return parse_receipt_text(text, ocr_confidence)
