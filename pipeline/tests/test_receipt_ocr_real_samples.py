"""Smoke test against real photographed receipts (receipts/*.jpg|jpeg).

Unlike test_receipt_ocr.py's synthetic-image test, these are real phone
photos — several are low-resolution, angled, or partly occluded. OCR
output on them isn't stable enough to assert exact vendor/amount values
(a Tesseract version bump could shift a misread digit), so this only
asserts the pipeline runs end-to-end and returns a well-formed
ReceiptScanResult for every sample. See the conversation / commit history
for the actual accuracy numbers observed on this sample set.
"""

import glob
import os

import pytest

from pipeline.categorize import CATEGORY_KEYWORDS
from pipeline.receipt_ocr import process_receipt_image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
RECEIPT_SAMPLES = sorted(glob.glob(os.path.join(REPO_ROOT, "receipts", "*")))
VALID_CATEGORIES = {name for name, _ in CATEGORY_KEYWORDS} | {"Other"}


@pytest.mark.skipif(not RECEIPT_SAMPLES, reason="no real receipt photos present")
@pytest.mark.parametrize("path", RECEIPT_SAMPLES)
def test_process_real_receipt_returns_well_formed_record(path):
    result = process_receipt_image(path)
    assert result.vendor
    assert result.total is None or result.total >= 0
    assert 0.0 <= result.confidence <= 1.0
    for item in result.line_items:
        assert item.description
        assert item.amount >= 0
        assert item.category in VALID_CATEGORIES
        assert 0.0 <= item.confidence <= 1.0
