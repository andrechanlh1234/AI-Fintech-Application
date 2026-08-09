from pipeline.categorize import categorize, relief_tag_for


def test_categorize_known_vendors():
    assert categorize("Guardian Pharmacy") == "Medical"
    assert categorize("Grab") == "Transport"
    assert categorize("Shopee MarketPlace") == "Lifestyle"


def test_categorize_unknown_vendor_falls_back_to_other():
    assert categorize("Some Random Merchant Sdn Bhd") == "Other"


def test_relief_tag_for_unmapped_category_is_none():
    assert relief_tag_for("Transport") is None
    assert relief_tag_for("Medical") == "Medical relief — RM10,000 cap"
