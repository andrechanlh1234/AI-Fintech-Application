"""Malaysian resident-individual income-tax reference — Year of Assessment 2025.

This module grounds the AI assistant (backend/ai_chat.py) in a concrete,
structured set of LHDN/HASiL facts so its tax answers cite real caps and
conditions instead of guessing.

Two things are exported:

* Structured data (``TAX_RATES_YA2025``, ``MY_TAX_BRACKETS``, ``RELIEFS``,
  ``REBATES``, ...) so the same facts can be reused elsewhere.
* ``TAX_KB_PROMPT`` — the whole thing rendered as one compact plain-text
  block, prepended to the chat system prompt whenever the user's message
  ``looks_tax_related``.

ACCURACY: the figures here are compiled from general knowledge of LHDN's
YA2025 rules. They are NOT a licensed tax advisor's advice and NOT a live
LHDN confirmation; Budget 2025 changed several amounts. Verify against
LHDN/HASiL (hasil.gov.my) before using any of this for a real filing.
Consistency note: this set is intended to be a superset of, and
consistent with, ``app/src/lib/taxEngine.ts``'s ``TAX_ITEMS_META``.
"""

from __future__ import annotations

import re

DISCLAIMER = (
    "These figures are a reference compiled from general knowledge of LHDN/HASiL "
    "rules for Year of Assessment 2025 (income earned 1 Jan-31 Dec 2025, filed in "
    "2026). They are not a licensed tax advisor's advice and not a live LHDN "
    "confirmation, they may contain errors or omissions, and Budget 2025 changed "
    "several relief amounts. Verify every figure and condition against LHDN/HASiL "
    "(hasil.gov.my) or a licensed tax agent before relying on it for a real filing."
)

# ---------------------------------------------------------------------------
# Resident individual tax rates, YA2025 (chargeable income in RM).
# Chargeable income = total (aggregate) income - approved donations - reliefs.
# ``cumulative_tax`` is the total tax at the top edge of the band.
# ---------------------------------------------------------------------------
TAX_RATES_YA2025 = [
    {"lower": 0, "upper": 5_000, "rate": 0.00, "tax_on_band": 0, "cumulative_tax": 0},
    {"lower": 5_001, "upper": 20_000, "rate": 0.01, "tax_on_band": 150, "cumulative_tax": 150},
    {"lower": 20_001, "upper": 35_000, "rate": 0.03, "tax_on_band": 450, "cumulative_tax": 600},
    {"lower": 35_001, "upper": 50_000, "rate": 0.06, "tax_on_band": 900, "cumulative_tax": 1_500},
    {"lower": 50_001, "upper": 70_000, "rate": 0.11, "tax_on_band": 2_200, "cumulative_tax": 3_700},
    {"lower": 70_001, "upper": 100_000, "rate": 0.19, "tax_on_band": 5_700, "cumulative_tax": 9_400},
    {"lower": 100_001, "upper": 400_000, "rate": 0.25, "tax_on_band": 75_000, "cumulative_tax": 84_400},
    {"lower": 400_001, "upper": 600_000, "rate": 0.26, "tax_on_band": 52_000, "cumulative_tax": 136_400},
    {"lower": 600_001, "upper": 2_000_000, "rate": 0.28, "tax_on_band": 392_000, "cumulative_tax": 528_400},
    {"lower": 2_000_001, "upper": None, "rate": 0.30, "tax_on_band": None, "cumulative_tax": None},
]

# Same edges in the compact "up to X -> rate" shape used by
# app/src/lib/taxEngine.ts (MY_TAX_BRACKETS). ``None`` upper == no ceiling.
MY_TAX_BRACKETS = [
    {"up_to": 5_000, "rate": 0.00},
    {"up_to": 20_000, "rate": 0.01},
    {"up_to": 35_000, "rate": 0.03},
    {"up_to": 50_000, "rate": 0.06},
    {"up_to": 70_000, "rate": 0.11},
    {"up_to": 100_000, "rate": 0.19},
    {"up_to": 400_000, "rate": 0.25},
    {"up_to": 600_000, "rate": 0.26},
    {"up_to": 2_000_000, "rate": 0.28},
    {"up_to": None, "rate": 0.30},
]


def marginal_rate(chargeable_income: float) -> float:
    """Marginal (top-ringgit) rate for a given chargeable income, YA2025."""
    for b in MY_TAX_BRACKETS:
        if b["up_to"] is None or chargeable_income <= b["up_to"]:
            return b["rate"]
    return 0.30


# ---------------------------------------------------------------------------
# Personal reliefs, grouped the way taxEngine.ts's TAX_ITEMS_META groups
# them. ``cap`` is an int (RM) where a single number applies, or a short
# string where the cap is tiered/conditional. ``text`` carries what counts,
# what doesn't, and the qualifying conditions.
# ---------------------------------------------------------------------------
RELIEF_GROUPS = [
    ("individual", "Individual"),
    ("medical", "Medical & Special Needs"),
    ("lifestyle", "Lifestyle"),
    ("epf", "EPF & Life Insurance"),
    ("child", "Child Relief"),
]

RELIEFS: dict[str, list[dict]] = {
    "individual": [
        {
            "key": "indiv_self",
            "name": "Self & dependent relatives",
            "cap": 9_000,
            "text": "Automatic for every resident individual; no receipts required.",
        },
        {
            "key": "indiv_disabled",
            "name": "Disabled individual (OKU)",
            "cap": 7_000,
            "text": (
                "Additional relief on top of the self relief. Must be a Malaysian "
                "resident registered as OKU with JKM (Department of Social Welfare). "
                "Raised from RM6,000 to RM7,000 in Budget 2025, effective YA2025."
            ),
        },
        {
            "key": "indiv_education",
            "name": "Education fees (self)",
            "cap": 7_000,
            "text": (
                "Fees at recognised institutions: up to tertiary level in "
                "law/accounting/Islamic finance/technical/vocational/industrial/"
                "scientific/technological fields; any field for a Masters or PhD; "
                "upskilling / self-enhancement courses recognised by DSD are "
                "restricted to RM2,000 within the RM7,000. Own study only."
            ),
        },
        {
            "key": "indiv_housing",
            "name": "Interest on housing loan - first residential home",
            "cap": "tiered: RM7,000 / RM5,000 by purchase price",
            "text": (
                "Interest paid on a loan for a first residential home, tiered by "
                "purchase price: purchase price up to RM500,000 -> up to RM7,000 per "
                "YA; RM500,001 to RM750,000 -> up to RM5,000 per YA; above RM750,000 "
                "-> not eligible. Conditions: Malaysian citizen and resident; you own "
                "only one residential property; it is not rented out; the Sale & "
                "Purchase Agreement is executed within the qualifying window (SPA "
                "1 Jan 2025-31 Dec 2027); claimable for 3 consecutive YAs starting "
                "from the first YA the interest is claimed."
            ),
        },
        {
            "key": "indiv_spouse",
            "name": "Husband / wife / alimony",
            "cap": 4_000,
            "text": (
                "Spouse has no income for the year (or elects joint assessment), or "
                "alimony paid to a former wife under a formal agreement. Voluntary "
                "alimony does not count."
            ),
        },
        {
            "key": "indiv_disabled_spouse",
            "name": "Disabled spouse",
            "cap": 6_000,
            "text": (
                "Additional relief on top of the RM4,000 spouse relief where the "
                "spouse is a registered OKU. Raised from RM5,000 to RM6,000 in "
                "Budget 2025, effective YA2025."
            ),
        },
    ],
    "medical": [
        {
            "key": "med_self",
            "name": "Medical treatment - self, spouse, child",
            "cap": 10_000,
            "text": (
                "RM10,000 total, made up of: serious diseases (cancer, kidney "
                "failure, heart attack, leukaemia, Parkinson's, etc.) and their "
                "treatment; fertility treatment (IVF/IUI) for married individuals; "
                "vaccination - sub-limit RM1,000; dental examination and treatment - "
                "sub-limit RM1,000; full medical check-up + COVID-19 test + "
                "mental-health consultation - combined sub-limit RM1,000; for a child "
                "aged 18 or below, assessment / early intervention / rehabilitation "
                "for a learning disability (autism, ADHD, GDD, Down syndrome) - "
                "sub-limit RM4,000. Needs receipts plus certification by a registered "
                "medical practitioner."
            ),
        },
        {
            "key": "med_parents",
            "name": "Parents - medical, dental, care & treatment",
            "cap": 8_000,
            "text": (
                "Medical and dental treatment, special needs and carer expenses for "
                "parents. Parents resident in Malaysia; treatment / carer in Malaysia; "
                "certified by a registered medical practitioner; carer fee not paid to "
                "yourself or your spouse."
            ),
        },
        {
            "key": "med_equipment",
            "name": "Disabled supporting equipment",
            "cap": 6_000,
            "text": (
                "Supporting equipment for a disabled (OKU) self, spouse, child or "
                "parent - wheelchair, artificial limb, hearing aid, etc. Excludes "
                "spectacles and optical lenses."
            ),
        },
    ],
    "lifestyle": [
        {
            "key": "life_general",
            "name": "Lifestyle (general)",
            "cap": 2_500,
            "text": (
                "For self, spouse or child: books, journals, newspapers and other "
                "publications (not banned material); a personal computer, smartphone "
                "or tablet (not for business use); monthly internet subscription in "
                "your own name; fees for a skill or self-improvement course."
            ),
        },
        {
            "key": "life_additional",
            "name": "Additional lifestyle - sports",
            "cap": 1_000,
            "text": (
                "Separate from the RM2,500 above. Sports equipment for an activity "
                "listed under the Sports Development Act 1997, gym membership, rental "
                "of sports facilities, entry fees for sanctioned competitions, and "
                "training fees paid to registered sports bodies. Self, spouse or "
                "child."
            ),
        },
        {
            "key": "life_ev",
            "name": "EV charging equipment",
            "cap": 2_500,
            "text": (
                "Purchase, installation, rental, hire-purchase or subscription of EV "
                "charging equipment for your own vehicle; not for business use."
            ),
        },
        {
            "key": "life_compost",
            "name": "Domestic food-waste composting machine",
            "cap": 2_500,
            "text": (
                "A separate RM2,500 relief for buying a domestic food-waste "
                "composting machine for own household use, claimable once every "
                "three years of assessment. The Cukai app currently tracks this on "
                "the same line as EV charging equipment - split your claim if you "
                "have both."
            ),
        },
    ],
    "epf": [
        {
            "key": "epf_life",
            "name": "Life insurance & EPF",
            "cap": 7_000,
            "text": (
                "RM7,000 combined. Non-pensionable (private sector): EPF/KWSP "
                "contributions restricted to RM4,000 and life insurance / takaful "
                "premiums restricted to RM3,000. Pensionable public servant with no "
                "EPF contribution: up to the full RM7,000 for life insurance / "
                "takaful."
            ),
        },
        {
            "key": "epf_edu_med",
            "name": "Education & medical insurance",
            "cap": 3_000,
            "text": "Premiums for education or medical insurance / takaful for self, spouse or child.",
        },
        {
            "key": "epf_prs",
            "name": "PRS & deferred annuity",
            "cap": 3_000,
            "text": "Contributions to an approved Private Retirement Scheme fund or a deferred annuity.",
        },
        {
            "key": "epf_sspn",
            "name": "SSPN net deposit",
            "cap": 8_000,
            "text": (
                "Net deposit (total deposits minus total withdrawals in the year) "
                "into a child's SSPN national education savings account."
            ),
        },
        {
            "key": "epf_socso",
            "name": "SOCSO / EIS (PERKESO)",
            "cap": 350,
            "text": "Employee contributions to SOCSO and the Employment Insurance System.",
        },
    ],
    "child": [
        {
            "key": "child_under18",
            "name": "Child under 18",
            "cap": 2_000,
            "text": "RM2,000 for each unmarried child aged under 18.",
        },
        {
            "key": "child_edu",
            "name": "Child 18+ in full-time tertiary education",
            "cap": 8_000,
            "text": (
                "RM8,000 for each unmarried child aged 18+ in full-time study at "
                "diploma level or higher in Malaysia, or degree level or higher "
                "outside Malaysia, at a recognised institution. A child aged 18+ in "
                "A-Level / matriculation / foundation / pre-university is RM2,000 "
                "instead."
            ),
        },
        {
            "key": "child_disabled",
            "name": "Disabled child",
            "cap": "RM8,000 base (+ RM8,000 if in higher education)",
            "text": (
                "RM8,000 for each unmarried disabled (OKU) child (base raised from "
                "RM6,000 in Budget 2025, effective YA2025), plus a further RM8,000 "
                "if that child is 18+ and in full-time higher education (diploma or "
                "higher in Malaysia / degree or higher overseas) at a recognised "
                "institution."
            ),
        },
        {
            "key": "child_care",
            "name": "Registered childcare centre / kindergarten",
            "cap": 3_000,
            "text": (
                "Fees to a childcare centre (TASKA) or kindergarten (TADIKA) "
                "registered with the Department of Social Welfare or the Ministry of "
                "Education, for a child aged 6 or below. Claimable by one parent "
                "only."
            ),
        },
        {
            "key": "child_breastfeed",
            "name": "Breastfeeding equipment",
            "cap": 1_000,
            "text": (
                "Breast pump kit and milk collection / storage equipment for your "
                "own use, for a child aged 2 or below. Claimable once every 2 YAs."
            ),
        },
    ],
}

# ---------------------------------------------------------------------------
# Rebates - subtracted from the tax charged, not from chargeable income.
# ---------------------------------------------------------------------------
REBATES = [
    {
        "name": "Individual rebate",
        "amount": 400,
        "text": "RM400 if chargeable income is RM35,000 or less.",
    },
    {
        "name": "Spouse rebate",
        "amount": 400,
        "text": (
            "A further RM400 if chargeable income is RM35,000 or less and you claim "
            "the RM4,000 husband/wife relief."
        ),
    },
    {
        "name": "Zakat / fitrah",
        "amount": None,
        "text": "Rebate equal to the zakat or fitrah paid during the year, capped at the tax charged.",
    },
]

DEDUCTIBILITY_NOTES = [
    "An expense lowers your tax only if it (a) maps to a specific relief above, "
    "(b) is within that relief's cap and any sub-limit, and (c) meets the "
    "conditions (eligible payee and relationship, resident status, timing window, "
    "receipts kept for 7 years).",
    "Reliefs cut chargeable income, not tax. Tax saved is roughly eligible amount "
    "x your marginal rate - e.g. RM1,000 more lifestyle spend at a 19% marginal "
    "rate saves about RM190; in the 0% band it saves nothing.",
    "Spending past a cap, or on something with no matching relief (groceries, "
    "fuel, rent, everyday shopping, travel), gives no tax benefit.",
]

FILING_BASICS = [
    "File online through MyTax / ezHASiL at mytax.hasil.gov.my. Form BE = "
    "resident with employment income and no business income; Form B = resident "
    "with business income.",
    "YA2025 deadlines: 30 April 2026 if you have no business income; 30 June 2026 "
    "if you have business income.",
    "Employer PCB/MTD (Potongan Cukai Bulanan) is monthly withholding against the "
    "year's tax; it can be the final tax if you have only employment income and "
    "elect for it.",
]

# Items still worth a direct LHDN check before relying on them for a filing.
LOW_CONFIDENCE_NOTES = [
    "Disability reliefs use the Budget 2025 amounts (individual RM7,000, spouse "
    "RM6,000, child base RM8,000), stated as effective YA2025 - confirm against the "
    "final Finance Act / LHDN relief list.",
    "The domestic food-waste composting machine relief (RM2,500, once every 3 YAs) "
    "is listed separately from EV charging; confirm the amount and the claim cycle.",
    "Medical relief sub-limits (RM1,000 vaccination / RM1,000 dental / RM1,000 "
    "check-up bundle / RM4,000 child learning-disability) are believed current for "
    "YA2025 - verify the exact figures.",
    "Education-fees upskilling sub-limit (RM2,000 within RM7,000) - verify the amount.",
]


# ---------------------------------------------------------------------------
# Render the compact plain-text block.
# ---------------------------------------------------------------------------
def _fmt_cap(cap) -> str:
    if isinstance(cap, str):
        return cap
    return f"RM{cap:,}"


def _render_rates() -> str:
    lines = [
        "2. RESIDENT INDIVIDUAL TAX RATES - YA2025 (on chargeable income, RM)",
        f"{'Chargeable income band':<24}{'Rate':<6}{'Tax on band':<13}{'Cumulative tax'}",
    ]
    for b in TAX_RATES_YA2025:
        if b["upper"] is None:
            band = f"above {b['lower'] - 1:,}"
            on_band = "-"
            cum = "-"
        else:
            band = f"{b['lower']:,} - {b['upper']:,}"
            on_band = f"{b['tax_on_band']:,}"
            cum = f"{b['cumulative_tax']:,}"
        rate = f"{round(b['rate'] * 100)}%"
        lines.append(f"{band:<24}{rate:<6}{on_band:<13}{cum}")
    lines.append(
        "Your marginal rate is the rate on your top ringgit - roughly what each "
        "extra RM1 of relief saves you."
    )
    return "\n".join(lines)


def _render_reliefs() -> str:
    lines = ["3. PERSONAL RELIEFS - YA2025 (annual caps; keep receipts/documents 7 years)"]
    for group_key, group_label in RELIEF_GROUPS:
        lines.append("")
        lines.append(group_label.upper())
        for item in RELIEFS[group_key]:
            lines.append(f"- {item['name']}: {_fmt_cap(item['cap'])}. {item['text']}")
    return "\n".join(lines)


def _render_rebates() -> str:
    lines = ["5. REBATES (subtracted from the tax charged, not from income)"]
    for r in REBATES:
        lines.append(f"- {r['name']}: {r['text']}")
    return "\n".join(lines)


def _render_prompt() -> str:
    parts = [
        "MALAYSIAN RESIDENT INDIVIDUAL INCOME TAX - QUICK REFERENCE",
        "Year of Assessment 2025 (income earned 1 Jan-31 Dec 2025, filed in 2026).",
        "",
        "DISCLAIMER: " + DISCLAIMER,
        "",
        "1. HOW TAX IS COMPUTED",
        "Chargeable income = total (aggregate) income - approved donations - personal "
        "reliefs and deductions. Tax is charged on chargeable income band by band. "
        "Rebates, PCB/MTD already withheld, and zakat are then subtracted from the "
        "tax charged to get the balance payable or the refund.",
        "",
        _render_rates(),
        "",
        _render_reliefs(),
        "",
        "4. HOW TO THINK ABOUT \"IS THIS DEDUCTIBLE?\"",
        "\n".join(f"- {n}" for n in DEDUCTIBILITY_NOTES),
        "",
        _render_rebates(),
        "",
        "6. FILING",
        "\n".join(f"- {n}" for n in FILING_BASICS),
        "",
        "7. LOWER-CONFIDENCE ITEMS - CONFIRM ON LHDN/HASiL",
        "\n".join(f"- {n}" for n in LOW_CONFIDENCE_NOTES),
    ]
    return "\n".join(parts)


TAX_KB_PROMPT: str = _render_prompt()


# ---------------------------------------------------------------------------
# Cheap "is the user asking about tax?" check.
# ---------------------------------------------------------------------------
# Multi-character, low-ambiguity substrings.
_TAX_SUBSTRINGS = (
    "tax",  # tax, taxes, taxable, taxation, income tax, tax bracket
    "relief",
    "lhdn",
    "hasil",
    "deduct",  # deduct, deductible, deduction
    "chargeable",
    "rebate",
    "e-filing",
    "efiling",
    "e-file",
    "borang",
    "kwsp",
    "sspn",
    "perkeso",
    "zakat",
    "fitrah",
    "bracket",
    "marginal rate",
    "takaful",
    "deferred annuity",
    "year of assessment",
    "assessment year",
    "how much can i claim",
    "how much will i save",
    "how much would i save",
)

# Short tokens that need word boundaries so they don't fire inside other words.
_TAX_WORD_TOKENS = ("epf", "prs", "pcb", "mtd", "eis", "socso")

_TAX_WORD_RE = re.compile(r"\b(" + "|".join(_TAX_WORD_TOKENS) + r")\b")
_YA_YEAR_RE = re.compile(r"\bya\s?20\d{2}\b")

# Everything the check keys off, exposed for reuse/tests.
TAX_RELATED_KEYWORDS = _TAX_SUBSTRINGS + _TAX_WORD_TOKENS


def looks_tax_related(user_text: str) -> bool:
    """Cheap keyword check: does this message look like a Malaysian-tax question?

    Deliberately errs toward precision - a handful of unambiguous terms - so
    non-tax chats don't pay the token cost of prepending the tax reference.
    """
    if not user_text:
        return False
    t = user_text.lower()
    if any(sub in t for sub in _TAX_SUBSTRINGS):
        return True
    if _YA_YEAR_RE.search(t):
        return True
    if _TAX_WORD_RE.search(t):
        return True
    return False
