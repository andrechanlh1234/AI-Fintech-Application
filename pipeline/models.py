from dataclasses import dataclass, field
from datetime import date


@dataclass
class Record:
    """One structured spending record — the shape every input source (receipt
    photo, statement line, Gmail invoice) is normalised into. Mirrors the
    field table in Section 8 of Business_Proposal_Draft.docx."""

    source: str  # "receipt_photo" | "statement_upload" | "gmail_invoice"
    vendor: str
    txn_date: date | None
    amount: float
    category: str = "Other"
    relief_tag: str | None = None
    confidence: float = 1.0  # 1.0 for manual entry / clean parse, lower for noisy OCR
    raw_text: str = ""
    # "expense" | "income" | "payment". Depends on the statement type the row
    # came from (a "+RM" row is income on a bank statement but a bill payment
    # on a credit-card one), which a bare Record can't know — so the parser
    # layer sets this via statement_parser.annotate_kind before serialising.
    kind: str = "expense"
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        def money_or_none(key: str) -> float | None:
            value = self.extra.get(key)
            return round(value, 2) if value is not None else None

        return {
            "source": self.source,
            "vendor": self.vendor,
            "date": self.txn_date.isoformat() if self.txn_date else None,
            "amount": round(self.amount, 2),
            "category": self.category,
            "relief_tag": self.relief_tag,
            "confidence": round(self.confidence, 2),
            "kind": self.kind,
            "tax_amount": money_or_none("tax_amount"),
            "tax_rate": money_or_none("tax_rate"),
            "service_charge_amount": money_or_none("service_charge_amount"),
            "service_charge_rate": money_or_none("service_charge_rate"),
        }


@dataclass
class ReceiptLineItem:
    """One line item extracted from (or manually entered onto) a single
    receipt -- the unit that becomes its own Transaction on the frontend.
    `confidence` below the frontend's LOW_CONFIDENCE_THRESHOLD is what gets
    flagged "needs review" before the user can save."""

    description: str
    amount: float
    category: str = "Other"
    tax_deductible: bool = False
    confidence: float = 1.0

    def to_dict(self) -> dict:
        return {
            "description": self.description,
            "amount": round(self.amount, 2),
            "category": self.category,
            "taxDeductible": self.tax_deductible,
            "confidence": round(self.confidence, 2),
        }


@dataclass
class ReceiptScanResult:
    """Whole-receipt OCR result: the parent receipt fields plus every line
    item detected on it -- replaces the old single-Record-per-receipt shape
    so one receipt scan can become many transactions on the frontend."""

    vendor: str
    txn_date: date | None
    total: float | None  # the printed grand total, for the frontend's line-items-vs-total mismatch check
    line_items: list[ReceiptLineItem] = field(default_factory=list)
    confidence: float = 1.0
    raw_text: str = ""
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        def money_or_none(key: str) -> float | None:
            value = self.extra.get(key)
            return round(value, 2) if value is not None else None

        return {
            "vendor": self.vendor,
            "date": self.txn_date.isoformat() if self.txn_date else None,
            "total": round(self.total, 2) if self.total is not None else None,
            "lineItems": [li.to_dict() for li in self.line_items],
            "confidence": round(self.confidence, 2),
            "taxAmount": money_or_none("tax_amount"),
            "taxRate": money_or_none("tax_rate"),
            "serviceChargeAmount": money_or_none("service_charge_amount"),
            "serviceChargeRate": money_or_none("service_charge_rate"),
            "paymentMethod": self.extra.get("payment_method"),
        }
