"""Keyword-based categorisation. Per the feasibility doc: LHDN relief caps
are a static yearly table, so the only job here is picking the right
category — never inventing a relief figure. Swap `categorize()` for an
LLM call later without touching callers; the interface (str -> str) stays
the same.
"""

# Order matters: first match wins, so more specific keywords go first.
CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Medical", ["pharmacy", "guardian", "watsons", "klinik", "clinic", "hospital", "farmasi"]),
    ("Education", ["mphonline", "bookstore", "tuition", "university", "college", "popular book"]),
    ("EPF / Insurance", ["epf", "kwsp", "insurance", "takaful", "great eastern", "prudential", "allianz"]),
    ("Transport", ["grab", "mygrab", "touch n go", "tng", "toll", "petrol", "shell", "petronas", "ekspres", "primax", "ron95", "ron97"]),
    ("Groceries", ["speedmart", "mydin", "tesco", "aeon", "jaya grocer", "lotus", "giant", "grocer"]),
    ("Dining", ["mcdonald", "kfc", "starbucks", "restoran", "restaurant", "cafe", "food", "mamak", "roti canai", "dining hall", "warung"]),
    ("Lifestyle", ["shopee", "lazada", "netflix", "spotify", "apple", "gym"]),
]

RELIEF_CAPS: dict[str, tuple[str, int]] = {
    "Medical": ("Medical relief", 10000),
    "Education": ("Education relief", 7000),
    "Lifestyle": ("Lifestyle relief", 2500),
    "EPF / Insurance": ("EPF/Insurance relief", 4000),
    "Parents' medical": ("Parents' medical relief", 8000),
}


def categorize(vendor: str, description: str = "") -> str:
    haystack = f"{vendor} {description}".lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(kw in haystack for kw in keywords):
            return category
    return "Other"


def relief_tag_for(category: str) -> str | None:
    entry = RELIEF_CAPS.get(category)
    if not entry:
        return None
    name, cap = entry
    return f"{name} — RM{cap:,} cap"
