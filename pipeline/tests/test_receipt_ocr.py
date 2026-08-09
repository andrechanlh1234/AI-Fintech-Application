from pipeline.receipt_ocr import parse_receipt_text, process_receipt_image
from pipeline.tests.generate_sample_receipt import generate


def test_parse_receipt_text_extracts_core_fields():
    text = "Guardian Pharmacy\nMid Valley Megamall\nDate: 03/07/2026\n\nTOTAL   RM 66.40\n"
    record = parse_receipt_text(text)
    assert record.vendor == "Guardian Pharmacy"
    assert record.amount == 66.40
    assert record.txn_date.isoformat() == "2026-07-03"
    assert record.category == "Medical"
    assert record.relief_tag == "Medical relief — RM10,000 cap"


def test_process_receipt_image_end_to_end():
    path = generate()
    record = process_receipt_image(path)
    assert "guardian" in record.vendor.lower()
    assert record.amount == 66.40
    assert record.category == "Medical"
    assert record.confidence > 0
