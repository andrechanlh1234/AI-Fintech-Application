# Cukai v7 — Competitive Benchmark & UX / Architecture Review

Date: 2026-08-28
Method: full walkthrough of the running app (`app/` on `localhost:5173`, guest mode, ~390 px mobile viewport) covering onboarding, Home, Finance (Net worth / Budgets / Record / Stats + drill‑down), Tax Center (relief groups, item detail, YA toggle, Tax Pack), AI chat + history, receipt/manual‑expense flow, Settings; plus source review of `app/src/lib/`, `app/src/store/`, and `backend/`. Benchmarked against YNAB, Copilot Money, Monarch Money, Rocket Money, Emma (PFM) and LHDN MyTax / e‑Filing and TurboTax (tax UX).

This report is **design / UX / architecture direction**. Individual defects are already catalogued in `docs/bug-report.md` (26 findings); where a bug is symptomatic of a structural problem it is referenced here (e.g. "cf. bug M2") but not re‑litigated.

---

## 1. Summary verdict

Cukai v7 is a genuinely functional, well‑structured prototype that already clears the bar for "looks like a real fintech app." The visual language is calm and consistent (one green accent, one tax accent, card layout, a small reused chart set), the core loop the product brief describes — see finances → capture an expense → watch it become a tax deduction — is wired end to end, and the tax domain model (`app/src/lib/taxEngine.ts`) is more serious than anything the mainstream PFM apps attempt. The AI assistant, when its Gemini backend is reachable, answered a budget question with correct figures drawn from live state ("You have spent RM 2,494 against a planned budget of RM 2,100… Food & Drink… exceeding its RM 600 cap"). That is ahead of where most competitors' AI sat two years ago and on par with Monarch's 2026 assistant in kind, if not in polish.

Where Cukai stands **behind the field** is trust calibration and information consistency — the two things a money app cannot get wrong. A brand‑new account with RM 0 in it still shows five fabricated notifications with specific ringgit amounts ("Lifestyle relief 87 % used — RM 320 … left", "Invoice detected from Gmail — Astro Invoice RM 240.00"), a hardcoded AI chat history that contradicts the real data, and an onboarding trust screen promising "bank‑level 256‑bit encryption on everything you connect" over a backend that stores an un‑validated plaintext JSON blob. "Spend this month" resolves to three different numbers on three screens (RM 2,494 on Budgets, RM 7,147 on Stats, −RM 1,346.90 on Record) because each screen derives spend from a different synthetic dataset. The tax engine counts claims **past their statutory cap** into headline totals (Lifestyle shows "RM 3,950 / RM 2,500 cap" inside a group that reads "66 % complete"), and maps whole spend categories (`Bills`, `Shopping`) onto LHDN Lifestyle relief when most of those line items — electricity, water, pay‑TV, general apparel — do not qualify. For a product whose differentiator is *tax correctness*, these are existential rather than cosmetic.

The onboarding is also longer and more extractive than any competitor's: 11 numbered steps (the counter is wrong — it jumps "9 of 10" → "10 of 11"), opening with an internal "Are you a developer or a customer?" screen, a marketing "How did you hear about us?" question before any value is shown, a US‑bank account‑linking mock (Chase, Citi, "Chase Freedom Visa") in a Malaysia‑only product, and duplicate disability/housing‑loan questions. Monarch, Copilot and Rocket Money all defer nearly everything to after the first dashboard render. **Net:** strong bones, a real tax engine, a real AI — held back by fabricated data presented as the user's own, cross‑screen numeric inconsistency, an over‑broad relief mapping, and a heavy onboarding. Fixing the trust and consistency issues is worth more than any new feature.

---

## 2. Competitive comparison table

Scale: ✅ competitive / at parity · ⚠️ partial or flawed · ❌ missing or counter‑productive.

| Dimension | YNAB | Copilot | Monarch | Rocket Money | Emma | LHDN MyTax / TurboTax | **Cukai v7** | Where Cukai wins / loses |
|---|---|---|---|---|---|---|---|---|
| Onboarding friction | ⚠️ heavy teaching | ✅ light, iOS‑fast | ✅ dashboard‑first | ✅ light | ✅ light | ⚠️ PIN/cert (LHDN); ✅ interview (TT) | ❌ 11 steps, dev/marketing prompts, wrong counter | **Loses** — most extractive onboarding of the set; asks internal + marketing questions before any value |
| Dashboard info hierarchy | ⚠️ budget‑only | ✅ | ✅ net‑worth‑first, widgets | ✅ | ✅ | n/a | ⚠️ net‑worth hero good; no cash / income‑vs‑spend / investments tiles; weak empty state | **Loses** vs Monarch — dashboard is thinner than the brief specifies |
| Transaction entry & categorization | ⚠️ manual‑ish | ✅ ML that learns + rules | ✅ trustworthy auto + swipe review | ✅ | ✅ | ✅ EA import (LHDN); ✅ photo import (TT) | ⚠️ manual entry is clean + contextual tax hint; no learning, no bulk edit, swipe‑review only for imported items | **Loses** on automation; **wins** on the inline "why isn't this deductible" hint at entry time |
| Budgeting model | ✅ zero‑based (category) | ⚠️ light | ✅ flex **and** category on shared data | ⚠️ light | ⚠️ light | n/a | ⚠️ 4 fixed buckets (Fixed/Flexible/Goals/Insurance); no flex‑vs‑detailed toggle; caps unvalidated (cf. M3) | **Loses** vs Monarch's dual‑mode; bucket model is rigid and un‑renameable |
| Data visualization | ⚠️ sparse | ✅ best‑in‑class | ✅ consistent small set | ⚠️ | ✅ | ⚠️ | ⚠️ one line + one half‑donut, reused well; donut has 12+ unlabeled slices; empty chart still occupies full height | **Wins** on restraint; **loses** on donut legibility and empty states |
| Tax / deduction tracking UX | ❌ none | ❌ none | ❌ none | ❌ none | ❌ none | ✅ tooltips, cap shown, auto‑calc (LHDN); ✅ deduction finder (TT) | ⚠️ dedicated Tax Center, YTD hero, per‑group progress, receipt vault, "filed — year closed" state — but over‑cap overflow + over‑broad category→relief map + double‑counted RM 9,000 (cf. M1/M2) | **Wins** the category outright vs PFM apps; **loses** vs LHDN on correctness (LHDN at least shows the cap and never counts past it) |
| AI assistant usefulness | ❌ | ⚠️ category assistant | ✅ genuinely useful, weekly recaps | ❌ | ⚠️ gimmicky | n/a | ⚠️ real Gemini answer was accurate & grounded; but ~20 s latency, no streaming/stop, fake chat history, canned fallback invents figures (cf. H3/H4), no proactive summaries | **At parity in kind** with Monarch; **loses** on latency, reliability, and the fabricated history/fallback |
| Trust & security signaling | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (govt) | ❌ claims ("bank‑level encryption", "disconnect any account in one tap") not backed by implementation; fabricated notifications & AI history; seed identity leaks | **Loses badly** — over‑claims plus fake data is the worst combination for a finance app |
| Empty states | ✅ instructional | ✅ | ✅ | ✅ | ✅ | n/a | ❌ fresh Home: empty chart at full height, "Recent activity → See all" with nothing, no CTA; fresh Tax Center has no "scan your first receipt" nudge | **Loses** — no guided first‑run |
| Accessibility | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ good text contrast & tap targets; but colour‑only status, tiny unlabeled donut slices, unlabeled date inputs, `href="#"` consent links, theme not re‑applied to open sheets (cf. L7) | roughly mid‑pack; not audited |
| Platform reach | web + mobile | iOS (+Android beta) | web + mobile | mobile | mobile | web | responsive web PWA only; no native, no real hosting | behind on distribution (known gap) |
| Collaboration / household | ❌ | ❌ | ✅ | ❌ | ⚠️ | n/a | ❌ | out of V1 scope — fine |

---

## 3. UI / UX findings (screen by screen)

Priority key: **P0** ship‑blocker for trust/usability · **P1** important, schedule soon · **P2** polish.

### 3.1 Onboarding (`app/src/screens/onboarding/OnboardingFlow.tsx`, `app/src/screens/auth/*`)

| # | Observation (what I saw) | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| OB‑1 | First screen of a fresh install is **"Are you a developer or a customer?"** with "Developer mode unlocks a Skip link… change this later in More > Settings." | Exposes an internal build toggle as the user's first impression; no real user should see this. | Default to customer; gate developer mode behind a hidden gesture or `?dev=1`, or a build‑time flag. Remove from the user‑facing flow entirely. | **P0** |
| OB‑2 | Step 2 of 10 is **"How did you hear about us?"** (Friend/TikTok/Instagram/…), before any value is delivered. | Marketing attribution up‑front is the highest‑friction possible placement; competitors ask this (if at all) after first success. | Move to a dismissible card on Home after day 1, or to Settings. Not in the critical path. | **P1** |
| OB‑3 | Step counter shows "Step 2 of 10" … "Step 9 of 10" then **"Step 10 of 11" / "Step 11 of 11"** once the manual branch is taken (cf. bug M11). `OB_ORDER` has 13 entries. | A progress indicator that visibly lies undermines confidence in the whole flow. | Compute the denominator from the chosen branch's actual remaining path, or drop the count and use a segmented progress bar. | **P1** |
| OB‑4 | Step 3 "Your data stays private" asserts **"Bank‑level 256‑bit encryption on everything you connect and scan"** and **"disconnect any account, anytime, in one tap."** Backend (`backend/main.py` `put_state`) stores an unvalidated plaintext JSON blob; there is no account linking to disconnect. | Security over‑claims in onboarding are a legal and trust liability, especially in a PDPA context. | Only claim what is true today (transport TLS, local‑first storage, no ad resale). Add real at‑rest encryption before making the stronger claim. | **P0** |
| OB‑5 | Consent step: "I agree to the **Terms & Conditions** and **Privacy Policy**" are `<a href="#">` (cf. bug L1) — the real `LegalModal` exists but isn't wired here. | Users must consent to documents they cannot open. | Wire `actions.openLegal('terms' | 'privacy')` into these links. | **P0** |
| OB‑6 | Step 9 "Connect your accounts" lists **Chase, Citi, Chase Freedom Visa, Citi Double Cash, Brokerage, Bitcoin/Ethereum Wallet** with "Connect" (a 900 ms fake) (cf. bug L10). | US banks in a Malaysia‑only tax product break the illusion immediately and feed the false "6 accounts connected" count in Settings (bug M9). | Until a real aggregator/CSV path exists, replace with Malaysian institutions and a **CSV/PDF statement import** entry point (the parser in `pipeline/statement_parser.py` already handles CIMB/TNG/Maybank) or make manual entry the primary path and label linking "Coming soon." | **P1** |
| OB‑7 | Personal + tax profile are one long scrolling step (Name, DOB, Country, Occupation, **Monthly income** band defaulting to "Below RM 500", then residency/marital/dependants/employment). Disability + housing‑loan are then **asked again** as a separate step. | The income band silently defaults to the lowest bracket and drives the entire tax‑bracket engine; duplicated questions read as a broken flow. | Split into short single‑purpose steps; make income a required choice with no default; ask disability/housing once. Consider TurboTax‑style one‑question‑per‑screen for the tax portion. | **P1** |
| OB‑8 | Step 10 "Enter your finances": the Investments section renders **three blank Qty/Buy/Current rows by default**, while every other section uses a "+ Add" link. Scientific notation and blank buy‑price accepted (cf. bug L5). | Visual clutter and inconsistency; invites malformed numeric input. | Match the "+ Add investment" pattern; add one row on demand; sanitize numeric fields. | **P2** |
| OB‑9 | "Monthly savings target (optional)" (step 7) accepts arbitrary text and is then **read nowhere** (cf. bug L6). | Dead input erodes the sense that answers matter. | Either use it (seed a Goals bucket) or remove it. | **P2** |
| OB‑10 | Subscriptions step has **two unlabeled `dd/mm/yyyy` date fields** side by side. | User can't tell "started" from "next renewal." | Label both; default "next payment" from start + frequency (the reducer already computes this — surface it). | **P2** |
| OB‑11 | On finishing onboarding after adding a blank manual account, a stray balance‑detail sheet renders over Home (cf. bug H1). | First screen after onboarding is broken. | `OB_FINISH` must clear `balanceDetailOpen` / `investDetailOpen` / `historyOpen` / `txDetailOpen`, not just `budgetItemDetailOpen`. | **P0** |

### 3.2 Home dashboard (`app/src/screens/Home.tsx`, `selectHomeDashboard` in `app/src/store/selectors.ts`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| HM‑1 | Fresh Home is nearly empty: net‑worth hero "RM 0", an **empty chart region at full height** with a single dot, "MONTHLY BUDGET RM 0 / RM 1,500", "Recent activity → See all" with **no rows and no message or CTA**. | First‑run gives no guidance; competitors all use the empty state to teach the core loop. | Collapse the empty chart; replace "Recent activity" void with an onboarding checklist card ("Add an account", "Scan a receipt", "Set a budget") that disappears as each is done. | **P1** |
| HM‑2 | Populated Home has only: AI bar, Net worth + sparkline, Monthly budget bar, "N items to review", Recent activity (3). The product brief calls for **cash across accounts, income‑vs‑spending this month, an investments summary card, and a distinct AI insight callout** — none are present. `selectHomeDashboard` computes an `insight` object that the screen doesn't render prominently. | Dashboard is thinner than spec and thinner than Monarch; the "insight" the code builds is wasted. | Add a compact cash tile, an income‑vs‑expense tile (data already in `MONTH_SUMMARIES` / transactions), an investments tile, and render the `insight` as its own card. | **P1** |
| HM‑3 | "Monthly budget" over‑budget state on Home shows "RM 2,494 / RM 2,100 · **RM 394 over**" (good), but Budgets gauge for the same state shows a huge **"RM 0 left this month"** with a small "119%" badge. | Same metric, two contradictory presentations. | Standardise: when over, the big number is the overage in red on both surfaces. | **P1** |
| HM‑4 | Bell icon always shows an unread dot; opening it on a **zero‑data account** shows 5 fabricated notifications with hard figures (cf. bug M8). | Fabricated financial events in a finance app is a P0 trust failure. | Derive notifications from real state (budget thresholds crossed, relief cap nearing, receipt saved); ship an empty state; `hasUnreadNotifs` from real unread count. | **P0** |
| HM‑5 | "Recent activity" mixes real transactions with **synthetic rows derived from budget line items** (`budgetDerivedTx` in `selectHomeDashboard`), e.g. a "Rent — Fixed budget" row that is a plan entry, not a logged payment. | User can't distinguish what happened from what's planned; this synthetic set also pollutes Record and Stats (see LA‑2). | Show only real transactions in "Recent activity"; if you want recurring/planned items, label them visually as "scheduled." | **P1** |

### 3.3 Finance — Net worth (`app/src/screens/finance/NetWorthSection.tsx`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| NW‑1 | Range chips 1M/3M/6M/1Y/3Y/ALL are all shown even when the account has a **single real data point** (`computeNetWorthTimeline` collapses to one point for a new user). Selecting 1Y then renders a flat/synthetic‑looking line. | Implies history that doesn't exist. | Disable/hide ranges with no data; show "Add dated balances to see a trend" until ≥ 2 points exist. | **P2** |
| NW‑2 | Group rows say "Manual · tap for details" and "Synced · tap to edit" — but nothing is actually synced (no linking). | Copy describes a capability that isn't there. | Use "Manual" / "Imported" and drop "Synced" until real sync exists. | **P2** |
| NW‑3 | The invariant "net worth must never move when a transaction is reclassified" holds (verified in code and in `selectors.test.ts`) — **this is a real strength**; call it out in product copy as a trust feature. | Positive. | Keep; consider surfacing "balances and spending are tracked separately" as a one‑liner. | — |

### 3.4 Finance — Budgets (`app/src/screens/finance/BudgetsSection.tsx`, `BudgetGauge.tsx`, `selectBudgets`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| BG‑1 | Only four hardcoded buckets (Fixed / Flexible / Goals / Insurance); categories can be added but buckets can't be renamed, reordered, or switched between flex and detailed modes. | Monarch's single best idea — "simple buckets for beginners, category detail for power users, same data" — is name‑checked in the design brief but not implemented. | Add a "Simple / Detailed" toggle on the Budgets header that re‑groups the same categories; allow custom bucket names. | **P1** |
| BG‑2 | "Monthly cap (RM)" accepts `-5000` (confirmed live) and any magnitude (cf. bug M3); poisons Home and Budgets totals. | No numeric validation anywhere in the entry path. | See LA‑1 (shared input‑sanitization layer). | **P0** |
| BG‑3 | Half‑donut gauge shows "RM 0 left this month" as the dominant number when the user is RM 394 over. | Hides overspend behind a floored value. | Show the real signed remaining/overage as the headline. | **P1** |
| BG‑4 | Gauge category callouts (`donutBranches`) are geometry‑heavy and, with 5 labels crammed on a 180° arc, overlap on a 390 px screen. | Legibility on the target device. | Prefer a simple ranked bar list under the gauge over radial callouts on mobile. | **P2** |

### 3.5 Finance — Record (`app/src/screens/finance/RecordSection.tsx`, `selectRecordPage`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| RC‑1 | Header is "**< All transactions**" with a back chevron — inside a primary tab section, there's nowhere to go back to. | Confusing affordance; looks like a sub‑page that isn't. | Drop the chevron; make it a section title, or make Record a true stack with Stats. | **P2** |
| RC‑2 | Default date range is `todayIso()`‑bounded and computed in **UTC** while the rest of the app is local (cf. bug M10) — before 08:00 MYT a transaction the user just added and dated "today" can fall outside the default window. | Users will report "my transaction disappeared." | Derive all "today" boundaries from local date components consistently. | **P1** |
| RC‑3 | No swipe‑to‑categorize / bulk‑select on the real transaction list; swipe review exists only for imported statement items (`ReviewFlow.tsx`). | The design brief explicitly wants Monarch‑style swipe‑to‑confirm as the interaction that makes the app feel "intelligent." | Bring swipe‑to‑recategorize and multi‑select to the main Record list. | **P1** |
| RC‑4 | Date `<input type="date">` accepts a 5‑digit year (`12027`), silently falling back to the current year on save (cf. bug L4). | Silent data corruption. | Clamp/validate year range on save. | **P2** |

### 3.6 Finance — Stats + drill‑down (`app/src/screens/finance/StatsSection.tsx`, `selectStatsPage`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| ST‑1 | "Spend by category — This month" totals **RM 7,147**, while Budgets says spent **RM 2,494** and Record (30 Jul–28 Aug) nets **−RM 1,346.90**. Each screen uses a different dataset (Stats & Record include `budgetDerivedTx`; Budgets counts only category‑name matches; Record includes income). | A money app that reports three different "how much did I spend" numbers loses credibility instantly. | Define one canonical `spendThisMonth` selector over real transactions only and reuse it everywhere; if planned/recurring items are shown, total them separately and label them. | **P0** |
| ST‑2 | The category drill‑down (e.g. "Bills — This month · RM 2,263") lists a **"Rent · Recurring · Fixed budget" −RM 1,500** row — a budget plan entry rendered as a spent transaction. | Same synthetic‑data leak as HM‑5; here it inflates a category total by 66 %. | Exclude `budgetDerivedTx` from Stats. | **P0** |
| ST‑3 | Drill‑down view scrolls into a large blank void below the last row (no bottom padding / min‑height leftover). | Looks broken. | Fix the container height / add safe‑area bottom padding. | **P2** |
| ST‑4 | Donut has 12+ slices with no labels or legend; the list below is the only key. | Not readable as a chart; fails the brief's "consistent, simple chart language." | Cap at top 5 + "Other"; add inline legend or leader labels; keep the list. | **P1** |

### 3.7 Tax Center (`app/src/screens/tax/*`, `selectTaxCenter`, `app/src/lib/taxEngine.ts`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| TX‑1 | Lifestyle group card: "**RM 3,950 / RM 6,000 · 66 % Complete · RM 2,050 remaining**"; expanding it, the *Lifestyle* item reads "**RM 3,950 / RM 2,500 · 158 % Complete**". The RM 1,450 over‑cap flows into the group total, the "RM 15,628 claimed" headline, and the "41 % optimisation" figure (cf. bug M2). | The single most important number in the product — deductible total — is inflated by claims that LHDN will not allow. | Clamp every item's contribution to `min(captured, cap)` before summing into group/total/optimisation. Keep the raw figure only for the per‑item "you've exceeded this" badge. | **P0** |
| TX‑2 | Item detail sheet for an over‑cap item says "**Optimised**" and "**RM 0 remaining**" while the group card says "158 %". All ~20 receipts are listed flat with **no indication which fall outside the claimable cap**. | Directly misleads a user preparing a real filing; LHDN's own form shows the cap and never counts past it. | In the detail sheet, show "RM 2,500 of RM 3,950 is claimable; RM 1,450 exceeds the cap" and visually separate the over‑cap receipts. | **P0** |
| TX‑3 | `CATEGORY_TO_RELIEF_KEY` maps `Bills → life_general` and `Shopping → life_general` wholesale. The Lifestyle receipt list is full of **TNB Electricity, Indah Water, Astro, Maxis Postpaid, H&M, Uniqlo, Zalora** — utilities, pay‑TV and general apparel that are **not** LHDN Lifestyle‑relief eligible (only internet subscription, books, PC/phone/tablet, sports/gym qualify). | Systematically overstates the user's deductible position; the product's core promise is that it gets this right. | Move relief mapping from *category* to *merchant + line‑item keyword* rules with an explicit allow‑list; default ambiguous items to "not deductible — tap to confirm" (the manual‑entry screen already does this well). Show the `RELIEF_INFO.why` text on every auto‑tag. | **P0** |
| TX‑4 | `chargeableIncomeEst = grossAnnualIncome − 9000 − rawTaxModel.totalCaptured`, but `totalCaptured` already includes the automatic RM 9,000 `indiv_self` relief — so RM 9,000 is subtracted twice (cf. bug M1), understating chargeable income, sometimes dropping a bracket, and skewing every "Save ~RM x" figure. | Wrong bracket → wrong savings estimates everywhere in the tax UI. | Subtract either the literal 9,000 **or** `totalCaptured`, not both. Add a unit test asserting `chargeableIncome + totalReliefs + 9000 === gross` for a no‑receipts profile. | **P0** |
| TX‑5 | Optimisation denominator is the **sum of every cap in every group** ("RM 38,350"), including mutually exclusive reliefs (e.g. both "Disabled Individual" and regular; full RM 13,350 EPF group) that no single filer could ever claim. "41 % optimised" is measured against an unreachable ceiling. | The headline progress metric is structurally un‑hittable, so it always reads "you're behind." | Compute an *achievable* cap from the user's tax profile (drop mutually exclusive items, drop groups with no eligibility) and measure against that. | **P1** |
| TX‑6 | YA selector offers **2024–2028**; 2027/2028 have no relief rules and `prevTaxYear` math still runs (cf. bug L2). Prefix is inconsistent ("2026" in the picker, "YA2025" in Settings). | Future years produce meaningless numbers; inconsistent labels. | Cap at current YA (optionally current+1 when rules are published); use "YA2026" consistently. | **P2** |
| TX‑7 | On a closed year the card correctly shows "**Filed — year closed**" (nice) but still shows "**Save ~RM 2,229 more**". | Contradictory — you can't claim more on a filed year. | Suppress the savings CTA and the optimisation nudge for closed years; switch to a read‑only summary. | **P1** |
| TX‑8 | Disclaimer copy: "estimated at your 11 % bracket **based on your income**" even when income was left at the default band; with blank income it falls back to `ASSUMED_TAX_RATE` (0.24) but still says "based on your income" (cf. bug L3). | Presents an assumption as personalised fact. | Reword to "estimated at an assumed 24 % rate — add your income for a personalised estimate" when income is unknown. | **P2** |
| TX‑9 | Every relief figure carries the right hedge ("not guaranteed; verify with HASiL or a qualified tax professional") and the code comments are refreshingly honest about which caps are unverified. **Keep this discipline** — it's a genuine trust asset if the numbers behind it are made correct. | Positive. | Keep; add a visible "last reviewed against LHDN: <date>" stamp per YA. | — |

### 3.8 AI assistant (`app/src/screens/ai/AiChat.tsx`, `submitAiText` in `StoreProvider.tsx`, `aiCraftReply` in `seedData.ts`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| AI‑1 | "Am I on track with my budget this month?" → after **~20 s** of a bare "…" indicator, a correct, data‑grounded answer ("spent RM 2,494 against a planned budget of RM 2,100 … Food & Drink … exceeding its RM 600 cap"). | The answer quality is genuinely competitive; the wait with no streaming, no progress, and no cancel is not. `request()` in `api.ts` has **no timeout / AbortController**. | Stream tokens; add a stop button; add a client timeout with graceful fallback; show "Reading your accounts…" instead of a lone ellipsis. | **P1** |
| AI‑2 | AI history panel shows 3 **hardcoded** past conversations (`AI_CHAT_HISTORY`) with figures that contradict live data ("You're RM 540 under budget" vs the real "RM 394 over"); the conversation I just completed was **not** added to history. | Fake history in a finance assistant is a trust problem and makes the feature feel non‑functional. | Persist real conversations; ship an empty "No past chats yet" state. | **P0** |
| AI‑3 | When the backend is unreachable, `aiCraftReply()` returns hardcoded strings with **specific invented ringgit amounts** ("You've spent RM 6,960 of your RM 8,500 budget…") regardless of real state (cf. bug H3). | Confidently wrong numbers in a tax/finance app. | Make the fallback figure‑free ("I can't reach the assistant right now — check Budgets for your current position"), or feed it `selectAiContext`. | **P0** |
| AI‑4 | `useActions()` is memoized on `[state.ob.linkedIds]`, which never changes for a manual‑setup user, so `submitAiText` permanently closes over the **first render's** empty `state` — history and `selectAiContext` sent to the backend are frozen empty (cf. bug H4). Multi‑turn continuity and grounding silently don't work even when Gemini is configured. | The grounded answer I got may have come via the backend re‑deriving context server‑side; regardless, the client contract is broken. | Depend on `[state]` (these callbacks are cheap) or route state through a ref. | **P0** |
| AI‑5 | AI is a pull‑only chatbot. The design brief explicitly wants "AI as a passive summarizer surfaced contextually" (weekly recap, spending trend callouts), not a bolted‑on chat. Monarch's 2026 recaps are the reference. | Missing the higher‑value, lower‑effort AI surface. | Add a weekly summary card on Home and a "what changed" line on Tax Center, generated from `selectAiContext`. | **P1** |

### 3.9 Receipt / manual‑expense flow (`app/src/screens/modals/scan/*`, `ReviewFlow.tsx`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| SC‑1 | Capture screen ("Add expense", framing brackets, "Align the receipt within the frame") shows **no live camera preview** in the web build — just a dark rectangle — and no sample/hint. | This is the product's hero action per the brief; the capture moment should feel great. | For web/PWA, wire `getUserMedia` preview or lead with the file/gallery picker; add an example receipt overlay. | **P1** |
| SC‑2 | Manual "Enter expense details" is strong: live amount, quick‑name chips, category picker, and a contextual **"Not tax deductible — Food & Drink doesn't have a matching LHDN relief category"** card with a Yes/No override. This is the best‑designed screen in the app. | Positive — this is exactly the "connect the two systems" moment the brief wants. | Keep; reuse this inline‑relief‑explainer pattern on the transaction detail modal and on auto‑tagged rows in Record. | — |
| SC‑3 | "Save receipt" appears enabled with RM 0.00 and no name. | Lets a null record through (validated on tap, but the affordance is misleading). | Disable until amount > 0 and name present; inline field errors. | **P2** |
| SC‑4 | The scan→saved success moment ("Added to your 2026 deductions", prompt back to Tax Center) is specified in the brief as "a satisfying scan‑to‑saved moment" — verify it fires a live relief‑impact preview ("+RM 92 toward Lifestyle, RM X of cap left"). | The payoff that makes the loop feel magic. | Ensure `selectReliefImpact` preview shows on the confirm step and the success screen. | **P1** |

### 3.10 Settings / "More" panel (`app/src/screens/modals/MorePanel.tsx`, `TaxProfileModal.tsx`)

| # | Observation | Why it matters | Recommended fix | Priority |
|---|---|---|---|---|
| SE‑1 | For a not‑signed‑in guest the profile card shows a real‑looking name/email ("Andre Test / andre@gmail.com", or the seed "Aina Natasha" placeholder) directly above "Not signed in — data stays on this device" (cf. bug M9). | Presents identity the user never entered. | Show "Guest" + an explicit "Create an account to sync" CTA; never render a placeholder identity. | **P1** |
| SE‑2 | "Linked accounts — **6 accounts connected**" after linking zero (count comes from the `LINK_TARGETS` mock); "Tax profile — Resident · Single · YA2025" shown though residency/marital were never chosen (cf. bug M9). | Fabricated account counts + unset fields shown as chosen. | Count only real accounts; show "Not set" for unset profile fields. | **P1** |
| SE‑3 | Section header "**SECURITY & SUPPORT**" contains Appearance (light/dark), Face ID, and Help. | Appearance isn't security; mis‑grouping. | Split into "Appearance", "Security", "Support". | **P2** |
| SE‑4 | Settings is a partial bottom sheet you scroll through; the brief calls for "More / Settings" as its own simple screen. Toggling Dark while a sheet is open doesn't restyle that sheet (cf. bug L7). | Cramped; theme bug. | Make Settings a full route; ensure sheets read theme tokens live from `:root`. | **P2** |
| SE‑5 | Tax‑profile modal (residency / marital / dependants / employment / disability / housing‑loan as chip groups) is clean and well‑structured. | Positive. | Keep; add the income band here too so it's editable post‑onboarding (currently only set in onboarding). | **P2** |

---

## 4. Logic & architecture findings

Priority key as above.

### LA‑1 — No input‑validation / sanitization layer; reducers trust raw strings

**Observation.** `app/src/store/reducer.ts` action handlers write user input verbatim: `ADD_BUCKET_CATEGORY` / `SET_BUCKET_CATEGORY_CAP` accept negative and unbounded caps (confirmed live: `-5000`); `ADD_SUBSCRIPTION` only checks `!d.name || !d.amount`, so `-50` is stored and then *subtracts* from monthly totals while `money()`'s `Math.abs` hides the sign (bug M4); investment rows accept `1e6` and scientific notation (bug L5); date inputs accept 5‑digit years (bug L4). `money()` returns the literal `"NaN"` for `NaN` input with no guard.
**Why it matters.** Every downstream selector (`selectBudgets`, `selectNetWorth`, `selectSubscriptions`, `selectTaxCenter`) assumes clean numbers. One bad field poisons Home, Budgets, Stats and the tax estimate at once. This is a class of bug, not four bugs.
**Recommendation.** Introduce a single `sanitizeMoney(raw, {min, max})` / `sanitizeInt` / `sanitizeDate` helper in `app/src/lib/` and route **all** numeric/date writes through it inside the reducer (not just the inputs). Add `min`/`step`/`inputmode` to the fields as a second line of defence. Add reducer unit tests for negative/huge/NaN/scientific inputs.
**Priority: P0.**

### LA‑2 — "Spend" is derived from three different synthetic datasets

**Observation.** `selectHomeDashboard` builds `budgetDerivedTx` (one synthetic transaction per budget line item) and `combinedTx = transactions.concat(budgetDerivedTx)`. `selectRecordPage` and `selectStatsPage` both consume `combinedTx`; `selectBudgets` counts only transactions whose `cat` matches a budget category name, plus manual line items. Result: Budgets "spent" RM 2,494, Stats "spent" RM 7,147, Record range net −RM 1,346.90 — for the same month, same data.
**Why it matters.** There is no single source of truth for the product's second‑most‑important number. Users will not trust an app whose screens disagree with each other.
**Recommendation.** Define one canonical `selectMonthlySpend(state, {month, year})` over **real transactions only** and reuse it in Home, Budgets, Stats. If planned/recurring spend is a feature, model it as a first‑class `RecurringItem[]` with its own total and its own visual treatment — never merged into the transaction stream. Remove `budgetDerivedTx` from Record and Stats entirely.
**Priority: P0.**

### LA‑3 — Tax engine: over‑cap overflow, category‑level relief mapping, double‑counted base relief

**Observation.** In `buildTaxModel` (`taxEngine.ts`) item `captured` is never clamped to `cap` before being summed into `group.captured` and `totalCaptured` (bug M2 — confirmed live: Lifestyle group "RM 3,950 / RM 6,000" containing a "RM 3,950 / RM 2,500" item). `CATEGORY_TO_RELIEF_KEY` maps entire spend categories (`Bills`, `Shopping`) to `life_general`, sweeping in ineligible utilities/apparel. `selectTaxCenter` subtracts RM 9,000 twice (bug M1). The "optimisation" denominator is the sum of all caps including mutually exclusive ones (TX‑5).
**Why it matters.** These compound: an inflated `totalCaptured` feeds an already‑wrong `chargeableIncomeEst`, which picks a wrong `marginalRate`, which scales every `potentialBenefit`. The product's entire reason to exist is being more correct about tax than a spreadsheet.
**Recommendation.**
1. Clamp per item: `groupCaptured += min(item.captured, item.cap)`; keep raw only for the "over cap" badge.
2. Replace category→relief mapping with merchant/keyword allow‑list rules; default unknowns to untagged and prompt the user (reuse the manual‑entry pattern from SC‑2).
3. Fix the RM 9,000 double‑count; add the invariant test in TX‑4.
4. Compute an eligibility‑aware achievable cap for the optimisation %.
5. Externalise `TAX_ITEMS_META` caps into a per‑YA data file with a "last verified" date, so a yearly LHDN update is a data change, not a code change.
**Priority: P0.**

### LA‑4 — Single‑JSON‑blob sync: last‑write‑wins, no version, no validation, no per‑account namespacing

**Observation.** `backend/main.py` `PUT /state` does `json.dumps(body.state)` straight into `user_state.state_json` — `body.state: dict | None`, no schema, no size/depth cap (bug M7). No `updated_at`/version guard, so it's unconditional last‑write‑wins. `StoreProvider.tsx` restores a session by dispatching `SET_AUTH_USER` then `await fetchRemoteState()`, while a separate 800 ms‑debounced effect keyed on `state.authUser` can fire `pushRemoteState(buildSyncPayload(state))` **before** the pull resolves — uploading local guest state over the real account (bug H2). `localStorage` key `cukai_v7_data` is not namespaced by user and isn't cleared on logout (bug M5), so account A's data leaks to a subsequent guest or account B and can then be pushed to B.
**Why it matters.** Silent, unrecoverable server‑side data loss for signed‑in users on multi‑device or slow‑network scenarios — the exact scenario cloud sync exists to handle.
**Recommendation.**
- Gate the push effect behind a `remoteHydrated` flag; never push until the initial pull/merge completes.
- Add `version` (or `updated_at`) to the payload; `PUT /state` returns 409 on stale write; client re‑pulls and merges.
- Validate the incoming blob against a Pydantic model mirroring `SyncPayload`; cap serialized size.
- Namespace `localStorage` by user id (or `clearPersisted()` + re‑init on logout).
- Longer term: split the blob into a few coarse documents (profile, finance, transactions, tax) so a conflict on one doesn't risk the others, and so partial sync is possible.
**Priority: P0 (H2 path) / P1 (structural).**

### LA‑5 — Auth: reset token is accepted as a session token

**Observation.** `backend/auth.py` `decode_token()` (guarding `/auth/me`, `GET/PUT /state`) verifies only signature + expiry and returns `payload["sub"]` — it never rejects a token carrying `purpose: "reset"`. A password‑reset JWT (60 min, same `SECRET`) therefore authenticates every protected endpoint (bug C1). Reset links routinely leak via logs, `Referer`, browser history, mail‑scanner prefetch.
**Why it matters.** Full account read/write from a leaked reset link. This is the one finding that is unambiguously a security vulnerability, not a UX issue.
**Recommendation.** In `decode_token`, `if payload.get("purpose"): return None` (or give session tokens an explicit `purpose: "session"` and require it). Make reset tokens single‑use (store a jti or bump `password_changed_at` and reject older tokens). Add `enforce_rate_limit` + a size cap to the unauthenticated `/receipts/scan` and `/statements/scan` endpoints (bug M6).
**Priority: P0.**

### LA‑6 — Canned AI replies as a product surface

**Observation.** `aiCraftReply()` in `app/src/lib/seedData.ts` is keyword‑matched hardcoded prose with invented figures; `AI_CHAT_HISTORY` and `NOTIFICATIONS` in the same file are fixed arrays with fabricated amounts, rendered unconditionally for every user including zero‑data accounts.
**Why it matters.** In a finance/tax product, any invented number shown as the user's own is a trust failure (see AI‑2/AI‑3/HM‑4). Real Gemini answers were accurate — the fallbacks and seed content drag the feature down.
**Recommendation.** Delete fabricated figures from all three. Fallback replies must be figure‑free and point the user to the real screen. Notifications and chat history must be derived from real state with proper empty states. Keep `aiCraftReply` only as a last‑resort "assistant unavailable" message.
**Priority: P0.**

### LA‑7 — State management: monolithic store, heavy recompute, stale memo

**Observation.** One `useReducer` store with ~140 action types mirroring the original prototype's methods 1:1; `value = useMemo(() => ({state, dispatch}), [state])` so every state change re‑renders every consumer. Selectors are pure but expensive and uncached: `selectTaxCenter` calls `buildTaxModel` **three times** per invocation (raw, then with marginal rate, then prev‑year) and is itself called by `selectAiContext`. `selectHomeDashboard` rebuilds `budgetDerivedTx` on every call and is re‑invoked by `selectRecordPage` and `selectStatsPage`. `useActions()` memo depends on `[state.ob.linkedIds]` and freezes several `state`‑reading callbacks (bug H4). A `mounted` flag + 60 ms timeout is used to suppress hydration flash, which many selectors branch on (`state.mounted && ...`).
**Why it matters.** Works at demo scale; will get sluggish with a year of real transactions, and the stale‑memo class of bug (H4) recurs whenever a callback closes over `state`.
**Recommendation.**
- Memoize selectors (`reselect`‑style or `useMemo` at call sites keyed on the slices they read).
- Split context into `StateContext` / `DispatchContext` so dispatch‑only components don't re‑render.
- Fix `useActions` deps (`[state]` or a `useRef(state)`); as a rule, action creators that read `state` must not be memoized on a partial dep list.
- Consider splitting the reducer by domain (onboarding / finance / tax / ui) with a root combiner.
- Replace the `mounted` timeout hack with SSR‑safe `useSyncExternalStore` or an explicit hydration boundary.
**Priority: P1.**

### LA‑8 — Offline / network resilience

**Observation.** `api.ts` `request()` uses `fetch` with **no timeout / AbortController**; the AI "…" indicator sat for ~20 s with no feedback and would sit forever against a hung backend. `pushRemoteState` failures are swallowed (`.catch(() => {})`) with no user indication that sync is behind. Statement upload has an error path; most others don't surface state.
**Why it matters.** "Local‑first, syncs when online" is a selling point only if the user can tell what state they're in.
**Recommendation.** Add per‑request timeouts + `AbortController`; a small global "offline / sync pending / synced" indicator; retry‑with‑backoff for `pushRemoteState`; a visible toast on repeated sync failure.
**Priority: P1.**

### LA‑9 — Positive: separation of concerns and the net‑worth invariant

**Observation.** `app/src/lib/` (pure logic, no React), `app/src/store/selectors.ts` (pure read layer), `app/src/store/reducer.ts` (writes), screens (bind) is a clean, testable split. `selectNetWorth` / `computeNetWorthTimeline` read only `netWorthSeed` and `ob.manual`, never transactions/receipts, so reclassifying a transaction provably can't move net worth — covered by `selectors.test.ts`. Tests exist for the money‑math (`reducer.test.ts`, 30 passing).
**Why it matters.** This is a solid foundation; the fixes above are mostly "add a validation seam" and "pick one dataset," not "rewrite."
**Recommendation.** Keep the architecture; extend the test discipline to the tax‑engine invariants (TX‑1/TX‑4) and the canonical‑spend selector (LA‑2). Surface the net‑worth/spend separation as a user‑facing trust message.
**Priority: —.**

---

## 5. Top 10 prioritized recommendations

Effort: **S** ≈ ≤1 day · **M** ≈ 2–5 days · **L** ≈ >1 week.

| # | Recommendation | Addresses | Priority | Effort |
|---|---|---|---|---|
| 1 | **Purge fabricated data from user surfaces.** Make `NOTIFICATIONS`, `AI_CHAT_HISTORY`, and `aiCraftReply()` figure‑free / state‑derived; ship empty states for notifications, AI history, Recent activity, and fresh Tax Center. | HM‑4, AI‑2, AI‑3, LA‑6, HM‑1 | P0 | M |
| 2 | **One canonical "spend" selector.** Real transactions only; reuse in Home/Budgets/Stats; model recurring/planned spend as a separate, separately‑labelled total; drop `budgetDerivedTx` from Record & Stats. | ST‑1, ST‑2, HM‑5, LA‑2 | P0 | M |
| 3 | **Fix the tax engine's core math.** Clamp per‑item captured to cap before aggregating; fix the RM 9,000 double‑count; compute an eligibility‑aware optimisation denominator; add invariant tests. | TX‑1, TX‑2, TX‑4, TX‑5, LA‑3 | P0 | M |
| 4 | **Replace category→relief mapping with merchant/keyword allow‑list rules;** default ambiguous items to "not deductible — confirm," reusing the manual‑entry explainer pattern; show `RELIEF_INFO.why` on every auto‑tag. | TX‑3, LA‑3, SC‑2 | P0 | M |
| 5 | **Close the reset‑token‑as‑session hole** (`decode_token` rejects `purpose` claims; single‑use reset tokens); add rate‑limit + size cap to `/receipts/scan` & `/statements/scan`. | LA‑5 (C1), M6 | P0 | S |
| 6 | **Add a numeric/date sanitization seam in the reducer** (`sanitizeMoney/Int/Date` with min/max), plus input‑level `min`/`inputmode`; guard `money()` against `NaN`; reducer tests for hostile input. | LA‑1 (M3, M4, L4, L5) | P0 | S–M |
| 7 | **Make sync safe:** `remoteHydrated` gate before any push; `version`/`updated_at` + 409 on stale `PUT /state`; validate the blob (Pydantic) + size cap; namespace/clear `localStorage` per user on logout. | LA‑4 (H2, M5, M7) | P0 | M |
| 8 | **Cut onboarding to a lean, honest flow:** remove the developer/customer screen and "How did you hear about us?" from the critical path; fix the step counter; wire the real T&C/Privacy links; ask disability/housing once; require an income choice; replace the US‑bank mock with Malaysian institutions + CSV/PDF import (parser already exists); clear stray modals on `OB_FINISH`. | OB‑1…OB‑11 | P0/P1 | M |
| 9 | **Rebuild the Home dashboard to spec + guided first run:** add cash / income‑vs‑spend / investments tiles, render the computed `insight` card, standardise the over‑budget presentation, and add a disappearing first‑run checklist. | HM‑1, HM‑2, HM‑3 | P1 | M |
| 10 | **Level up the AI surface:** stream tokens + stop button + client timeout; fix the `useActions` stale memo so history/context actually send; persist real conversations; add a passive weekly‑summary card on Home and a "what changed" line on Tax Center. | AI‑1, AI‑4, AI‑5, LA‑7, LA‑8 | P1 | M–L |

### Also worth doing (below the top 10)
- Budgets: add a Simple/Detailed toggle over the same categories (BG‑1) — Monarch's headline idea, still unbuilt. **M.**
- Bring swipe‑to‑recategorize and multi‑select to the main Record list (RC‑3). **M.**
- Donut: top‑5 + "Other", inline legend, and fix the drill‑down blank‑void layout (ST‑3, ST‑4). **S.**
- Memoize expensive selectors; split state/dispatch contexts; split the reducer by domain (LA‑7). **M.**
- Timezone: derive all "today" boundaries from local components (RC‑2 / M10). **S.**
- Settings: promote to a full screen, fix the "Security & Support" grouping, show "Guest"/"Not set" instead of seed identity and fake account counts (SE‑1…SE‑4). **S–M.**
- Web capture: real camera preview or picker‑first, with an example‑receipt overlay (SC‑1). **M.**

Sources consulted for competitor specifics: [Monarch AI — Help](https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch), [Monarch Money Review 2026 (Penny Hoarder)](https://www.thepennyhoarder.com/budgeting/monarch-money-review/), [LHDN e‑Filing 2026 guide (Funding Societies)](https://blog.fundingsocieties.com.my/how-to-file-income-tax-with-mytax/), [Malaysia Personal Income Tax Guide 2026 (RinggitPlus)](https://ringgitplus.com/en/blog/tax/malaysia-personal-income-tax-guide-2026-ya-2025.html); plus product knowledge of YNAB, Copilot Money, Rocket Money, Emma, and TurboTax.
