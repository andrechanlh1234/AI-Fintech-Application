# Pending work on Cukai v3.dc.html (round 2 — large, not yet started)

User's new request, verbatim intent, pick up here once phasing is confirmed via ask_user:

7. Skip behaviour bug: Skip during onboarding must skip only the current step, not jump to the end (obFinish). Fix obStep's Skip button to call obNext-like single-step-forward instead of obFinish, but only for steps where "skip this" makes sense (e.g. txReliefs, source) — login/privacy Skip should probably still mean "skip onboarding entirely" per original intent, needs confirming with user.

New Step 1 — Link Accounts (onboarding): connect bank accounts (Chase, Citi), credit cards, investment/brokerage, crypto wallets (Bitcoin, Ethereum). Needs a picker UI (mock connect, no real OAuth).

New Step 2 — Security (onboarding): add 2FA setup (method TBD: SMS/authenticator/email). NOTE: distinct from the More panel's Face ID (already implemented) — this is account-security during setup, not device unlock. Don't conflate/remove Face ID.

New Step 3 — Privacy & Terms (onboarding): concise privacy/terms page on data handling. NOTE: obIsPrivacy step already exists with 3 bullet points + agreement checkbox (just added) — likely just needs expanding/renaming, not a new step.

New Step 4 — after accounts connected, show Total Net Worth.

2. Manual Financial Setup (alternative to linking): Cash Position, Investments (qty/purchase price/current price, computed gain/loss), Credit Cards (amount owed), Subscriptions (name/amount/frequency/start date/next payment), Other Assets, Other Liabilities. Compute initial Net Worth from these.

3. Budget: convert Budget overview (BUCKETS_DATA section, isFinBudgets) to donut/pie chart for allocation (currently bar-based). Add manual budget entry before account linking. Granular sub-items per category (e.g. Insurance RM1200 → Life/Medical/MRTA/Other) — if a category has many items, use a dedicated pop-up/detail view instead of lengthening the main page.

4. Finance → Subscriptions: new section below Goals. Track recurring subscriptions: name+logo, amount, frequency, renewal date, next payment, monthly/annual total, upcoming renewals list. Setup during onboarding (name/amount/frequency/start date/next payment/payment method/category) — ties into Manual Financial Setup's Subscriptions above (same data, don't duplicate the model).

Scope note: this is a large multi-feature build (onboarding restructure + manual net-worth setup + budget donut + granular budget items + new subscriptions feature). Asked user to prioritize/phase via ask_user before building — check chat for their answers before starting.

---

# Prior pending work on Cukai v3.dc.html (round 1 — DONE)

User requested (paste below is the full spec, not yet implemented — pick up here in a new chat):

1. Security: remove any 2FA setup concept; add a simple "Face ID" row (More panel, replacing/simplifying "Privacy & security") with Face ID toggle + note about device passcode fallback. Keep it lightweight, not a separate flow.
2. Onboarding Privacy/Terms step (obIsPrivacy): add an unchecked checkbox "I agree to the Terms & Conditions and Privacy Policy" with tappable (placeholder) links to each; the Continue button must stay disabled until checked.
3. Tax page: add a "Download Tax Pack" row/card (bottom of Tax page). Tapping it shows a premium paywall state (reuse the sheet-overlay pattern like morePanelOpen) — "Tax Pack" title, description, "Premium Feature" badge, "Upgrade to Premium" button. Consistent with existing "Subscription: Free" tag in More panel. Do not make it freely downloadable.
4. Tax categories overhaul to a 2025 HASiL-style structure (replacing the old flat 5-pillar RELIEF_PILLARS_META/taxPillars model). New 5 GROUPS, each with several named sub-items (own cap, own captured amount, own receipts):
   - Individual: Individual & Dependent Relatives (9000), Disabled Individual (6000), Education Fees (7000), Skills Enhancement/Personal Development (2000), Interest on Housing Loan – First Home (7000), Husband/Wife/Alimony (4000), Disabled Husband/Wife (5000)
   - Medical & Special Needs: Self/Spouse/Child Medical (10000), Parents & Grandparents Medical (8000), Disabled Individual Support Equipment (6000)
   - Lifestyle: Lifestyle (2500), Additional Lifestyle Relief (1000), EV Charging Equipment/Domestic Food Waste Composting Machine (2500)
   - EPF & Life Insurance (renamed from "EPF & Insurance"): Life Insurance & EPF (7000), Education & Medical Insurance (3000), PRS/Deferred Annuity (3000), SSPN (8000), SOCSO (350)
   - Child Relief: Child below 18 (2000), Child 18+ in Education (8000), Unmarried Child with Disabilities (8000), Registered Childcare/Kindergarten (3000), Breastfeeding Equipment (1000)
   Each item: captured/cap/%/remaining/potential benefit (24% assumed rate, already established pattern), status tag (Automatic for indiv_self / Optimised ≥85% / In progress / Available), drill-down to receipts + a synthetic "Other eligible expenses" line reconciling captured vs listed receipts (per user's own example format). Group cards (accordion, like existing Budget bucket pattern) expand to show their items; each item expands to show its receipts. Donut + legend at top should aggregate to the 5 GROUP level (tap group row shows amount/cap%). Keep Tax Optimisation summary (captured/available/estimated benefit) working off the new totals. Keep charts borderless, embedded in page, not cards (existing pattern). Keep the existing tax disclaimer language (guidance tool, verify with HASiL/qualified professional; don't imply spending money just to get relief).
5. Icons: map by GROUP (not per item) reusing existing icon flag pattern (isBook/isMedical/isShield/isUsers + add a person icon for "Individual") to avoid needing 23 unique icons.
6. RELIEF_INFO / CATEGORY_OPTIONS (used in the Scan-confirm "why deductible" flow) are UNRELATED to this — do not touch them.

Plan already fully worked out in chat (data model, computed fields, template structure for nested accordion) — just needs to be written into the file. Start by re-reading the current isTax block, TAX_DATA, RELIEF_PILLARS_META, and the More panel's "Privacy & security" row before editing.
