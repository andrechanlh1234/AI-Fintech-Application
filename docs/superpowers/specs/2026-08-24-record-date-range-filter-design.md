# Date-range filter for "All transactions"

## Context

The "All transactions" screen (`app/src/screens/finance/RecordSection.tsx`)
currently navigates by month + single day: a `MonthPicker` above a
horizontally-scrolling day-strip calendar, showing one selected day's
transactions at a time. A separate search box + category `FilterPicker`
narrow that day's list further.

The user wants this replaced with a date-range picker modeled on a
reference banking-app screenshot: a compact date-range pill + filter icon
in the header, both opening a bottom sheet with quick presets (Today,
Yesterday, Last 7/30/90 days, Last 1 year) and a custom from/to range. The
app already has a `BottomSheet` component (dimmed backdrop, rounded-top
sheet) that visually matches the reference's popup, so this is a new
picker component plus a rework of how the Record screen filters and
displays transactions — not a new overlay mechanism.

Scope check: `recordMonth`, `recordYear`, `selectedDayMonth`, `selectedDay`
are read/written only in `RecordSection.tsx` and the store
(`types.ts`, `initialState.ts`, `selectors.ts`, `reducer.ts`,
`StoreProvider.tsx`). No other screen depends on them, so this change is
fully contained to those six files plus one new component file.

## Decisions

**Replace, don't add alongside.** The month picker and day-strip are
removed entirely, replaced by the date-range pill + filter icon per the
user's explicit choice.

**Default range: last 30 days ending today.** Matches the reference
screenshot's default selected preset, and — unlike "current calendar
month" — behaves consistently regardless of which day of the month
someone opens the screen.

**Presets apply immediately and close the sheet.** One tap on a preset
sets the range and dismisses the sheet — no separate "Apply" step.

**Custom range uses native `<input type="date">`, styled as a pill.**
Not a custom-built calendar grid — the native picker is familiar, far
less code, and works well on mobile. Changing either date field updates
the range live (list re-filters immediately); the sheet stays open until
the user closes it via the X or an outside tap, since setting a custom
range means touching two fields.

**Reset button added per user request (2026-08-24 follow-up).** The
`DateRangeSheet` gets a "Reset" button (next to "Filter by date") that
reverts to the default range (last 30 days) and closes the sheet, so a
user who's drilled into a narrow custom range always has a one-tap way
back to the default view.

**Header copy is app-appropriate, not a literal copy of the reference.**
The reference reads "View transactions up to 1 year ago" because that
bank's API caps history at a year. Cukai keeps full history, so the sheet
header is simply "Filter by date" with an X to close — no fabricated
limitation.

**Day-level grouping, not month-level.** The reference groups rows under
a month header (e.g. "AUGUST 26") because each row already carries a
timestamp. Cukai's transaction records only carry day/month/year (no
time-of-day) — `deriveTxDate()` in `lib/constants.ts` confirms this,  and
nothing upstream produces finer-grained timestamps. Grouping only by
month would leave many same-month, different-day transactions
visually undifferentiated, so the list groups by day instead (header
"Today" / "Yesterday" / "17 Aug", reusing the existing short-date
format), each with its transactions beneath — same spirit as the
reference, adapted to the data that actually exists. No fabricated
per-row times are added.

**One summary line for the whole filtered range, not per group.**
Replaces today's single-day net line with a top-of-list line showing
result count + net total across the entire filtered range (date range +
search + category combined) — mirrors the existing "N results" line the
search-active branch already renders today, generalized to always apply.

## Component: `app/src/components/DateRangeSheet.tsx`

New component, following `FilterPicker.tsx` / `PeriodPicker.tsx`
conventions (pill buttons, `var(--color-accent)` family, `pressable`
class).

```tsx
function DateRangeSheet({
  open, from, to, defaultFrom, defaultTo, onChange, onClose,
}: {
  open: boolean;
  from: string;              // ISO 'YYYY-MM-DD'
  to: string;                // ISO 'YYYY-MM-DD'
  defaultFrom: string;
  defaultTo: string;
  onChange: (from: string, to: string) => void;
  onClose: () => void;
})
```

- Wraps content in the existing `<BottomSheet open onClose align="bottom">`.
- Header row: "Filter by date" (left), "Reset" text button + X icon button
  (right).
- Preset grid, 2 rows × 3 cols, each defined as an exact `[from, to]`
  pair (`today` = `todayIso()`, `daysAgo(n)` = today minus `n` days,
  both ISO strings):

  | Preset | from | to |
  |---|---|---|
  | Today | `today` | `today` |
  | Yesterday | `daysAgo(1)` | `daysAgo(1)` |
  | Last 7 days | `daysAgo(6)` | `today` |
  | Last 30 days | `daysAgo(29)` | `today` |
  | Last 90 days | `daysAgo(89)` | `today` |
  | Last 1 year | `daysAgo(364)` | `today` |

  ("Last N days" is inclusive of today, so it spans N calendar days
  total, not N+1 — matches the reference screenshot's default, where
  "Last 30 days" against a 24 Aug "today" shows 26 Jul as the start:
  24 Aug minus 29 days.) The preset matching the current `from`/`to` is
  highlighted (`--color-accent-100` bg / `--color-accent-700` text, same
  as `FilterPicker`'s active state); tapping a preset calls
  `onChange(presetFrom, presetTo)` then `onClose()`.
- Divider, then "Custom date range" label.
- Two pill-styled `<input type="date" />` (value bound to `from/to`,
  `onChange` fires `onChange(newFrom, to)` / `onChange(from, newTo)`
  immediately — sheet does not auto-close here), separated by a short
  dash.
- Reset button calls `onChange(defaultFrom, defaultTo)` then `onClose()`.

## Store changes

**`store/types.ts`**: remove `selectedDayMonth`, `selectedDay`,
`recordMonth`, `recordYear`. Add:

```ts
recordDateFrom: string; // ISO 'YYYY-MM-DD'
recordDateTo: string;   // ISO 'YYYY-MM-DD'
```

**`store/initialState.ts`**: replace the four removed fields' defaults
with `recordDateFrom`/`recordDateTo` computed as today minus 29 days /
today, in ISO form (reusing `todayIso()` from `lib/format.ts` plus a
small day-subtraction helper).

**`store/reducer.ts`**: remove the `SELECT_RECORD_DAY` and
`SET_RECORD_MONTH` action cases and their type union entries. Add:

```ts
| { type: 'SET_RECORD_RANGE'; from: string; to: string }
```

```ts
case 'SET_RECORD_RANGE':
  return { ...state, recordDateFrom: action.from, recordDateTo: action.to };
```

**`store/StoreProvider.tsx`**: remove `selectRecordDay`/`setRecordMonth`
action creators, add:

```ts
setRecordRange: (from: string, to: string) => dispatch({ type: 'SET_RECORD_RANGE', from, to }),
```

**`store/selectors.ts` (`selectRecordPage`)**: remove `calendarDays`,
`hasDataInMonth`, `selectedDayTx`/`Income`/`Expense`/`Net`/`Label`,
`recordMonthLabel`. Replace with:

- `rangeTx`: `combinedTx` filtered where the transaction's derived ISO
  date falls within `[state.recordDateFrom, state.recordDateTo]`
  (inclusive), AND matches `state.txFilter` (category) AND
  `state.txSearch` (merchant substring) when active — folding today's
  separate "search active" branch into one always-on filter path.
- `groupedTx`: `rangeTx` sorted newest-first, grouped by day into
  `{ label: string; items: RecordTx[] }[]` (`label` = "Today" /
  "Yesterday" / "17 Aug", via a small helper reusing the existing
  short-date formatting already used for `dateLabel`).
- `rangeCount`, `rangeNet`: total result count and net amount across
  `rangeTx`, for the single summary line.
- `categoryChips`: unchanged.

## `RecordSection.tsx` changes

- Remove: `MonthPicker` usage, the day-strip rail (`railRef`,
  `scrollCalendar`, the whole rail `<div>` block), `searchActive`
  branching.
- Add, in place of the removed month/day-strip block: a row with the
  date-range pill (formatted e.g. "26 Jul – 24 Aug", chevron) and a
  filter icon button (sliders icon, matching the reference), both calling
  `setOpen(true)` on a local `[sheetOpen, setSheetOpen]` state; render
  `<DateRangeSheet open={sheetOpen} from={state.recordDateFrom}
  to={state.recordDateTo} defaultFrom={...} defaultTo={...}
  onChange={actions.setRecordRange} onClose={() => setSheetOpen(false)} />`
  once at the bottom of the component (same pattern as other modals in
  `screens/modals/`).
- List rendering: one summary line ("`{rangeCount}` results", net amount),
  divider, then `groupedTx.map(...)` — a day-header line per group,
  followed by that group's `TxRow`s (unchanged `TxRow` component).
- Search box + category `FilterPicker` row: unchanged, stays directly
  above the list.

## Error handling

No new failure modes — this is client-side filtering over data already in
the store. The one edge case: if `from` is after `to` (user picks a start
date past the end date, or vice versa, via the two independent native
date inputs), `onChange` swaps them before dispatching so `recordDateFrom
<= recordDateTo` is always maintained — avoids an empty/inverted range
silently showing zero results with no explanation.

## Testing / verification

No frontend test framework exists in this repo (confirmed: no `test`
script in `app/package.json`, no `*.test.ts*` files). Verification is
manual, run against the dev server:

- Both triggers (date pill, filter icon) open the sheet.
- Each preset filters correctly and closes the sheet; the correct preset
  is highlighted when reopening the sheet after picking one.
- Custom range: picking start/end dates filters live; picking an
  inverted range (end before start) doesn't produce a broken empty state.
- Reset button returns to the last-30-days default and closes the sheet.
- Search + category filter still narrow the range-filtered list
  correctly.
- Day grouping headers are correct ("Today"/"Yesterday"/"D Mon") and
  ordered newest-first.
- No other screen (Stats, Home dashboard, etc.) regresses — none of them
  read the removed fields, but worth a click-through since they share
  `combinedTx`/`deriveTxDate`.
