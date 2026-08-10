# Product Design Brief: Personal Finance + Tax Platform
*Design stage deliverable — Monarch analysis, feature strategy, roadmap, navigation, and Claude Design prompt*

---

## 1. Monarch Money Analysis

### What makes it feel premium

**Net worth as the emotional anchor.** The dashboard leads with net worth over time, not a transaction list. It reframes the app from "expense tracker" to "wealth tool" — a positioning trick worth copying regardless of feature set.

**Customizable widget dashboard.** Users drag/reorder cards (net worth, cash flow, recent transactions, investments, upcoming bills). This lets one layout serve very different users without you having to design ten dashboards.

**Category-first budgeting, two modes.** "Flex budgeting" (three simple buckets: fixed, flexible, goals) for casual users, and full category budgeting for power users. This is the single best UX idea to steal: give beginners a simple mental model, let advanced users drill down, same underlying data.

**Best-in-class transaction categorization + swipe-to-review.** Auto-categorization that's actually trustworthy, and a fast swipe gesture to confirm/recategorize on mobile. The product feels "intelligent" mainly through this one interaction being frictionless.

**Reports that stay simple.** Cash flow, spending by category, net worth trend — three or four chart types reused everywhere rather than a sprawling BI tool. Consistency of chart language (not variety) is what reads as "polished."

**Household collaboration built in.** Shared access for partners/family with per-transaction assignment. Signals trust and "grown-up software," even for solo users who never touch it.

**AI assistant as a summarizer, not a chatbot gimmick.** Weekly summaries and surfaced trends, not a full conversational interface bolted onto every screen. AI is used to reduce cognitive load, not as decoration.

**Receipt scanning (2026) matched to transactions.** Confirms this category is heading exactly where you want to go — it's not a stretch feature, Monarch validated the demand.

Sources: [Forbes Advisor](https://www.forbes.com/advisor/banking/monarch-budget-app-review/), [Experian](https://www.experian.com/blogs/ask-experian/monarch-money-review/), [Monarch – new mobile navigation](https://www.monarchmoney.com/blog/new-mobile-navigation), [Monarch – tracking features](https://www.monarch.com/features/tracking)

### What to take inspiration from
- Net worth / trend-first dashboard framing
- Flex vs. detailed budgeting (simple mode + advanced mode on shared data)
- Swipe-to-confirm transaction review
- A small, reused set of chart types applied consistently
- AI as passive summarizer surfaced contextually, not a separate "chat with your money" product

### What to simplify (Monarch is more than you need at V1)
- Fully customizable drag-and-drop dashboard — nice-to-have, not core; a well-designed fixed layout is fine until users ask for control
- Multi-user household collaboration — real feature, but not a V1 problem for a single-user MVP
- Deep investment analytics (holdings-level performance, allocation modeling) — track balances first, analyze later
- Goal-planning module as a distinct system — fold into budgets initially rather than building a separate goals engine

### What you probably don't need at this stage
- Financial-advisor invite / multi-role permissions
- Custom widget marketplace or dashboard theming
- Investment rebalancing or advice features
- Bill negotiation / subscription cancellation concierge features (some competitors have this — it's a distraction from your tax differentiator)

---

## 2. Recommended Features for Your Product

Your wedge is **"Monarch-style money management + built-in tax intelligence."** Every feature decision should ask: does this make the *tax* side smarter, or is it generic budgeting parity? Parity features should be done well but minimally; tax features are where you differentiate and should get the most design attention.

**Core money management (Monarch-inspired, needed for credibility):**
Accounts aggregation (bank, credit card, e-wallet), transactions with categorization, budgets, cash flow, net worth, basic investment balances, financial dashboard/overview.

**Tax differentiator (your moat):**
Receipt capture via OCR, automatic tax-category tagging of transactions (deductible vs. not), a dedicated Tax Center showing year-to-date deductible expenses, document/receipt vault, and eventually a real-time "estimated tax impact" of spending decisions.

The unlock is **connecting the two systems**: every transaction and every scanned receipt should be askable "is this tax-relevant?" — that's the thing Monarch cannot do and Keeper Tax does but without the full money-management layer. You're building the app that sits between them.

---

## 3. Feature Roadmap & Prioritization

Legend: **Priority** (High/Med/Low) · **Why** · **Difficulty** (Low/Med/High) · **Design now?**

### Version 1 — MVP (prove the core loop works)
Goal: a user can connect accounts, see their financial picture, and capture a receipt that gets tax-tagged automatically.

| Feature | Priority | Why it matters | Difficulty | Design now? |
|---|---|---|---|---|
| Account linking (bank, card, e-wallet) | High | Nothing works without data; table stakes | High (Plaid/aggregator integration) | Yes |
| Home dashboard (net worth, cash, income, spend, recent activity) | High | First impression, sets "premium fintech" tone | Med | Yes |
| Transactions list + manual categorization | High | Core daily-use loop | Med | Yes |
| Basic budgets (flex-style: 2–3 buckets) | High | Monarch's simplest mode — gets people using it fast without complexity | Med | Yes |
| Receipt scan → OCR → confirm → save | High | This is your differentiator and the center of your nav — must exist and feel great in V1 | High (OCR accuracy, extraction UX) | Yes |
| Tax tagging on transactions (deductible/non-deductible flag) | High | Bridges money management to tax; the core "aha" | Med | Yes |
| Tax Center v1 (YTD deductible total, receipt list) | High | Makes the differentiator visible, not just backend logic | Med | Yes |
| Settings / profile / account management | Med | Required, but low design risk | Low | Yes (light) |

**Explicitly out of V1:** multi-user households, investment analytics, goals module, dashboard customization, AI chat/insights, multi-currency, tax filing/submission.

### Version 2 — Depth (once the loop is validated)
Goal: make budgeting and tax tracking genuinely useful over a full financial year, not just a demo.

| Feature | Priority | Why it matters | Difficulty | Design now? |
|---|---|---|---|---|
| Category-level budgeting (advanced mode) | High | Power users will demand it once flex budgets feel limiting | Med | Later |
| Cash flow reports & spending trends | High | Turns raw transactions into insight — Monarch's "reports" strength | Med | Later |
| Investment account tracking (balances, basic performance) | Med | Rounds out "full financial picture" positioning | Med | Later |
| Tax document vault (statements, 1099s, receipts organized by tax year) | High | Natural extension of Tax Center; big trust/retention driver at filing time | Med | Later |
| Deduction suggestions (rule-based, not AI yet) | Med | Early version of the "intelligent tax assistant" promise | Med | Later |
| Multi-account e-wallet support | Med | Depends on your target market's payment habits | Med | Later |
| Notifications / reminders (budget overage, tax deadlines) | Med | Retention lever | Low–Med | Later |

### Version 3 — Intelligence & scale
Goal: the "intelligent tax assistant" promise, automation, and ecosystem features.

| Feature | Priority | Why it matters | Difficulty | Design now? |
|---|---|---|---|---|
| AI-powered deduction detection & tax insights | High (long-term) | This is the eventual moat vs. both Monarch and Keeper Tax | High | No |
| Household/multi-user collaboration | Med | Real Monarch feature, but only after solo experience is excellent | Med | No |
| Goals module (savings/debt payoff planning) | Med | Nice retention feature, not core to differentiation | Med | No |
| Custom/drag-and-drop dashboard | Low | Cosmetic power-user feature | Med | No |
| Tax filing integration or export | High (long-term) | Closes the loop from "tracking" to "filing" — big value but big scope/compliance lift | High | No |
| Bank-grade multi-currency / international tax rules | Low–Med | Only if expanding beyond initial market | High | No |

**Bottom line:** design V1 fully (7 screens/flows), sketch V2 conceptually so V1 doesn't box you in, and don't design V3 at all yet — it'll change once you have real users.

---

## 4. Recommended Navigation

Your instinct — a 5-tab bar with Scan as the prominent center action — is the right shape. Where I'd adjust is the *other four* tabs, based on what's actually in V1.

**Recommended structure:**

**Home | Finance | (Scan) | Tax | More**

This matches your original instinct almost exactly, and I'd keep it — here's the reasoning so you're confident in it rather than just defaulting to it:

- **Home** — the dashboard (net worth, cash, spend, recent activity, quick insights). This is "how am I doing," full picture, glanceable.
- **Finance** — the Monarch-style workspace: accounts, transactions, budgets, cash flow. This is "manage my money," a working area you spend time in.
- **Scan** (center, elevated button) — receipt capture. Primary action, always one tap away regardless of what tab you're on. This is the correct pattern (see Cash App, Venmo — a raised center action button for the single most frequent action) *only when* one action truly deserves that priority. In your product, it does: it's both high-frequency (every receipt) and your core differentiator, so it earns the slot.
- **Tax** — the dedicated tax center: YTD deductible total, receipt/document vault, deduction categories, tax progress. This is "how does this affect my taxes," a separate mental mode from day-to-day budgeting, which is why it deserves its own tab rather than living inside Finance.
- **More** — settings, profile, linked accounts management, support. Standard overflow.

**Why not other structures I considered:**
- *Merging Tax into Finance* (4 tabs + scan) — undersells your differentiator. If tax is buried in a submenu, the app reads as "budgeting app with a tax feature," not "finance + tax platform." A dedicated tab is a positioning statement, not just an IA decision.
- *Adding a separate Investments tab* — premature for V1; investments are a card on Home and a section inside Finance until the feature set justifies its own tab.
- *Adding Insights/AI as a tab* — nothing in V1 needs a permanent dedicated space for this; surface AI content contextually inside Home and Tax rather than giving it real estate before it's built.

One implementation note: make sure Scan is reachable from *within* Finance and Tax too (e.g., a floating action button or inline "+scan" affordance), not only from the bottom bar — Monarch-style apps generally offer the primary action from multiple entry points, not just one.

---

## 5. Key Screens to Design (V1 scope)

Based on the roadmap above, these are the screens worth taking to high fidelity right now:

1. **Home / Dashboard** — net worth (with trend), cash across accounts, income vs. spending this month, active budget status, recent transactions, small "investments" card, one AI-style insight callout.
2. **Finance — Accounts** — linked accounts grouped by type (bank, credit card, e-wallet), balances, last-synced state.
3. **Finance — Transactions** — searchable/filterable list, category chips, tax-tag indicator per row.
4. **Finance — Budgets** — flex-style buckets (Fixed / Flexible / Goals) with progress bars; tap-through to category detail.
5. **Scan flow (4 states as one flow, not 4 separate screens conceptually)** — capture → OCR processing → extracted fields for confirmation (merchant, amount, date, category, tax-deductible toggle) → saved confirmation, linked to a transaction.
6. **Tax Center** — current tax year selector, YTD deductible total (hero number, Monarch-net-worth-style), category breakdown of deductible spend, receipt/document list, simple progress-toward-last-year or benchmark indicator.
7. **More / Settings** — account, linked institutions, notification preferences, support/help.

That's 7 screens/flows — enough to feel like a real product, not so many that you're designing features you haven't validated.

---

## 6. Claude Design Prompt

Copy the block below into Claude Design as-is.

```
Design a high-fidelity mobile-first prototype for a personal finance + tax
management app. The product's positioning is "a modern personal financial
operating system" — think Monarch Money's polish and information hierarchy,
but with a built-in intelligent tax assistant as the core differentiator.
Avoid generic banking-app aesthetics; this should feel premium, minimal,
and data-driven, with a distinct visual identity (not a Monarch clone).

DESIGN DIRECTION
- Modern, premium, minimal, clean, intelligent, approachable, professional
- Strong but restrained color system: a confident primary accent color,
  neutral dark/light surfaces, and clear semantic colors for
  income/positive (green), expense/negative (red/coral), and tax-related
  content (a distinct third accent so tax feels like its own "mode")
- Typography: a clean modern sans-serif, strong numeric hierarchy for
  currency figures (large, tabular numerals for key stats like net worth
  and totals), clear secondary text for labels/metadata
- Generous spacing, card-based layout, soft shadows/elevation, rounded
  corners — avoid dense spreadsheet-like tables
- Consistent chart language reused across screens (line chart for trends,
  donut/bar for category breakdowns) rather than many different chart types
- Thoughtful empty states, subtle micro-interactions (e.g., swipe-to-confirm
  transactions, animated progress bars, a satisfying scan-to-saved moment)
- Use realistic example financial data throughout (real-looking merchant
  names, categories, and dollar amounts) — no lorem ipsum or "Item 1"

NAVIGATION
Bottom tab bar with 5 items: Home | Finance | Scan (elevated center button,
primary action) | Tax | More. The Scan button should be visually distinct
and slightly raised/larger than the other four tabs, since receipt
scanning is the app's core differentiating action.

SCREENS TO DESIGN

1. HOME (dashboard)
   - Net worth as the hero metric with a trend line/sparkline over time
   - Cash across accounts, this month's income vs. spending
   - Active budget status (progress bar style)
   - Recent transactions (4-5 rows) with category icons
   - A compact investments summary card
   - One "insight" callout card (e.g., a short AI-style observation about
     spending or a tax-saving opportunity)

2. FINANCE — overview with sub-sections/tabs for:
   - Accounts: bank, credit card, and e-wallet accounts grouped by type,
     each with balance and last-synced time
   - Transactions: a filterable/searchable list with category chips and
     a small tax-deductible indicator badge on relevant rows
   - Budgets: simple "Fixed / Flexible / Goals" bucket view with progress
     bars, plus a hint of a more detailed category breakdown on drill-in

3. SCAN / OCR FLOW (design as a connected 4-step flow)
   - Step 1: Camera capture screen for a receipt (clean, focused, minimal
     chrome, a clear capture button)
   - Step 2: Brief OCR processing state (subtle loading animation)
   - Step 3: Extracted data confirmation screen — merchant name, amount,
     date, suggested category, and a prominent "Tax deductible?" toggle,
     all editable
   - Step 4: Saved confirmation — a satisfying success state showing the
     receipt now linked to a transaction, with a subtle prompt back to
     the Tax Center ("Added to your 2026 deductions")

4. TAX CENTER
   - Tax year selector at top (e.g., "2026")
   - Hero metric: total deductible expenses year-to-date (styled with the
     same visual weight as net worth on Home)
   - Category breakdown of deductible spending (donut or bar chart)
   - Receipt/document list (thumbnail + merchant + amount + category)
   - A simple progress or benchmark indicator (e.g., vs. last year)

5. MORE / SETTINGS
   - Profile summary, linked accounts management, notification
     preferences, support/help — keep this screen simple and secondary
     in visual weight compared to the other four

Design for mobile-first (iOS-style safe areas, thumb-reachable primary
actions) but keep components and spacing translatable to a responsive
web layout later. Prioritize information hierarchy and restraint over
density — this should feel like the calmest, most trustworthy app on the
user's phone, even though it's handling complex financial and tax data.
```

---

### Where this leaves you
V1 is 7 screens/flows built around one core loop: see your finances → capture a receipt → watch it become a tax deduction automatically. Everything else on the roadmap waits until that loop is proven. Take the Claude Design prompt as-is, or trim further if even 7 screens feels like too much for a first pass — Home, Scan flow, and Tax Center are the three that actually need to be great; Finance and More can be competent.
