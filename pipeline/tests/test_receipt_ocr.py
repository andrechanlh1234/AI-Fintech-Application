import io
import os

import pytest
from PIL import Image

from pipeline.receipt_ocr import (
    _receipt_result_from_vision_fields,
    normalize_to_jpeg,
    parse_receipt_text,
    process_receipt_image,
)
from pipeline.tests.generate_sample_receipt import generate


def test_parse_receipt_text_extracts_core_fields():
    text = "Guardian Pharmacy\nMid Valley Megamall\nDate: 03/07/2026\n\nTOTAL   RM 66.40\n"
    record = parse_receipt_text(text)
    assert record.vendor == "Guardian Pharmacy"
    assert record.amount == 66.40
    assert record.txn_date.isoformat() == "2026-07-03"
    assert record.category == "Medical"
    assert record.relief_tag == "Medical relief — RM10,000 cap"


def test_process_receipt_image_tesseract_fallback_returns_single_line_item():
    # No GEMINI_API_KEY in the test environment -- process_receipt_image
    # falls back to the local Tesseract path, which has no way to separate
    # individual items, so it must surface exactly one line item for the
    # whole receipt rather than pretending it found several.
    path = generate()
    result = process_receipt_image(path)
    assert "guardian" in result.vendor.lower()
    assert result.total == 66.40
    assert len(result.line_items) == 1
    assert result.line_items[0].amount == 66.40
    assert result.line_items[0].category == "Medical"
    assert result.confidence > 0


def test_normalize_to_jpeg_round_trips_a_plain_image():
    img = Image.new("RGB", (40, 20), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    out = normalize_to_jpeg(buf.getvalue())
    decoded = Image.open(io.BytesIO(out))
    assert decoded.format == "JPEG"
    assert decoded.size == (40, 20)


def test_normalize_to_jpeg_raises_on_undecodable_bytes():
    with pytest.raises(Exception):
        normalize_to_jpeg(b"this is not an image")


def test_process_receipt_image_reads_a_heic_photo():
    # Regression test for the "receipt unable to be read" bug report
    # (2026-09-05): a receipt picked from the iOS Photos library (HEIC by
    # default since iOS 11, unlike a fresh in-app camera capture which is
    # always JPEG) used to raise PIL.UnidentifiedImageError uncaught,
    # surfacing as a 422 for what the user rightly saw as a perfectly
    # normal receipt. Re-encodes the same synthetic fixture the other tests
    # use as real HEIC bytes (pillow_heif can both decode and encode) and
    # asserts the exact same pipeline that works for a JPEG/PNG upload also
    # works for this one, rather than raising.
    png_path = generate()
    img = Image.open(png_path).convert("RGB")
    heic_path = os.path.join(os.path.dirname(png_path), "sample_receipt_regression.heic")
    img.save(heic_path, format="HEIF")

    result = process_receipt_image(heic_path)

    assert "guardian" in result.vendor.lower()
    assert result.total == 66.40


def test_receipt_result_from_vision_fields_maps_line_items():
    fields = {
        "vendor": "AEON",
        "date": "2026-08-25",
        "total": 43.0,
        "lineItems": [
            {"description": "Milk", "amount": 8.0, "category": "Groceries", "taxDeductible": False, "confidence": 0.95},
            {"description": "Notebook", "amount": 10.0, "category": "Lifestyle", "taxDeductible": True, "confidence": 0.4},
        ],
    }
    result = _receipt_result_from_vision_fields(fields)
    assert result.vendor == "AEON"
    assert result.total == 43.0
    assert len(result.line_items) == 2
    assert result.line_items[0].description == "Milk"
    assert result.line_items[0].tax_deductible is False
    assert result.line_items[1].tax_deductible is True
    # Overall confidence tracks the weakest item, not an average -- one
    # badly-read item should make the whole scan read as "look closely",
    # not get diluted by clean items sitting alongside it.
    assert result.confidence == 0.4


def test_receipt_result_from_vision_fields_drops_items_missing_amount_or_description():
    fields = {
        "vendor": "AEON", "date": None, "total": 10.0,
        "lineItems": [{"description": "", "amount": 5.0}, {"description": "Item", "amount": None}],
    }
    result = _receipt_result_from_vision_fields(fields)
    assert result.line_items == []


def test_receipt_result_from_vision_fields_falls_back_to_keyword_category():
    fields = {
        "vendor": "AEON", "date": "2026-08-25", "total": 8.0,
        "lineItems": [{"description": "Milk", "amount": 8.0, "category": "NotARealCategory", "taxDeductible": False, "confidence": 0.9}],
    }
    result = _receipt_result_from_vision_fields(fields)
    assert result.line_items[0].category == "Groceries"  # categorize("Milk", "AEON") keyword match
