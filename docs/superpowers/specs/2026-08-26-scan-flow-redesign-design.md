# Scan-receipt flow redesign

## Context

The user provided 13 reference screenshots (`Ryt AI sample/IMG_4456.PNG`
through `IMG_4468.PNG`, from a competing Malaysian fintech app "Ryt AI")
and asked for the receipt-scan flow to be redesigned to match, across 7
points: camera screen with subtle border + camera/flash buttons, a
photo/file picker, a circular loading screen, a post-capture preview step,
an "unable to scan" fallback screen, a restyled expense-details form
(keeping the app's own big-amount input, adding an Expense name +
Vendor/Merchant field), and a full-page category picker.

The current implementation lives entirely in
`app/src/screens/modals/ScanFlow.tsx` (530 lines), a single component
that switches on `state.scanStep` (`'capture' | 'processing' | 'review' |
'saved'`) and inline-renders each step. It's the only file touched by
this change other than the store (`types.ts`, `reducer.ts`,
`StoreProvider.tsx`) and `lib/receipts.ts` for the new `vendor` field.

## Scope decisions

- **Category taxonomy stays at 7 categories** (Food & Drink, Transport,
  Shopping, Bills, Health, Lifestyle, Other) — restyled as a full-page
  grid, not expanded to the reference's ~26-category grouped taxonomy.
  Keeps this change contained to the scan flow; no touching tax-relief
  mapping, icons, or other screens' category lists.
- **Failed scans get a dedicated interstitial**, not today's silent
  drop-into-manual-form-with-banner.
- **Flash button controls the real device torch** where the browser
  exposes `MediaStreamTrack.getCapabilities().torch`; the button simply
  doesn't render where it isn't supported (notably iOS Safari, which is
  what the reference screenshots themselves are from — the web torch API
  isn't available there at all, so this is a graceful no-op rather than a
  broken control).
- **Photo/File picker stays image-only.** Matches what
  `scanReceiptImage` already supports; no PDF/OCR pipeline changes.
- **Expense name is the primary/display field** (keeps today's
  `merchant` field's role — shows in transaction lists, the Saved
  screen, etc.). **Vendor/Merchant is new, optional metadata**, stored on
  `Receipt` only — not threaded into `Transaction` or other screens.
- **Suggestion chips added** under Expense name (Lunch, Groceries,
  Transport, Coffee — one-tap fill).
- **Loading screen fully replaced** with a centered circular spinner over
  the dimmed camera background — the receipt-skeleton/scan-sweep
  animation is dropped, not layered under the spinner.

## Step machine

```
capture → preview → processing → review → saved
                          ↓           ↑
                        unable ───────┘ (Add custom amount)
                          ↑
                     (Snap again returns to capture from either
                      preview or unable)
```

`ScanStep` type becomes:
`'capture' | 'preview' | 'processing' | 'unable' | 'review' | 'saved'`

The category picker is **not** a step in this machine — it's a
same-screen overlay toggled by local component state
(`categoryPickerOpen`) inside the review step, so closing it always
returns to the exact in-progress review state with zero reducer
involvement.

## File structure

```
src/screens/modals/scan/
  shared.tsx                 — chipStyle, DateChips, PaymentBadge, PaymentChips
                                (moved from ScanFlow.tsx, unchanged logic)
  CaptureStep.tsx             — camera viewfinder (points 1, 2)
  PreviewStep.tsx              — snap again / continue (point 3, NEW)
  ProcessingStep.tsx           — circular spinner (point 4)
  UnableToScanStep.tsx         — NEW (point 5)
  ReviewStep.tsx                — expense details form (point 6)
  CategoryPickerOverlay.tsx     — full-page category grid (point 7, NEW)
  SavedStep.tsx                  — unchanged, relocated as-is
```

`ScanFlow.tsx` shrinks to an orchestrator: holds the local
capture-preview state (see below), the live-camera `useEffect`/refs
(capture concerns stay here since `CaptureStep` and `PreviewStep` both
need them), and a switch rendering the step matching `state.scanStep`.

## Data model changes

**`store/types.ts`**
```ts
export type ScanStep = 'capture' | 'preview' | 'processing' | 'unable' | 'review' | 'saved';
```

**`lib/receipts.ts`**
```ts
export interface ReceiptDraft {
  merchant: string;   // "Expense name" in the UI — unchanged role
  vendor: string;      // NEW — "Vendor/Merchant", optional
  // ...unchanged fields
}
export interface Receipt {
  // ...unchanged fields
  vendor?: string;      // NEW — persisted from ReceiptDraft.vendor
}
```
`blankReceiptDraft` gains `vendor: ''`. `SAVE_RECEIPT` in `reducer.ts`
copies `draft.vendor` onto the created `Receipt`; `Transaction` is
untouched (no `vendor` field there — out of scope).

**`store/reducer.ts`** — new action types and cases:
```ts
| { type: 'PREVIEW_CAPTURED_PHOTO' }
| { type: 'RETAKE_PHOTO' }
```
- `PREVIEW_CAPTURED_PHOTO` → `{ ...state, scanStep: 'preview' }`
- `RETAKE_PHOTO` → `{ ...state, scanStep: 'capture', scanError: null }`
  (used by "Snap again" from both `preview` and `unable`)
- `CAPTURE_PHOTO_FAILED` changes its target from `scanStep: 'review'`
  (+ `scanMethod: 'manual'`) to `scanStep: 'unable'` — `scanMethod` is
  left as whatever it already was; it only becomes `'manual'` when
  "Add custom amount" fires the existing `CHOOSE_MANUAL` action.

**Captured-but-not-yet-submitted photo** (the file shown on the preview
screen) is **local `useState` in `ScanFlow`**, not reducer state —
consistent with the existing `videoRef`/`streamRef` pattern, and it
avoids putting a non-serializable `File`/object-URL into state that
`reducer.test.ts` exercises with plain-object equality checks.
```ts
const [pendingPhoto, setPendingPhoto] = useState<{ file: File; url: string } | null>(null);
```
Capturing (from live video or the file input) sets `pendingPhoto` and
dispatches `PREVIEW_CAPTURED_PHOTO` — it does **not** call
`capturePhotoFile` yet. `PreviewStep`'s "Continue" button calls the
existing `actions.capturePhotoFile(pendingPhoto.file)` (unchanged
action — starts `CAPTURE_PHOTO_START` → OCR call → `CAPTURE_PHOTO_RESULT`/
`CAPTURE_PHOTO_FAILED`). "Snap again" revokes the object URL, clears
`pendingPhoto`, and dispatches `RETAKE_PHOTO`.

**New action-creators in `StoreProvider.tsx`:**
```ts
previewCapturedPhoto: () => dispatch({ type: 'PREVIEW_CAPTURED_PHOTO' }),
retakePhoto: () => dispatch({ type: 'RETAKE_PHOTO' }),
```

## Step-by-step behavior

### 1–2. CaptureStep
Keeps the live `getUserMedia` viewfinder, dark gradient background, and
file-input fallback for non-secure contexts exactly as today. Changes:
- Corner-bracket frame restyled thinner (2px vs current 3px) and more
  rounded, matching the reference's subtler look — same four-corner
  approach, no new mechanism.
- The bottom-left gallery icon no longer immediately opens the file
  picker; it opens a small bottom sheet (reusing the existing
  `BottomSheet` component) with two rows: "Photo" (opens the existing
  image file input, no `capture` attribute so it browses the gallery)
  and "File" (opens a second file input, also `accept="image/*"`, no
  `capture` attribute — same pipeline, different button, per the
  image-only scope decision).
- A flash button (bottom-right, mirroring the existing capture button's
  circular style) renders **only when** the active `MediaStreamTrack`'s
  `getCapabilities()` includes `torch`. Tapping it toggles local state
  and calls `track.applyConstraints({ advanced: [{ torch: <bool> }] })`;
  the promise rejection path (unsupported mid-session) is caught and
  silently reverts the toggle state.
- Capturing (shutter tap or a file picked from Photo/File) no longer
  calls `capturePhotoFile` directly — it builds `{ file, url:
  URL.createObjectURL(file) }`, sets `pendingPhoto`, and dispatches
  `previewCapturedPhoto()`.

### 3. PreviewStep (new)
Renders `pendingPhoto.url` full-frame (object-fit: contain, dark
background). No expand-to-fullscreen affordance — the reference's corner
icon for that isn't part of the 7 requested points, so it's left out.
Two buttons: "Snap again" (outline) → clears preview + `retakePhoto()`;
"Continue" (filled) → `capturePhotoFile(pendingPhoto.file)`.

### 4. ProcessingStep
Dimmed/frozen capture background (reuse the last video frame or the
`pendingPhoto.url` still image — simpler and avoids re-touching the
live `<video>` element after the stream may have been released) with a
centered CSS circular spinner (border-based, matches existing app
motion patterns) and the existing "Reading your receipt..." copy below
it. The receipt-skeleton/scan-sweep block is deleted, not hidden.

### 5. UnableToScanStep (new)
Matches the reference's copy pattern generically (not a literal string
copy): a warning-triangle icon as an inline SVG (same pattern as the
existing mismatch-warning icon in `ReceiptLineItemsEditor.tsx`, and the
same inline-SVG-icon convention `ScanFlow.tsx` already uses throughout —
no new icon library or asset import), "Unable to read receipt" heading,
one line of static explanatory text. Two buttons: "Snap again" (filled,
primary — matches reference's emphasis) → `retakePhoto()`; "Add custom
amount" (outline) → `actions.chooseManual()` (existing action/reducer
case, unchanged — lands on a blank manual `ReviewStep`). The raw
`scanError` message is still captured in state for potential future
debug/analytics use but is not rendered to the user here.

### 6. ReviewStep
Restructured card layout:
1. **Expense name** — `<input>` labelled "Expense name" (was
   "Merchant"), bound to `receiptDraft.merchant` via the existing
   `setReceiptDraftField('merchant', …)` action — no reducer change
   needed here since the field's role is unchanged.
2. **Suggestion chips** — a small row (Lunch, Groceries, Transport,
   Coffee) using the existing `chipStyle` helper; tapping one calls
   `setReceiptDraftField('merchant', label)`.
3. **Vendor/Merchant** — new `<input>` bound to the new
   `receiptDraft.vendor` via `setReceiptDraftField('vendor', …)`,
   stacked directly below Expense name (per the "stacked" layout
   decision), optional (no validation blocking save).
4. **Amount** — unchanged `HeroAmountInput`, kept exactly as today per
   explicit request.
5. **Category row** — replaces the current inline `CategoryChips` grid
   with a single row: icon (via existing `iconFlags`/`TxIcon`) + current
   category name + chevron. Tapping it sets local
   `categoryPickerOpen = true`.
6. Date chips, payment-method chips, quick/detailed toggle, line-items
   editor — all unchanged from today.

### 7. CategoryPickerOverlay (new)
Full-screen overlay (same absolute-positioned layering pattern
`ScanFlow` already uses for its steps) rendered on top of `ReviewStep`
when `categoryPickerOpen`. Single ungrouped 3-column grid of the 7
`RECEIPT_CATEGORY_OPTIONS`, each cell reusing `TxIcon`/`iconFlags` (same
icons already used by `CategoryChips` today) + label. Tapping a category
calls `setReceiptDraftField('quickCategory', cat)` and immediately
closes the overlay (`categoryPickerOpen = false`) — no separate confirm
step, matching the reference's apparent tap-to-select-and-return
pattern. A back chevron in the header also just closes the overlay
without changing the selection.

## Testing

- `store/reducer.test.ts`: new `describe` blocks for
  `PREVIEW_CAPTURED_PHOTO`, `RETAKE_PHOTO`, and `CAPTURE_PHOTO_FAILED`'s
  new `'unable'` target — following the file's existing style (plain
  reducer calls + assertions on the returned state slice).
- No unit-testable coverage exists for camera/hardware behavior (live
  video capture, torch). The full flow (capture → preview → processing →
  review/unable → saved, including the torch button's conditional
  visibility and the Photo/File bottom sheet) will be manually verified
  in a real browser per the project's existing UI-testing convention.
