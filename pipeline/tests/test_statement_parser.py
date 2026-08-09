import os

import pytest

from pipeline.statement_parser import parse_cimb_pdf, parse_csv, parse_tng_pdf

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
    records = parse_csv(csv_text)
    assert len(records) == 2
    assert records[0].vendor == "Grab Ride"
    assert records[0].amount == -18.40
    assert records[0].category == "Transport"
    assert records[1].amount == 3000.00


def test_parse_csv_handles_missing_columns_gracefully():
    records = parse_csv("Foo,Bar\n1,2\n")
    assert len(records) == 1
    assert records[0].vendor == "Unknown"
