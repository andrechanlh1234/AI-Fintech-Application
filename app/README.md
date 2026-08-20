# Cukai v7 — web app

A real, functional implementation of the Cukai v7 Claude Design prototype
(`../Cukai v7.dc.html`): a personal finance + Malaysian tax app. Vite +
React + TypeScript frontend, with a real backend (`../backend/`) for
accounts, per-account data sync, and receipt OCR — see that directory's
notes below. The frontend still works fully standalone (guest/local-only
mode) if the backend isn't running.

## Run it

Frontend only (guest mode — data stays in this browser):

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks (tsc -b) then produces dist/
```

Full stack (real accounts + real receipt OCR — see `../backend/README.md`
for first-time setup):

```bash
# terminal 1, from the repo root
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000

# terminal 2
cd app && npm run dev
```

## What's implemented

- Full onboarding flow (login → tax profile → link/manual account setup →
  subscriptions → starting net worth)
- Home dashboard (net worth, monthly budget, insight card, recent activity)
- Finance tab: Net worth (chart + editable balances/investments), Record
  (calendar + transaction search/filter), Budgets (editable categories),
  Stats (category breakdown + drill-down)
- Tax Center: LHDN relief tracking by group/item, receipts, tax-year
  toggle (YA2026/YA2025), Tax Pack upsell
- AI chat assistant (chat + history, canned reply engine)
- Receipt scan flow (capture → processing → confirm → saved, with a
  live relief-impact preview) and bank-statement review/import flow
- Settings (subscriptions CRUD, theme, Face ID toggle, donate flow)

All of the above is genuinely interactive — adding/editing a balance,
budget item, or subscription updates every dependent number (net worth,
budget totals, tax relief %) immediately, and persists to
`localStorage` (`cukai_v7_data`) across reloads.

## Architecture

- `src/lib/` — pure data/constants ported from the design file: the LHDN
  tax engine (`taxEngine.ts`), seed data (`seedData.ts`), formatters,
  design-system constants. No React here.
- `src/store/` — a `Context` + `useReducer` store (`StoreProvider.tsx`,
  `reducer.ts`, `types.ts`) whose action names mirror the original
  prototype's methods 1:1, plus a pure `selectors.ts` layer (the
  `renderVals()` port) that screens read from.
- `src/components/` — shared primitives (`Card`, `Button`, `Tag`,
  `Toggle`, …) and `BottomSheet` for modal overlays.
- `src/screens/` — one file per screen/modal, each consuming the store
  via `useStore()` / `useActions()` and the relevant `select*` function.
- `src/styles/` — the design system's CSS custom properties, copied
  verbatim from `_ds/styles.css` plus the v7-specific overrides (accent
  green, dark theme) from the source file's inline `<style>` block.

Design note: the original prototype rendered everything inside a fixed
iPhone-bezel mockup (`ios-frame.jsx`). This app drops that chrome —
it's a real responsive web app (mobile and desktop), not a device
simulation.

## Known gaps / next steps

- **No public hosting.** The backend only runs on `localhost` right now —
  fine for development, not usable by anyone but the person running it.
- **No Google/Apple sign-in.** The buttons are present (matching the
  design) but say plainly that OAuth isn't set up — that needs a Google
  Cloud / Apple Developer account to configure.
- **No real bank-statement linking.** "Connect your accounts" during
  onboarding is still a UI mock; Malaysia has no Plaid-equivalent
  aggregator, so this would mean either a paid aggregator API or
  manual/CSV import (`../pipeline/statement_parser.py` already has
  working CIMB/TNG PDF and generic CSV parsing, also unwired).
- **AI replies are canned**, not a real LLM call (`aiCraftReply()` in
  `src/lib/seedData.ts`).

What *is* now real: accounts (email/password), per-account data sync
across sessions/devices, and receipt OCR via the backend — see
`../backend/README.md`.
