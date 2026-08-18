# Cukai v7 — web app

A real, functional implementation of the Cukai v7 Claude Design prototype
(`../Cukai v7.dc.html`): a personal finance + Malaysian tax app. Vite +
React + TypeScript, client-side only, with a local-storage-backed mock
data layer standing in for a future backend.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks (tsc -b) then produces dist/
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

- **No backend.** Everything reads/writes `localStorage`. The mock data
  shape (`RecordRow`, `Transaction`, etc. in `src/lib/seedData.ts`) was
  deliberately kept close to `../pipeline/models.py`'s `Record`
  dataclass so a real API can slot in later without a data-model rewrite.
- **OCR is simulated.** The scan flow's "processing" step is a timed
  placeholder; `../pipeline/receipt_ocr.py` has real Tesseract-based OCR
  logic that isn't wired up yet.
- **AI replies are canned**, not a real LLM call (`aiCraftReply()` in
  `src/lib/seedData.ts`).
- **Gmail invoice detection, multi-user auth, and the Supabase backend**
  described in `../Feasibility_and_Implementation_Timeline.md` are not
  built — intentionally, per that document's own recommendation not to
  build backend infra before the frontend proves the product out.
