# Cukai v7 — QA Bug Report

Date: 2026-08-28
Scope: read/test only (no application code changed). Frontend `app/`, backend `backend/`, OCR `pipeline/`.
Method: ran every existing check (Step 1), static logic review of store/lib/backend (Step 2), live UI walkthrough on `npm run dev` incl. fresh guest onboarding, invalid inputs, tax toggle, budgets, record, AI chat, settings/theme, dark mode (Step 3).

## Resolution — 2026-09-05

Re-checked against `main` (see `docs/superpowers/specs/2026-09-04-highprio-bugfix-and-render-cors-deploy-design.md`):

- **C1, H1, H4 — fixed** by the 2026-09-02 merge (`fix/qa-findings-2026-08-28`).
- **H2 — client race fixed** by the same merge (`SET_AUTH_USER` now dispatched only after the remote pull resolves). The server-side `PUT /state` optimistic-concurrency guard is still open — deferred to the infra-security work (`docs/superpowers/specs/2026-08-29-infra-security-plan.md`).
- **H3 — fixed.** `aiCraftReply()` was already figure-free; `AI_CHAT_HISTORY` (still fabricated, rendered live as "Past conversations") was emptied in the 2026-09-05 merge, with an empty state added.
- **M8** (fabricated notifications) — already fixed (`NOTIFICATIONS = []`), noted here since it's referenced above alongside H3.

All other Medium/Low findings below are still open.

---

## Step 1 — existing checks (all PASS)

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` (vitest) | **30 passed / 4 files**, 286 ms. No failures. |
| Type check | `npx tsc -b --force` (in `app/`) | **exit 0**, no diagnostics. |
| Lint | `npm run lint` (oxlint) | **exit 0**, 0 errors, **12 warnings** (see note). |
| Pipeline tests | `backend/.venv/bin/python -m pytest pipeline/tests/ -v` | **13 passed, 6 skipped**. Skips: `test_receipt_ocr_real_samples` (needs vision API key), 5× CIMB/TNG PDF parser tests (sample PDFs not committed). No failures. |
| Install | `npm ci` | OK. npm reports 3 moderate-severity advisories (`npm audit`), deprecated transitive deps (`uuid@7`, `glob@11`). |

**Lint warnings (not failures, but flagged as latent bugs):**
`react(set-state-in-effect)` in `components/AmountKeypadSheet.tsx:49` and `screens/modals/scan/CaptureStep.tsx:33` (cascading renders); `react(immutability)` — variable reassigned after render in `screens/finance/StatsSection.tsx:63` (`cumulative`) and `screens/finance/NetWorthSection.tsx:134-136` (`dragging`); several `only-export-components` (fast-refresh only).

No Step-1 failure ⇒ no finding is attributable directly to a broken check. All findings below come from Steps 2–3.

---

## Findings summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 4 |
| Medium | 11 |
| Low | 10 |
| **Total** | **26** |

---

## Critical

### C1 — Password-reset JWT is accepted as a full session token (token-confusion)
- **Area:** backend / auth
- **Description:** `auth.create_reset_token()` mints a JWT with `sub = user_id`, `purpose = "reset"`, 60-min TTL, signed with the same `SECRET` as session tokens. `auth.decode_token()` (used by `current_user_id`, the dependency guarding `/auth/me`, `GET /state`, `PUT /state`) only verifies signature + expiry and returns `payload["sub"]` — it never checks that `purpose` is absent. A reset token therefore authenticates every protected endpoint. `decode_reset_token()` *does* check `purpose == "reset"`, so the asymmetry is one-directional but exploitable.
- **Repro:**
  1. Trigger `POST /auth/forgot-password` for a victim; capture the `reset_token` from the emailed link (`/?reset_token=…`).
  2. `curl -H "Authorization: Bearer <reset_token>" http://127.0.0.1:8000/state` → returns the victim's full financial state blob.
  3. `PUT /state` with the same header overwrites it.
- **Expected:** a reset-purpose token is rejected by `decode_token` / `current_user_id`.
- **Actual:** it grants full account read/write for 60 minutes. Reset links routinely leak via server logs, browser history, `Referer`, and mail-provider link scanning.
- **Suspected:** `backend/auth.py:53-58` (`decode_token` — add `if payload.get("purpose"): return None`), vs `:64-82`.
- **Fix:** in `decode_token`, reject any token carrying a `purpose` claim (or give session tokens their own `purpose: "session"` and require it). Consider making reset tokens single-use (store a jti / bump a `password_changed_at` and reject older tokens).

---

## High

### H1 — Finishing onboarding leaves a balance/investment detail modal open over Home
- **Area:** logic / UI
- **Description:** `OB_FINISH` explicitly clears `budgetItemDetailOpen` but not `balanceDetailOpen` or `investDetailOpen`. In the onboarding "Enter your finances" step, every `AddLink` ("Add account", "Add card", "Add property", "Add asset", "Add liability") dispatches `ADD_RECORD`, which sets `balanceDetailOpen = listKey + ':' + id` (and `ADD_INVESTMENT_ROW` sets `investDetailOpen`). That state survives the rest of onboarding; when `OB_FINISH` flips `appStage` to `app`, the overlay renders on top of Home.
- **Repro:** Fresh onboarding → "Skip for now" → proceed to step "Enter your finances" → click **Add account** (leave it blank) → finish onboarding → click **Go to Home**. Home loads with a modal sheet ("Account name / RM 0.00 / Add money · Deduct money / History: No changes yet / Remove account") covering it. Confirmed live.
- **Expected:** Home renders clean; no detail overlay.
- **Actual:** stray overlay; user must find the back-chevron to dismiss.
- **Suspected:** `app/src/store/reducer.ts:214` — `OB_FINISH` returns `{…, budgetItemDetailOpen: null }` only.
- **Fix:** also set `balanceDetailOpen: null, investDetailOpen: null, historyOpen: null, txDetailOpen: null` in `OB_FINISH`.

### H2 — Login sync race can overwrite the account's server data with pre-login guest state
- **Area:** logic / backend
- **Description:** On boot with a stored token, `StoreProvider` dispatches `SET_AUTH_USER` and *then* `await fetchRemoteState()` before `APPLY_REMOTE_STATE`. A separate debounced effect keyed on `state.authUser` (among others) schedules `pushRemoteState(buildSyncPayload(state))` 800 ms after `authUser` becomes set. If `fetchRemoteState()` (network) has not resolved within ~800 ms, the push uploads the local guest/previous state, overwriting the real account data on the server before it is ever loaded. `PUT /state` is unconditional last-write-wins — no version/`updated_at` guard.
- **Repro (timing-dependent):** Sign in on a device that already has local `cukai_v7_data`, throttle network so `/state` GET takes > 1 s. Observe `PUT /state` firing with the guest payload before `APPLY_REMOTE_STATE`.
- **Expected:** no push until the remote state has been pulled/merged; or server rejects a stale write.
- **Actual:** silent server-side data loss possible.
- **Suspected:** `app/src/store/StoreProvider.tsx:35-49` and `:70-79`; `backend/main.py:199-209`.
- **Fix:** gate the push effect on a "remote hydrated" flag; don't push until the initial pull completes. Add an `updated_at`/version to `PUT /state` and 409 on conflict.

### H3 — AI assistant states fabricated money figures as the user's own data
- **Area:** logic / UI
- **Description:** Backend default `GEMINI_MODEL = "gemini-3.6-flash"` is not a valid model id, so absent a working key/model every `/ai/chat` call returns `source: "canned"` and the client falls back to `aiCraftReply()`, which returns hard-coded strings with specific RM amounts ("You've spent RM 6,960 of your RM 8,500 budget this month — about RM 540 left … Dining is your fastest-growing category"; "you've captured about 62% of your available reliefs"; "net worth is trending up over the last 12 months"). The AI screen advertises "I can see your accounts, budgets, receipts and tax profile."
- **Repro:** Fresh guest (budget RM 0, net worth as entered) → AI tab → tap "Am I on track with my budget this month?" → reply asserts "RM 6,960 of your RM 8,500 budget". Confirmed live.
- **Expected:** when no real reply is available, a generic answer that does not invent figures, or an explicit "I don't have that data".
- **Actual:** confident, wrong, specific numbers in a finance/tax app.
- **Suspected:** `app/src/lib/seedData.ts:137-143` (`aiCraftReply`); `backend/ai_chat.py:33` (default model id).
- **Fix:** make the canned generator figure-free (or feed it the real `selectAiContext` snapshot); ship a real default model id or fail louder in setup docs.

### H4 — `useActions` is memoized on a stale dependency; AI context & history are frozen
- **Area:** logic
- **Description:** `useActions()` returns `useMemo(() => ({…}), [state.ob.linkedIds])`. Several returned callbacks close over `state`: `submitAiText` reads `state.aiMessages` (conversation history sent to `/ai/chat`) and `selectAiContext(state)` (the "real-data snapshot"); `completePasswordReset` / `cancelPasswordReset` read `state.resetToken`. Because the memo only re-creates when `state.ob.linkedIds` changes — which never happens for a manual-setup user — these callbacks permanently see the first render's `state`. Result: every AI request sends the initial (empty) data snapshot and an empty history array, so multi-turn continuity and "grounded in real data" both silently don't work even when Gemini *is* configured.
- **Repro:** Add accounts/transactions, open AI, send two messages. Inspect the `/ai/chat` request body (or `selectAiContext`): `history: []` and `context` reflecting the empty initial state.
- **Expected:** dependency array covers everything the callbacks read (or the callbacks read `state` via a ref).
- **Suspected:** `app/src/store/StoreProvider.tsx:102`, `:314-316`, `:353-354`.
- **Fix:** depend on `[state]` (callbacks are cheap) or route `state`-reading callbacks through a `useRef(state)` kept current in an effect.

---

## Medium

### M1 — Tax engine double-counts the RM 9,000 individual relief
- **Area:** logic
- **Description:** `selectTaxCenter` computes `chargeableIncomeEst = Math.max(0, grossAnnualIncome - 9000 - rawTaxModel.totalCaptured)`. `rawTaxModel.totalCaptured` already includes the `indiv_self` item, whose `captured` is forced to `im.cap` (= RM 9,000) because it is `automatic: true`. So RM 9,000 is subtracted twice, understating chargeable income and potentially dropping the user a marginal-rate bracket, which then understates every `potentialBenefit` / "Save ~RM x more" figure.
- **Repro:** Set income to a mid band (e.g. "RM 8,300–33,300"), no captured receipts. `chargeableIncomeEst` is RM 9,000 lower than `gross − 9000` should give.
- **Suspected:** `app/src/store/selectors.ts:418`; `app/src/lib/taxEngine.ts:196`.
- **Fix:** subtract only `rawTaxModel.totalCaptured` (which contains the 9,000), or only the literal 9,000 plus the *non-automatic* captured total — not both.

### M2 — Over-cap "captured" amounts overflow into group & grand totals
- **Area:** logic
- **Description:** In `buildTaxModel`, item-level `captured` is never clamped to `cap` before it is summed into `group.captured` and `totalCaptured` (`taxEngine.ts:206-217`). Per-item `remaining` is floored at 0, but the aggregates are not. A user tagging more than a relief's cap to one bucket inflates `totalCaptured`, pushes `taxOptPct` above 100%, and (via M1's formula) over-reduces chargeable income / overstates estimated savings.
- **Repro:** Scan/accept RM 5,000 of "Fitness" expenses (Lifestyle cap RM 2,500). Group and total "claimed" show the full RM 5,000.
- **Suspected:** `app/src/lib/taxEngine.ts:208`, `:216-219`.
- **Fix:** sum `Math.min(it.captured, it.cap)` for group/total `captured` (keep the raw value only for the per-item % badge).

### M3 — Budget category cap accepts negative / unbounded values; poisons Home & Budgets
- **Area:** logic / UI
- **Description:** The "Monthly cap (RM)" input (onboarding budget step and Budgets "Add category") accepts arbitrary values incl. `-9999999999`. `selectBudgets` uses `total = c.cap` directly; `over = spent > total`. A negative cap makes `0 > -9,999,999,999` true.
- **Repro:** Onboarding → "Set up your budget" → **+ Housing** → cap `-9999999999` → **Add** → finish. Home shows "MONTHLY BUDGET · RM 0 / RM -9,999,999,999 · **RM 9,999,999,999 over**"; Budgets tab shows the same nonsense in the gauge scale, "BUDGETED", and the Fixed bucket row. Confirmed live.
- **Expected:** cap constrained to ≥ 0 (and a sane maximum); invalid input rejected.
- **Suspected:** `app/src/store/reducer.ts:314-321` (`ADD_BUCKET_CATEGORY`), `:330-331` (`SET_BUCKET_CATEGORY_CAP`); the cap `<input>` in the budget screens.
- **Fix:** `Math.max(0, value)` (and cap an upper bound) in the reducer; add `min="0"` + sanitize in the field.

### M4 — Negative subscription amount accepted, shown as positive, subtracts from totals
- **Area:** logic / UI
- **Description:** `ADD_SUBSCRIPTION` only checks `!d.name || !d.amount`. A `-50` amount is stored verbatim. `selectSubscriptions.monthlyTotal = Σ parseFloat(amount) * FREQ_FACTOR` → a negative subscription reduces the monthly and yearly totals. The row renders "RM 50.00" because `money()` applies `Math.abs`, so the user can't see the sign.
- **Repro:** Onboarding "Your subscriptions" (or Settings › add) → name "TestSub", amount `-50` → Add. Row shows "RM 50.00"; subscription monthly/yearly totals decrease. Confirmed live.
- **Suspected:** `app/src/store/reducer.ts:418-426`; `app/src/store/selectors.ts:551-554`.
- **Fix:** validate `parseFloat(d.amount) > 0` in `ADD_SUBSCRIPTION`; `min="0"` on the field.

### M5 — logout does not clear persisted state; no per-account localStorage namespace
- **Area:** logic
- **Description:** `apiLogout()` only removes the token key. `cukai_v7_data` retains the previous account's full blob (accounts, transactions, tax profile). A subsequent guest — or a different account signing in on the same browser — sees that data until a remote pull overwrites it, and combined with H2's race the leftover data can be *pushed* to the new account.
- **Repro:** Sign in as A, let data sync, log out, use as guest → A's net worth / transactions still shown.
- **Suspected:** `app/src/lib/api.ts:76-78`; `authLogout` in `StoreProvider.tsx:336-339` (no `clearPersisted()` / reset).
- **Fix:** on logout, `clearPersisted()` and re-init state (or namespace the storage key by user id).

### M6 — Unauthenticated OCR/statement endpoints: no rate limit, no size cap
- **Area:** backend
- **Description:** `/receipts/scan` and `/statements/scan` deliberately skip auth (guest support) but, unlike `/ai/chat`, call **no** `enforce_rate_limit`, and `await file.read()` with no size check before handing the bytes to Tesseract / pdf parsing. A scripted loop is unbounded CPU; a large upload is unbounded memory.
- **Suspected:** `backend/main.py:217-230`, `:239-260`.
- **Fix:** add `enforce_rate_limit(request, "ocr", …)` to both; reject `len(data)` over a few MB with 413.

### M7 — `PUT /state` persists arbitrary unvalidated JSON
- **Area:** backend
- **Description:** `body.state: dict | None` is `json.dumps`-ed straight into `user_state.state_json` with no schema / depth / size validation. An authenticated client can store an arbitrarily large or deeply nested blob.
- **Suspected:** `backend/main.py:85-86`, `:199-209`.
- **Fix:** validate against a Pydantic model mirroring `SyncPayload`; cap serialized size.

### M8 — Hardcoded fake notifications rendered as the user's own
- **Area:** UI
- **Description:** `NOTIFICATIONS` is a fixed 5-item array with concrete fabricated figures ("Lifestyle relief 87% used — RM 320 … left this year", "Invoice detected from Gmail — Astro Invoice RM 240.00 ready to review", "Net worth up 4.2% this month", "Popular Bookstore tagged deductible", "Dining budget 90% used — RM 45 left"). It renders for every user regardless of state, and `hasUnreadNotifs = NOTIFICATIONS.length > 0` is always true so the bell always shows an unread dot.
- **Repro:** Fresh guest → tap the bell. Confirmed live.
- **Suspected:** `app/src/lib/seedData.ts:102-108`; `app/src/screens/Home.tsx:38`; `app/src/screens/modals/NotifPanel.tsx:66`.
- **Fix:** derive notifications from real state, or ship an empty list + empty-state UI for users with no events.

### M9 — Settings "More" panel shows seed identity for a not-signed-in guest
- **Area:** UI
- **Description:** The profile card shows "**Aina Natasha** / aina.natasha@gmail.com" (hardcoded fallback) immediately above the line "Not signed in — data stays on this device." "Linked accounts — **6 accounts connected**" is shown after linking zero accounts; "Tax profile — **Resident · Single** · YA2025" is shown though neither residency nor marital status was chosen. (`initialState.ts` comments claim the "Aina Natasha placeholder" regression was fixed.)
- **Repro:** Fresh guest onboarding, leave Name blank → Home → gear icon. Confirmed live.
- **Suspected:** the profile/linked-accounts/tax-profile summary components in `screens/modals/MorePanel.tsx` (name fallback, hardcoded email, "6 accounts", default-labelled residency/marital).
- **Fix:** show a real empty/"Guest" state; count only actually-linked accounts; don't present unset profile fields as chosen values.

### M10 — Timezone inconsistency: `todayIso()`/`daysAgoIso()` are UTC, the rest is local
- **Area:** logic
- **Description:** `format.ts` `todayIso()` / `daysAgoIso()` slice `new Date().toISOString()` (UTC), while `dateGroupFor`, `computeAge`, `computeNextPayment`, `deriveTxDate` build dates from local components. For UTC+8 (Malaysia) before 08:00 local, `todayIso()` returns *yesterday*. Effects: the Record screen's default range `recordDateTo = todayIso()` can exclude a transaction the user just added and dated "today" (local), `isoToGroupLabel` mislabels today's row as a dated header, and the "Last 30 days" window is off by a day.
- **Suspected:** `app/src/lib/format.ts:43-53` vs `:108-117`, `:145-156`; `app/src/lib/constants.ts:327-349`.
- **Fix:** derive `todayIso()` from local components (`getFullYear`/`getMonth`/`getDate`) consistently, or make all date math UTC.

### M11 — Onboarding step-count denominator is unstable / wrong
- **Area:** UI
- **Description:** Header shows "Step N of **10**" through the tax steps, then "Step 10 of **11**" and "Step 11 of 11" once the manual-setup branch is taken. `OB_ORDER` actually has 13 entries; the conditional `txIncomeTypes` step and the link-vs-manual branch make a fixed denominator wrong either way.
- **Repro:** Walk onboarding via "I'll enter my finances manually instead" and watch the counter jump from "of 10" to "of 11". Confirmed live.
- **Suspected:** the step-indicator in `screens/onboarding/OnboardingFlow.tsx`.
- **Fix:** compute the denominator from the actual remaining path for the chosen branch, or drop the "of N".

---

## Low

### L1 — Onboarding consent links are dead (`href="#"`)
`OnboardingFlow.tsx:198` — "Terms & Conditions" and "Privacy Policy" on the consent step are `<a href="#">`; clicking only appends `#` and scrolls to top. The real `LegalModal` (`OPEN_LEGAL`) is wired in Settings but not here. User must tick "I agree" to documents they can't open. Confirmed live. Fix: use `actions.openLegal('terms'|'privacy')`.

### L2 — Tax-year dropdown offers future years 2027 & 2028
`Tax Center` year picker lists 2024–2028. No relief rules exist for future years; `prevTaxYear` arithmetic also runs for them. Confirmed live. Fix: cap at the current YA (or current+1 only if intended).

### L3 — "estimated at your 24% bracket based on your income" shown with no income entered
With blank income, `marginalRate` falls back to `ASSUMED_TAX_RATE` (0.24) but the Tax Center copy asserts it is "based on your income". `selectors.ts:419`. Confirmed live. Fix: reword when income is unknown, or prompt for income.

### L4 — `<input type="date">` accepts a 5-digit year
Typing into the segmented date field can yield year `12027`. `parseDisplayDate`'s `\d{4}` then fails to match, so on save the label silently falls back to the current year (`displayDateToIso`). Confirmed live (Add transaction date field). Fix: clamp year, or reject dates outside a sane range on save.

### L5 — Investment "1e6" scientific notation silently accepted; gain = full value when Buy price blank
Onboarding "Enter your finances" investment rows: `parseFloat('1e6')` → 1,000,000 (qty × cur uses `parseFloat`), and with Buy price empty the row shows "+RM 10,000,000" gain. Confirmed live. Fix: sanitize numeric inputs (`sanitizeRaw`-style) and guard the gain calc when buy is unset.

### L6 — `savingsTarget` onboarding field accepts arbitrary text and is then unused
"Monthly savings target" accepts `-500abc99` (plain text input, no `sanitizeRaw`). The value is stored in `SyncProfile` but read nowhere else in the app. `OnboardingFlow.tsx:353`. Fix: sanitize the input, or remove the dead field.

### L7 — Dark theme doesn't restyle an already-open BottomSheet
Toggling Appearance → Dark while the "More" sheet is open leaves that sheet white with dark text over a now-dark shell; re-opening it fixes it. Confirmed live. Fix: ensure sheet surfaces read theme tokens live (CSS custom properties on `:root`, not a captured value).

### L8 — `rate_limit._attempts` grows unbounded
`backend/rate_limit.py` — keys (`bucket:ip`) are never evicted, only their timestamp lists are filtered on access. Minor memory leak for a long-lived process. Fix: periodic sweep of empty/expired keys.

### L9 — lint: setState-in-effect / post-render reassignment warnings
`AmountKeypadSheet.tsx:49`, `CaptureStep.tsx:33` (`react(set-state-in-effect)` → cascading renders); `StatsSection.tsx:63` and `NetWorthSection.tsx:134-136` (`react(immutability)` — `cumulative` / `dragging` reassigned after render). Latent correctness risks flagged by oxlint. Fix: derive during render / move to state or refs.

### L10 — US-bank mock in a Malaysian app; `LINK_TARGETS` shows Chase/Citi
Onboarding "Connect your accounts" lists Chase, Citi, "Chase Freedom Visa", etc. Known UI mock (README notes no real linking), but incongruous for a Malaysia-only product and feeds the misleading "6 accounts connected" count in M9. `lib/constants.ts:194-210`.

---

## Notes on invariants explicitly checked

- **"Net Worth must never move when a transaction is reclassified"** — holds. `selectNetWorth` / `computeNetWorthTimeline` read only `state.netWorthSeed` and `state.ob.manual`, never `state.transactions` / `state.receipts`. Covered by `selectors.test.ts` ("selectNetWorth is never affected by receipts/transactions"). Verified by code review; not repro[d] any violation.
- **Receipt → transaction splitting** — sums exactly (Detailed mode sums line items; adjustment line is a normal savable line). Covered by `reducer.test.ts`. No rounding drift found.
- **`money()` / `moneyWhole()`** — correct 2dp / comma grouping; note both return the literal string `"NaN"` for a `NaN` input (no callers currently feed one, but no guard).
- **Amount keypad** — division by zero is handled (keeps prior operand), results rounded to 2dp. Robust.
