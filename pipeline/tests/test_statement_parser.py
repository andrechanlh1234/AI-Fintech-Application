import os

import pytest

from pipeline.models import Record
from pipeline.statement_parser import (
    annotate_kind,
    detect_statement_type,
    parse_cimb_pdf,
    parse_csv,
    parse_tng_pdf,
)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
CIMB_SAMPLE = os.path.join(REPO_ROOT, "statements", "CIMBClicks.pdf")
TNG_SAMPLE = os.path.join(REPO_ROOT, "statements", "TNG.pdf")


@pytest.mark.skipif(not os.path.exists(CIMB_SAMPLE), reason="real sample statement not present")
def test_parse_cimb_pdf_extracts_every_transaction():
    records = parse_cimb_pdf(CIMB_SAMPLE)
    assert len(records) == 30  # matches manual count of dated rows in the source PDF
    for r in records:
        assert r.txn_date is not None
        assert r.amount != 0


@pytest.mark.skipif(not os.path.exists(CIMB_SAMPLE), reason="real sample statement not present")
def test_parse_cimb_pdf_balance_chain_is_consistent():
    """The running balance column lets us cross-check sign + amount independent
    of the vendor-name heuristics: balance[i] should equal balance[i-1] + amount[i]
    for consecutive rows on the same page (rows are newest-first)."""
    import pdfplumber

    from pipeline.statement_parser import CIMB_COLUMN_BOUNDS, _cluster_lines, _parse_amount, _parse_date

    with pdfplumber.open(CIMB_SAMPLE) as pdf:
        page = pdf.pages[0]
        lines = _cluster_lines(page.extract_words(), CIMB_COLUMN_BOUNDS)
        anchors = [l for l in lines if _parse_date(l.cols["date"]) and (l.cols["money_in"] or l.cols["money_out"])]

    balances = [_parse_amount(a.cols["balance"]) for a in anchors]
    amounts = [
        _parse_amount(a.cols["money_in"]) if a.cols["money_in"] else -_parse_amount(a.cols["money_out"])
        for a in anchors
    ]
    # anchors are newest-first, so balance[i] - amount[i] should equal balance[i+1]
    for i in range(len(anchors) - 1):
        assert round(balances[i] - amounts[i], 2) == round(balances[i + 1], 2)


@pytest.mark.skipif(not os.path.exists(TNG_SAMPLE), reason="real sample statement not present")
def test_parse_tng_pdf_extracts_every_transaction():
    records = parse_tng_pdf(TNG_SAMPLE)
    assert len(records) == 91  # matches manual count of dated rows in the source PDF
    for r in records:
        assert r.txn_date is not None
        assert r.amount != 0


@pytest.mark.skipif(not os.path.exists(TNG_SAMPLE), reason="real sample statement not present")
def test_parse_tng_pdf_balance_chain_is_consistent():
    """TNG prints only an unsigned amount plus a running balance (no
    separate debit/credit columns like CIMB), so the parser derives each
    amount's sign from the balance delta. This independently re-derives
    the running balance from the parsed, signed amounts and checks it
    matches the statement's own balance column exactly, across the full
    10-page, chronologically-ascending statement."""
    import pdfplumber

    from pipeline.statement_parser import TNG_COLUMN_BOUNDS, TNG_DATE_RE, _cluster_lines, _parse_amount

    printed_balances = []
    with pdfplumber.open(TNG_SAMPLE) as pdf:
        for page in pdf.pages:
            lines = _cluster_lines(page.extract_words(), TNG_COLUMN_BOUNDS)
            for l in lines:
                if TNG_DATE_RE.match(l.cols["date"].strip()) and l.cols["amount"].strip():
                    printed_balances.append(_parse_amount(l.cols["balance"]))

    records = parse_tng_pdf(TNG_SAMPLE)
    assert len(records) == len(printed_balances)

    running = round(printed_balances[0] - records[0].amount, 2)  # reconstructed opening balance
    for record, printed in zip(records, printed_balances):
        running = round(running + record.amount, 2)
        assert running == printed


@pytest.mark.skipif(not os.path.exists(TNG_SAMPLE), reason="real sample statement not present")
def test_parse_tng_pdf_first_row_has_no_prior_balance_to_diff_against():
    """The first transaction has no prior balance, so its sign comes from
    the transaction-type keyword fallback instead of the (more reliable)
    balance delta — it should carry lower confidence than later rows."""
    records = parse_tng_pdf(TNG_SAMPLE)
    assert records[0].confidence < records[1].confidence


def test_parse_csv_maps_common_headers():
    csv_text = "Date,Description,Debit,Credit\n01/06/2026,Grab Ride,18.40,\n02/06/2026,Salary,,3000.00\n"
    records, statement_type = parse_csv(csv_text)
    assert statement_type == "unknown"
    assert len(records) == 2
    assert records[0].vendor == "Grab Ride"
    assert records[0].amount == -18.40
    assert records[0].category == "Transport"
    assert records[1].amount == 3000.00


def test_parse_csv_handles_missing_columns_gracefully():
    records, statement_type = parse_csv("Foo,Bar\n1,2\n")
    assert statement_type == "unknown"
    assert len(records) == 1
    assert records[0].vendor == "Unknown"


# --- statement-type detection + per-row kind ---------------------------------

def test_detect_statement_type_credit_card():
    text = "VISA Credit Card\nCredit Limit: RM10,000.00\nMinimum Payment Due: RM50.00"
    assert detect_statement_type(text) == "credit_card"


def test_detect_statement_type_bank():
    text = "MyBank Savings Account\nAvailable Balance: RM1,234.56\nOpening Balance: RM1,000.00"
    assert detect_statement_type(text) == "bank"


def test_detect_statement_type_ewallet():
    text = "Touch 'n Go eWallet\nTransaction History\n01/06/2026 Reload RM50.00"
    assert detect_statement_type(text) == "ewallet"


def test_detect_statement_type_unknown():
    assert detect_statement_type("just some unrelated text about cats and weather") == "unknown"


def test_detect_statement_type_priority_credit_card_over_bank():
    # A credit-card statement can also mention "closing balance" — the strong
    # credit-card hint must still win.
    text = "Credit Card Statement of Account\nClosing Balance: RM900.00\nMinimum Payment Due: RM45.00"
    assert detect_statement_type(text) == "credit_card"


def test_annotate_kind_credit_card_payment_vs_expense():
    payment = Record(source="statement_upload", vendor="Payment received", txn_date=None, amount=120.0)
    spend = Record(source="statement_upload", vendor="Shopee", txn_date=None, amount=-45.0)
    assert annotate_kind(payment, "credit_card") == "payment"
    assert annotate_kind(spend, "credit_card") == "expense"


def test_annotate_kind_bank_income_vs_expense():
    credit = Record(source="statement_upload", vendor="Salary", txn_date=None, amount=3000.0)
    debit = Record(source="statement_upload", vendor="ATM", txn_date=None, amount=-100.0)
    assert annotate_kind(credit, "bank") == "income"
    assert annotate_kind(debit, "bank") == "expense"
    # "unknown" behaves like a bank statement
    assert annotate_kind(credit, "unknown") == "income"


def test_annotate_kind_ewallet_topup_is_payment_not_income():
    topup = Record(source="statement_upload", vendor="Reload", txn_date=None, amount=50.0)
    assert annotate_kind(topup, "ewallet") == "payment"


def test_parse_csv_credit_card_type_tags_payment_and_expense():
    csv_text = (
        "Date,Description,Amount\n"
        "01/06/2026,CREDIT CARD RETAIL PURCHASE - Shopee,-45.00\n"
        "05/06/2026,MINIMUM PAYMENT DUE - payment received thank you,120.00\n"
    )
    records, statement_type = parse_csv(csv_text)
    assert statement_type == "credit_card"
    assert records[0].amount == -45.00
    assert records[0].kind == "expense"
    assert records[1].amount == 120.00
    assert records[1].kind == "payment"


def test_parse_csv_bank_type_tags_income():
    csv_text = (
        "Date,Description,Amount\n"
        "01/06/2026,SAVINGS ACCOUNT credit interest,5.00\n"
        "02/06/2026,ATM cash withdrawal,-100.00\n"
    )
    records, statement_type = parse_csv(csv_text)
    assert statement_type == "bank"
    assert records[0].kind == "income"
    assert records[1].kind == "expense"


def test_record_to_dict_includes_kind():
    rec = Record(source="statement_upload", vendor="Shopee", txn_date=None, amount=-45.0)
    rec.kind = annotate_kind(rec, "credit_card")
    d = rec.to_dict()
    assert d["kind"] == "expense"
    assert d["amount"] == -45.0  # signed amount is unchanged
