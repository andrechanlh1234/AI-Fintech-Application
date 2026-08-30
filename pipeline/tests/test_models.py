from datetime import date

from pipeline.models import ReceiptLineItem, ReceiptScanResult


def test_receipt_line_item_to_dict():
    item = ReceiptLineItem(description="Milk", amount=8.0, category="Groceries", tax_deductible=False, confidence=0.95)
    assert item.to_dict() == {
        "description": "Milk", "amount": 8.0, "category": "Groceries",
        "taxDeductible": False, "confidence": 0.95,
    }


def test_receipt_scan_result_to_dict_includes_line_items_and_extras():
    result = ReceiptScanResult(
        vendor="AEON",
        txn_date=date(2026, 8, 25),
        total=43.0,
        line_items=[
            ReceiptLineItem(description="Milk", amount=8.0, category="Groceries", tax_deductible=False, confidence=0.95),
            ReceiptLineItem(description="Notebook", amount=10.0, category="Lifestyle", tax_deductible=True, confidence=0.4),
        ],
        confidence=0.4,
        extra={"tax_amount": 2.4, "tax_rate": 6, "service_charge_amount": None, "service_charge_rate": None},
    )
    d = result.to_dict()
    assert d["vendor"] == "AEON"
    assert d["date"] == "2026-08-25"
    assert d["total"] == 43.0
    assert len(d["lineItems"]) == 2
    assert d["lineItems"][1]["description"] == "Notebook"
    assert d["confidence"] == 0.4
    assert d["taxAmount"] == 2.4
    assert d["taxRate"] == 6
    assert d["serviceChargeAmount"] is None


def test_receipt_scan_result_to_dict_handles_no_total_and_no_items():
    result = ReceiptScanResult(vendor="Unknown vendor", txn_date=None, total=None, line_items=[])
    d = result.to_dict()
    assert d["total"] is None
    assert d["lineItems"] == []
    assert d["date"] is None
