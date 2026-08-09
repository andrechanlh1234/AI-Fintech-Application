"""Bank/e-wallet statement parser (PDF + CSV).

PDF layout note (learned from statements/CIMBClicks.pdf, a real CIMB Clicks
export): pdfplumber's flat text/table extraction interleaves the wrapped
"Transaction Details" cell around the Date/Amount/Balance row rather than
keeping it contiguous, so naive line-by-line parsing misattributes vendor
text to the wrong transaction. Instead we cluster words by (x0, top) into
column-aware rows and detect "anchor" rows — the one line per transaction
that actually carries the date, an amount, and the running balance — which
CIMB always renders with clean, unambiguous column positions.

Column boundaries are empirical (points from the PDF's own coordinate
space) and are specific to this CIMB Clicks layout. A different bank's
export will have different column x-ranges — this is exactly the
"layout variance per bank" cost driver flagged in the feasibility doc;
expect to add one COLUMN_BOUNDS profile per bank as real samples come in.
"""

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime

from pipeline.categorize import categorize, relief_tag_for
from pipeline.models import Record

DATE_RE = re.compile(r"^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$")

# CIMB Clicks column x0 upper bounds, in points. Last entry must be
# float("inf") so every word past the final real boundary still lands in
# a named column instead of being silently dropped.
CIMB_COLUMN_BOUNDS = {
    "date": 124,
    "details": 339,
    "money_in": 407,
    "money_out": 470,
    "balance": float("inf"),
}

# TNG Wallet "Transaction History" export column x0 upper bounds, in
# points — a different layout from CIMB Clicks (see module docstring).
TNG_COLUMN_BOUNDS = {
    "date": 80,
    "status": 140,
    "type": 230,
    "reference": 295,
    "description": 460,
    "details": 657,
    "amount": 750,
    "balance": float("inf"),
}

TNG_DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")

# Transaction-type keywords that mean money coming IN. Only consulted as a
# fallback for a statement's very first row, where there's no prior
# balance to diff against — every other row's sign is derived from the
# balance delta (see parse_tng_pdf), which stays correct even for
# transaction types not listed here.
TNG_CREDIT_TYPE_HINTS = ("RECEIVE", "TOP UP", "TOPUP")

# Prefix TNG prepends to the description column for card-issuance
# purchases; stripped so the vendor name doesn't start with "Payment - ".
TNG_VENDOR_PREFIXES = ("PAYMENT - ", "PAYMENT-")

# Marker phrases CIMB uses to open a transaction's description block, mapped
# to a human label. `None` means: use the following line as the vendor name.
TRANSACTION_MARKERS = {
    "CREDIT INTEREST": "Bank interest",
    "POCKET MONEY": None,
    "DUITNOW TO ACCOUNT": None,
    "I-PAYMENT": None,
    "MYDEBIT PURCHASE": None,
    "I-FUNDS TR FROM SA": "Funds transfer (internal)",
}


@dataclass
class _Line:
    top: float
    cols: dict[str, str]  # column name -> joined text


def _cluster_lines(words: list[dict], bounds: dict[str, float]) -> list[_Line]:
    """Group words into visual rows (by `top`), then bucket each row's words
    into named columns by x0. Words within 2pt of `top` are the same row —
    tight enough that these banks' line-heights don't merge adjacent rows.

    `bounds` maps column name -> exclusive upper x0 bound, in left-to-right
    order; the last entry should be float("inf") so nothing past it is
    dropped. One `bounds` profile is needed per bank/layout (see module
    docstring) but the row-clustering logic itself is layout-agnostic."""
    rows: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if rows and abs(rows[-1][0]["top"] - w["top"]) <= 2:
            rows[-1].append(w)
        else:
            rows.append([w])

    lines = []
    for row in rows:
        cols: dict[str, list[str]] = {name: [] for name in bounds}
        for w in sorted(row, key=lambda w: w["x0"]):
            for name, upper in bounds.items():
                if w["x0"] < upper:
                    cols[name].append(w["text"])
                    break
        lines.append(_Line(top=row[0]["top"], cols={k: " ".join(v) for k, v in cols.items()}))
    return lines


def _parse_date(text: str) -> date | None:
    m = DATE_RE.match(text.strip())
    if not m:
        return None
    day, mon, year = m.groups()
    return datetime.strptime(f"{day} {mon} {year}", "%d %b %Y").date()


def _parse_amount(col_text: str) -> float | None:
    # column text looks like "MYR 1,599.00" (CIMB) or "RM6.48" (TNG)
    cleaned = col_text.replace("MYR", "").replace("RM", "").strip().replace(",", "")
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _guess_vendor(before: list[str], anchor_detail: str, after: list[str]) -> tuple[str, float]:
    """Best-effort vendor label from the marker phrase + nearby free-text
    lines. Returns (vendor, confidence) — confidence is low (0.4) whenever
    we fall back to raw surrounding text instead of a recognised marker."""
    candidates = before + ([anchor_detail] if anchor_detail else []) + after
    upper_lines = [c.strip() for c in candidates if c.strip()]

    for line in upper_lines:
        for marker, label in TRANSACTION_MARKERS.items():
            if marker in line.upper():
                if label:
                    return label, 0.9
                # vendor is likely the next line that isn't a bare reference/account number
                idx = upper_lines.index(line)
                for cand in upper_lines[idx + 1 :]:
                    if cand.replace(" ", "").isdigit():
                        continue
                    return cand.title(), 0.75
                return marker.title(), 0.5

    # No known marker — fall back to the first plausible free-text line.
    for line in upper_lines:
        if line and not line.replace(",", "").replace(".", "").isdigit():
            return line.title(), 0.4
    return "Uncategorised transaction", 0.3


def parse_cimb_pdf(path: str) -> list[Record]:
    import pdfplumber

    records: list[Record] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            lines = _cluster_lines(page.extract_words(), CIMB_COLUMN_BOUNDS)
            anchor_idxs = [
                i for i, l in enumerate(lines) if _parse_date(l.cols["date"]) and (l.cols["money_in"] or l.cols["money_out"])
            ]
            for pos, i in enumerate(anchor_idxs):
                line = lines[i]
                txn_date = _parse_date(line.cols["date"])
                money_in = _parse_amount(line.cols["money_in"])
                money_out = _parse_amount(line.cols["money_out"])
                amount = money_in if money_in is not None else -(money_out or 0.0)

                prev_anchor = anchor_idxs[pos - 1] if pos > 0 else -1
                next_anchor = anchor_idxs[pos + 1] if pos + 1 < len(anchor_idxs) else len(lines)
                before = [lines[j].cols["details"] for j in range(prev_anchor + 1, i) if lines[j].cols["details"]]
                after = [lines[j].cols["details"] for j in range(i + 1, next_anchor) if lines[j].cols["details"]]

                vendor, confidence = _guess_vendor(before, line.cols["details"], after)
                category = categorize(vendor)
                records.append(
                    Record(
                        source="statement_upload",
                        vendor=vendor,
                        txn_date=txn_date,
                        amount=amount,
                        category=category,
                        relief_tag=relief_tag_for(category),
                        confidence=confidence,
                        raw_text=" | ".join(before + [line.cols["details"]] + after),
                    )
                )
    return records


def _parse_tng_date(text: str) -> date | None:
    m = TNG_DATE_RE.match(text.strip())
    if not m:
        return None
    day, month, year = m.groups()
    return date(int(year), int(month), int(day))


def _tng_sign_from_type(ttype: str) -> int:
    upper = ttype.upper()
    return 1 if any(hint in upper for hint in TNG_CREDIT_TYPE_HINTS) else -1


def _clean_tng_vendor(desc: str, ttype: str) -> str:
    text = desc.strip()
    for prefix in TNG_VENDOR_PREFIXES:
        if text.upper().startswith(prefix):
            text = text[len(prefix) :].strip()
            break
    if not text:
        text = ttype.strip()
    return text.title() if text else "Unknown"


def parse_tng_pdf(path: str) -> list[Record]:
    """TNG Wallet "Transaction History" export. Unlike CIMB, TNG's PDF has
    no separate debit/credit columns — only one unsigned amount plus a
    running balance — and rows are chronological oldest-first rather than
    newest-first. So the sign of each amount is derived from the balance
    delta (balance[i] - balance[i-1]) rather than a transaction-type
    keyword table, which stays correct even for TNG transaction types this
    parser has never seen (Payment, DuitNow QR, PayDirect Payment,
    CARDISSUANCE_PAYMENT, Balance Top Up, Receive from Wallet, ...). The
    keyword table (TNG_CREDIT_TYPE_HINTS) is only a fallback for a
    statement's very first row, where there's no prior balance to diff
    against.

    Each page repeats a footer disclaimer ("*This is a system generated
    email...") below the transaction table; its text falls within the
    same x0 ranges as the type/description columns, so it would otherwise
    be misread as a continuation of the last transaction. Genuine
    continuation rows never have any text in the "date" column (x0 < 80);
    the footer's wrapped lines always do ("*This is a...", "+603 5022
    3888..."), so that's used as the stop condition.
    """
    import pdfplumber

    records: list[Record] = []
    prev_balance: float | None = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            lines = _cluster_lines(page.extract_words(), TNG_COLUMN_BOUNDS)
            anchor_idxs = [
                i for i, l in enumerate(lines) if TNG_DATE_RE.match(l.cols["date"].strip()) and l.cols["amount"].strip()
            ]
            for pos, i in enumerate(anchor_idxs):
                line = lines[i]
                txn_date = _parse_tng_date(line.cols["date"])
                magnitude = _parse_amount(line.cols["amount"])
                balance = _parse_amount(line.cols["balance"])
                if magnitude is None:
                    continue

                next_anchor = anchor_idxs[pos + 1] if pos + 1 < len(anchor_idxs) else len(lines)
                type_parts = [line.cols["type"]]
                desc_parts = [line.cols["description"]]
                for j in range(i + 1, next_anchor):
                    if lines[j].cols["date"].strip():
                        break  # footer disclaimer, not a continuation row
                    if lines[j].cols["type"]:
                        type_parts.append(lines[j].cols["type"])
                    if lines[j].cols["description"]:
                        desc_parts.append(lines[j].cols["description"])

                ttype = " ".join(p for p in type_parts if p).strip()
                vendor = _clean_tng_vendor(" ".join(p for p in desc_parts if p), ttype)

                used_balance_delta = prev_balance is not None and balance is not None
                if used_balance_delta:
                    amount = round(balance - prev_balance, 2)
                else:
                    amount = magnitude * _tng_sign_from_type(ttype)
                if balance is not None:
                    prev_balance = balance

                category = categorize(vendor)
                records.append(
                    Record(
                        source="statement_upload",
                        vendor=vendor,
                        txn_date=txn_date,
                        amount=amount,
                        category=category,
                        relief_tag=relief_tag_for(category),
                        confidence=0.9 if used_balance_delta else 0.6,
                        raw_text=" | ".join([ttype, *[p for p in desc_parts if p]]),
                    )
                )
    return records


def parse_csv(text: str) -> list[Record]:
    """Generic e-wallet/bank CSV parser. Auto-detects date/description/amount
    columns by common header aliases rather than assuming one bank's export
    format — TnG, GrabPay and card-issuer CSVs all name columns differently."""
    DATE_ALIASES = {"date", "transaction date", "txn date", "posting date"}
    DESC_ALIASES = {"description", "details", "particulars", "transaction details", "merchant"}
    AMOUNT_ALIASES = {"amount", "value"}
    DEBIT_ALIASES = {"debit", "money out", "withdrawal"}
    CREDIT_ALIASES = {"credit", "money in", "deposit"}

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    norm = {f: f.strip().lower() for f in reader.fieldnames}

    def find(aliases):
        for field, low in norm.items():
            if low in aliases:
                return field
        return None

    date_f = find(DATE_ALIASES)
    desc_f = find(DESC_ALIASES)
    amount_f = find(AMOUNT_ALIASES)
    debit_f = find(DEBIT_ALIASES)
    credit_f = find(CREDIT_ALIASES)

    records: list[Record] = []
    for row in reader:
        raw_date = (row.get(date_f) or "").strip() if date_f else ""
        vendor = (row.get(desc_f) or "Unknown").strip() if desc_f else "Unknown"

        amount = 0.0
        if amount_f and row.get(amount_f):
            amount = float(row[amount_f].replace(",", "").replace("MYR", "").strip() or 0)
        elif debit_f or credit_f:
            debit = float((row.get(debit_f) or "0").replace(",", "") or 0) if debit_f else 0.0
            credit = float((row.get(credit_f) or "0").replace(",", "") or 0) if credit_f else 0.0
            amount = credit - debit

        txn_date = None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y"):
            try:
                txn_date = datetime.strptime(raw_date, fmt).date()
                break
            except ValueError:
                continue

        category = categorize(vendor)
        records.append(
            Record(
                source="statement_upload",
                vendor=vendor,
                txn_date=txn_date,
                amount=amount,
                category=category,
                relief_tag=relief_tag_for(category),
                confidence=1.0 if txn_date else 0.5,
                raw_text=str(row),
            )
        )
    return records
