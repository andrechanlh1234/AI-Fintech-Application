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
            "tax_amount": money_or_none("tax_amount"),
            "tax_rate": money_or_none("tax_rate"),
            "service_charge_amount": money_or_none("service_charge_amount"),
            "service_charge_rate": money_or_none("service_charge_rate"),
        }
