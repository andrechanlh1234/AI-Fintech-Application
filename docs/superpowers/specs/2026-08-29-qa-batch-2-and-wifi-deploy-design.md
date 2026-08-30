# QA batch 2 (camera motion, home icons, finance NW, AI assistant, Groq) + wifi live-reload

Branch: `fix/qa-findings-2026-08-28`

## Overview

7 approved UI/QA fixes plus 3 workflow items that unblock on-device
testing. Each of the 7 is a self-contained, `cap`-buildable change and
gets its own commit (see **Commit plan**); the workflow items B/C setup
is committed separately by the main session.

Product-owner decisions already made:

- **Finance:** hide the Property + Liabilities sections from
  `NetWorthSection`, but keep the net-worth math untouched — the headline
  figure still nets out credit-card debt (and still includes property
  value in `assets`).
- **AI model:** primary is Groq `llama-3.3-70b-versatile` (OpenAI-compatible
  `/chat/completions`); the client-side canned reply (`aiCraftReply`) stays
  the fallback; the existing Gemini path is retained as an optional middle
  tier.
- **AI Assistant stays a bottom tab** — not converted to a modal.
- **AI chip content** (exact strings):
  1. "How much tax relief can I still claim?"
  2. "Am I on track with my budget this month?"
  3. "What's my net worth trend?"
  4. "Where am I overspending?"

---

## Item 1 — Camera open black-screen glitch

**Cause.** `CaptureStep` gets the stream at 4K via `HD_VIDEO_CONSTRAINTS`
(`CaptureStep.tsx:16-22`, already `width/height: { ideal: 3840/2160 }` +
`advanced: [{ focusMode: 'continuous' }]`), then inside the same
`getUserMedia().then(...)` immediately fires a **second**
`vtrack.applyConstraints({ width: { ideal: 3840 }, height: { ideal: 2160 }, … })`
whenever the live track reports `< 1920` wide (`CaptureStep.tsx:61-64`).
That forces a stream renegotiation right as the `<video>` is coming up →
a dropped/black frame on open. It's compounded by the hard `#0b0c0b`
capture surface (`CaptureStep.tsx:130`) snapping in over `ScanFlow`'s
light `var(--color-bg)` container (`ScanFlow.tsx:64`) — a white→black
flash.

**Changes.**

- `CaptureStep.tsx`: delete the follow-up re-upscale block
  (`CaptureStep.tsx:57-64` — the comment plus the `const vtrack` /
  `const s` / `if (… < 1920) vtrack.applyConstraints(...)`). Keep
  `setLiveCameraReady(true)` and the torch-capability probe that follows
  (`CaptureStep.tsx:65-70`, `const track` / `getCapabilities` /
  `setTorchSupported`).
- `CaptureStep.tsx:139`: lengthen and ease the viewfinder reveal —
  `transition: 'opacity .35s ease-out'` (from `'opacity .25s ease'`). The
  `opacity: liveCameraReady ? 1 : 0` stays. This is opacity-only, so it is
  already reduced-motion-safe; no extra guard needed.
- Kill the white→black flash in **`ScanFlow.tsx`**: make the overlay
  container dark while the capture step is showing. On the root `<div>`
  (`ScanFlow.tsx:60-67`) change
  `background: 'var(--color-bg)'` →
  `background: state.scanStep === 'capture' ? '#0b0c0b' : 'var(--color-bg)'`.
  (`state` is already in scope from `useStore()`.) This is the chosen
  approach — one line, no new state, and the later steps
  (`preview`/`processing`/`review`/`saved`) keep the light ground they
  expect.
- `prefers-reduced-motion`: honoured for free — the only remaining motion
  is the `.35s` opacity fade, which is the app's standard reduced-motion
  substitute anyway.

---

## Item 2 — Camera close has no animation

**Cause.** `ScanFlow` unmounts synchronously: `if (!state.scanOpen) return null;`
(`ScanFlow.tsx:58`). The overlay just vanishes.

**Changes.** Adopt the "linger past close" pattern already used by
`BottomSheet` (`app/src/components/BottomSheet.tsx:44-61`):

- In `ScanFlow`, add local `rendered` state:
  `const [rendered, setRendered] = useState(state.scanOpen);`
  then `if (state.scanOpen && !rendered) setRendered(true);` during render
  and `const closing = rendered && !state.scanOpen;`.
- Effect: when `closing`, `setTimeout(() => setRendered(false), ms)` with
  `ms = prefersReducedMotion() ? 120 : 280` (import `prefersReducedMotion`
  from `../../lib/motion`); clear the timeout on cleanup. Replace
  `if (!state.scanOpen) return null;` with `if (!rendered) return null;`.
- On the root `<div>` (`ScanFlow.tsx:60-67`), append `scan-out` to the
  className while `closing`:
  `className={\`screen-in\${closing ? ' scan-out' : ''}\`}`.
- `app/src/styles/tokens.css`, in the premium-motion section (after the
  `sheet-*` / `spring-pop-out` keyframes, ~line 545):

  ```css
  @keyframes scan-out {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(12px) scale(.98); }
  }
  .scan-out { animation: scan-out .28s cubic-bezier(.16,1,.3,1) both; }
  ```

  Add `.scan-out` to the closing-animation list in the section's final
  `@media (prefers-reduced-motion: reduce)` block (`tokens.css` ~line 625,
  the block that already remaps `.page-enter-forward, .sheet-panel, …` to
  `reduced-fade-in` at 120 ms).
- **Only animates on a genuine close.** The `scan-out` class is driven
  purely by `state.scanOpen === false` while `rendered === true`. The
  inner step transitions (`capture → preview → …`) only change
  `state.scanStep`, never `state.scanOpen`, so stepping through the flow
  never triggers it. `handleClose` (`ScanFlow.tsx:48-51`, the X / back
  button) is the only path that calls `actions.closeScan()`.

---

## Item 3 — Home "Recent activity" rows missing icons (e.g. Shell)

**Cause.** `Home.tsx` re-implements badge rendering inline in the
`dash.recentTx.map(...)` block (`Home.tsx:172-190`): it renders
`tx.hasBrand && tx.badgeLetter` then seven hardcoded SVG flags from a
local `ICONS` map (`Home.tsx:8-30` / `Home.tsx:176-182`) — `isCar`,
`isCoffee`, `isBag`, `isZap`, `isMedical`, `isBook`, `isArrowUp`. It never
renders the `emoji` fallback. A category that has a `CAT_EMOJI` glyph but
no `CAT_ICON` entry (Petrol `⛽` at `constants.ts:71`, plus Groceries,
Insurance, Home, Family, …) draws an empty circle. "Shell" → category
"Petrol" (`app/src/lib/trialData.ts` `CATEGORY_PROFILES`) → no brand, no
SVG flag → blank badge.

`TxIcon` in `TransactionRow.tsx` already handles all of this, including
the `tx.emoji` fallback (`TransactionRow.tsx:33`).

**Changes.**

- `Home.tsx`: `import { TxIcon } from '../components/TransactionRow';`.
- Replace the badge contents inside the `recentTx` row `<div>`
  (`Home.tsx:174-183`) — the `{tx.hasBrand && tx.badgeLetter}` line and
  all seven `{tx.isX && ICONS.x}` lines — with a single
  `<TxIcon tx={tx} />`. Keep the wrapper `<div>` (size 34, `tx.badgeBg` /
  `tx.badgeFg`).
- Delete the now-unused local `ICONS` constant (`Home.tsx:8-30`).
- No selector change. `recentTx` already spreads `...rowBadge(t)`
  (`selectors.ts:390`); `rowBadge` spreads `iconFlags` (`constants.ts:328-329`)
  which sets `emoji` from `CAT_EMOJI` (`constants.ts:316`).
- Type check: `TxIcon`'s prop is
  `RowIconProps = IconFlags & { hasBrand: boolean; badgeLetter: string }`
  (`TransactionRow.tsx:4`). A `recentTx` element is `{ ...t, ...rowBadge(t), … }`
  and `RowBadge extends IconFlags` with `hasBrand` + `badgeLetter`
  (`constants.ts:322-324`), so the shape already satisfies it.

---

## Item 4 — Finance: remove Property + Liabilities sections (math unchanged)

**Cause / scope.** Display-only removal in `NetWorthSection.tsx`. The
`selectNetWorth` selector is **not** touched.

**Changes.**

- Remove the "Liabilities" stat block (`NetWorthSection.tsx:305-308` — the
  `<div>` wrapping the `Liabilities` label + `AnimatedNumber value={nw.liabilities}`).
  Keep the "Total assets" block (`NetWorthSection.tsx:300-304`). The
  containing flex row (`NetWorthSection.tsx:300`) then holds one stat.
- In the groups render (`NetWorthSection.tsx:313-348`), show only the
  `cash` and `invest` groups. Filter in the component:
  `nw.groups.filter((g) => g.key === 'cash' || g.key === 'invest').map((grp) => …`.
- Remove the now-dead `AddLink` branches for `grp.key === 'other'` and
  `grp.key === 'liab'` (`NetWorthSection.tsx:341-342`). Keep the `cash`
  ("Add account") and `invest` ("Add investment") branches.
- **Do NOT touch `selectNetWorth`** (`selectors.ts:55-104`). `assets =
  cashTotalVal + investTotalVal + otherAssetsTotalVal`, `liabilities =
  liabTotalVal`, `netWorth = assets - liabilities` all stay — so the
  headline net worth still subtracts card debt (and still adds hidden
  property value, per the decision). `nw.groups` still contains all four
  keys; only the render filters.
- `BalanceDetailModal` / `InvestDetailModal` open by `listKey` via
  `openRow` (`NetWorthSection.tsx:179-183`); nothing there references the
  hidden groups, so they are unaffected.

---

## Item 5 — Home net-worth card tap: disliked "downward flow" animation

**Cause.** The Home net-worth card's `onClick` calls
`captureSharedOrigin(e.currentTarget)` then `actions.goFinanceNetWorth()`
(`Home.tsx:93`). On mount, `NetWorthSection` calls
`playSharedMorph(morphRef.current)` (`NetWorthSection.tsx:188`).
`playSharedMorph` (`motion.ts:146-187`) flies a clone of the small source
card and scales it with `transform-origin: top left` by
`sy = dest.height / origin.rect.height` (`motion.ts:168`) — the Net worth
screen header is far taller than the Home card, so `sy` ≈ 4–5× and the
clone visibly stretches downward as it fades. That vertical stretch is the
"downward flow".

**Changes.**

- `Home.tsx:93`: drop the `captureSharedOrigin(e.currentTarget);` call —
  `onClick={() => actions.goFinanceNetWorth()}`. Remove the now-unused
  `import { captureSharedOrigin } from '../lib/motion';` (`Home.tsx:6`) —
  it is the only use of it in the file.
- `NetWorthSection.tsx`: remove `morphRef`
  (`NetWorthSection.tsx:187`), the `useEffect(() => { playSharedMorph(morphRef.current); }, [])`
  (`NetWorthSection.tsx:188`), and drop `playSharedMorph` from the
  `../../lib/motion` import (`NetWorthSection.tsx:7`). The outer
  `<div ref={morphRef}>` (`NetWorthSection.tsx:191`) becomes a plain
  `<div>`.
- Keep `captureSharedOrigin` in the `../../lib/motion` import for
  `NetWorthSection.tsx` — `NwRowView` still uses it
  (`NetWorthSection.tsx:39`).
- With no pending shared origin, `PageTransition` (which wraps the tab
  panes in `App.tsx:57`) sees `hasPendingSharedOrigin() === false`
  (`PageTransition.tsx:29`) and runs its normal `page-enter-forward` —
  14 px slide + crossfade, `.22s cubic-bezier(.2,.7,.2,1)`
  (`tokens.css` ~line 532). That is the intended "subtle and smooth"
  result; no new animation.
- Leave `captureSharedOrigin` / `playSharedMorph` in `motion.ts` intact —
  still used by balance rows, `NwRowView`, and `TransactionRow`
  (`TransactionRow.tsx:57`).

---

## Item 6 — AI assistant: Groq Llama 3.3 70B + canned fallback

**Cause.** `backend/ai_chat.py` calls Gemini `gemini-3.6-flash`
(`ai_chat.py:33`) with a hidden thinking budget; the in-file comment notes
~40 s at default effort, past the 45 s timeout, so replies routinely fell
back to canned. `/ai/chat` (`backend/main.py:286-298`) already catches
`GeminiNotConfigured` and any other exception and returns
`{"reply": None, "source": "canned"}`, and the frontend already falls back
to `aiCraftReply` (`seedData.ts:141`) on `source: "canned"` or a thrown
request. There is **no client-side fetch timeout** (`api.ts:33-49`
`request()` just `await fetch(...)`), so backend latency is the entire
problem — Groq at ~1 s fixes it.

**Changes.**

- `backend/ai_chat.py`:
  - New env: `GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")`,
    `GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")`
    (next to the existing `GEMINI_*` reads, `ai_chat.py:30-33`).
  - New `generate_ai_reply_groq(user_text, history, context)`:
    `httpx.post("https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
    json={"model": GROQ_MODEL, "messages": messages, "temperature": 0.4,
    "max_tokens": 800, "stream": False}, timeout=20)`.
    `messages` = `[{"role": "system", "content": system_text}]`
    + history mapped (`m.get("from") == "user"` → `"user"`, else
    `"assistant"`; last 10, same slice as today at `ai_chat.py:80`)
    + `{"role": "user", "content": user_text}`.
    `system_text` = `SYSTEM_PROMPT` (`ai_chat.py:37-58`) plus, when
    `context` is truthy,
    `"\n\nReal data snapshot (JSON):\n" + json.dumps(context)` — identical
    to `ai_chat.py:75-77`.
    `res.raise_for_status()`; parse
    `data["choices"][0]["message"]["content"].strip()`; raise
    `RuntimeError` on no choices / empty content (mirrors
    `ai_chat.py:111-117`).
  - Exception naming: introduce a shared base `class AiNotConfigured(Exception)`
    and keep `class GeminiNotConfigured(AiNotConfigured)` so
    `backend/main.py:30`'s import keeps working; add
    `class GroqNotConfigured(AiNotConfigured)`.
  - Rework the public `generate_ai_reply(user_text, history, context)`
    (`ai_chat.py:65-118`): if `GROQ_API_KEY` → `generate_ai_reply_groq(...)`;
    elif `GEMINI_API_KEY` → existing Gemini body; else raise
    `AiNotConfigured`. Any HTTP/parse failure propagates unchanged so the
    caller falls back to canned. Keep the "never returns a placeholder"
    contract and the module `logger` setup (`ai_chat.py:22-27`).
  - Update the module docstring (`ai_chat.py:1-14`) to describe Groq as
    primary, Gemini as optional, canned as fallback.
- `backend/main.py` `/ai/chat` (`main.py:286-298`): import
  `AiNotConfigured` from `backend.ai_chat` (`main.py:30`). Have
  `generate_ai_reply` return `(reply, source)` with
  `source ∈ {"groq", "gemini"}` and update the one call site to
  `return {"reply": reply, "source": source}`. `except AiNotConfigured:`
  and `except Exception:` both keep returning
  `{"reply": None, "source": "canned"}` (with the existing distinct log
  lines). Rate limit unchanged (`max_attempts=20, window_seconds=10*60`).
- `app/src/lib/api.ts`: widen `AiChatResponse.source` (`api.ts:197`) to
  `'groq' | 'gemini' | 'canned'`. No behavioural change — the client only
  branches on `reply == null` / `source === 'canned'`.
- Docs: new `backend/GROQ_SETUP.md` — free key at
  https://console.groq.com/keys, add `GROQ_API_KEY=...` to `backend/.env`,
  restart the backend; note the free-tier RPM/TPM limits and that the app
  silently falls back to canned replies when the key is absent or the call
  fails. Add a one-line pointer to it from the top of
  `backend/GEMINI_SETUP.md`.
- No other frontend wiring — `AiChat` already goes through
  `requestAiReply` → `request('/ai/chat', …)` (`api.ts:210-220`).

---

## Item 7 — AI Assistant page layout (stays a bottom tab)

**Reference.** User screenshot of Ryt AI: greeting vertically centred,
suggestion chips as a scrollable pill row just above the input, input
pinned to the bottom, keyboard open.

All changes in **`app/src/screens/ai/AiChat.tsx`** unless noted.

**Note on `AI_SUGGESTIONS`.** It is currently a **local `const` in
`AiChat.tsx:4-8`**, *not* an export of `seedData.ts` (there is no
`AI_SUGGESTIONS` there — `seedData.ts` only has `aiCraftReply` and
`AI_CHAT_HISTORY`). So this item edits the local array in place: replace
the 3 strings at `AiChat.tsx:4-8` with the 4 approved strings from
**Overview**. (Moving it into `seedData.ts` is optional and out of scope.)

**Changes.**

- **Centred greeting.** The `isChat` branch is already a
  `flex: 1` column (`AiChat.tsx:128`) with a `flex: 1` messages/empty
  wrapper (`AiChat.tsx:129`). When `hasNoMessages`, give that wrapper
  `justifyContent: 'center'` (keep `display: 'flex'; flexDirection: 'column'`)
  so the greeting block sits centred in the visible area. The greeting
  block (`AiChat.tsx:130-177`) keeps the sparkle badge + heading + the
  "I can see your accounts, budgets, receipts and tax profile." line
  (`AiChat.tsx:149-151`); change the heading text (`AiChat.tsx:148`) from
  "Ask me anything" to **"How can I help today?"**.
- **Chips move out of the centred block to a row directly above the input
  row.** Remove the chips `<div>` (`AiChat.tsx:152-175`) from inside the
  greeting block. Render a new chips row as a sibling immediately before
  the input row (`AiChat.tsx:206`), only when `isChat && hasNoMessages`.
  Style: `display: 'flex'`, `gap: 8`, `overflowX: 'auto'`,
  `WebkitOverflowScrolling: 'touch'`, `flexWrap: 'nowrap'`,
  small bottom margin. Each chip button:
  `borderRadius: 999`, `border: '1.5px solid var(--color-neutral-300)'`,
  `background: 'var(--color-surface)'`, `whiteSpace: 'nowrap'`,
  `padding: '8px 14px'`, `fontSize: 12.5`, `flexShrink: 0`,
  `onClick={() => actions.submitAiText(label)}` (unchanged from
  `AiChat.tsx:157`).
- **Input row** stays pinned at the bottom — it already is
  (`AiChat.tsx:206`, `flexShrink: 0` with a top border). Keep placeholder
  "Ask about your spending, tax, budget…" (`AiChat.tsx:218`).
- **Keyboard auto-open.**
  - Add `const inputRef = useRef<HTMLInputElement>(null);` and put
    `ref={inputRef}` + `autoFocus` on the `<input>` (`AiChat.tsx:207-220`).
  - `useEffect(() => { if (isChat) inputRef.current?.focus(); }, [isChat]);`
  - After a chip tap, and after `state.aiTyping` transitions to `false`
    (reply arrived), refocus: an effect keyed on `state.aiTyping` that
    calls `inputRef.current?.focus()` when it is `false` and `isChat`.
  - Caveat to record in the PR: on iOS WKWebView, programmatic focus only
    opens the keyboard as a best-effort continuation of the tab-tap user
    gesture; acceptable per "works most of the time".
- **Header unchanged** — "AI Assistant" title + history-toggle button
  (`AiChat.tsx:34-65`) stay; no X (it's a bottom tab). Optionally trim the
  header's `marginBottom` (`AiChat.tsx:34`, currently `16`) so the centred
  greeting reads centred against the visible area.

---

## Item A (workflow) — Does the app work offline?

Findings only; nothing to implement.

- **Works fully offline (once installed as a real bundled build):** every
  computed screen. Budgets, net worth, stats, tax-relief math, and screen
  population are all client-side in the reducer + selectors, driven by
  `state.transactions` et al. State persists to `localStorage` key
  `cukai_v7_data` (`initialState.ts:83` `STORAGE_KEY`; `persistState` at
  `initialState.ts:223`, called from the store effect on every change,
  `StoreProvider.tsx:57`) and is re-merged on boot via `mergePersisted`
  (`initialState.ts:235`). So budget tracking and all derived views keep
  working with no network.
- **Needs network:** login / signup and cross-device sync
  (`pushRemoteState`, already best-effort — `StoreProvider.tsx:80` catches
  offline), receipt OCR (`/receipts/scan`), and AI chat (`/ai/chat`). With
  Groq as the AI backend, real AI replies need internet; without it the
  app degrades to `aiCraftReply` canned replies. A local Ollama model on
  the Mac would be the only way to get real replies with no internet, and
  only while the Mac is reachable.
- **Live-reload dev mode is not "offline":** in that mode the web assets
  are served from the Mac's Vite dev server, so the phone needs the Mac on
  the LAN. True standalone offline requires a real `npm run build` +
  `npx cap sync ios` bundled build.

---

## Item B (workflow) — WiFi live-reload deploy (no cable)

Being set up first + separately by the main session; recorded here for
documentation.

- Mac LAN IP `192.168.0.15`, hostname `MacBook-Air-2.local`. Device "Andre
  iPhone" (iPhone 15 Plus), UDID `00008120-000E35C82102201E` (coredevice
  id `DD980A80-45F7-554A-A553-5FBED9771040` via `xcrun devicectl list devices`).
- **Approach: Capacitor `server.url` live-reload.** `app/capacitor.config.ts`
  currently has only `appId` / `appName` / `webDir`. Add a `server` block —
  gated so production builds never ship it, e.g.:

  ```ts
  const devServer = process.env.CAP_LIVE_RELOAD
    ? { server: { url: 'http://192.168.0.15:5173', cleartext: true } }
    : {};
  const config: CapacitorConfig = {
    appId: 'com.andrechan.cukai',
    appName: 'Cukai',
    webDir: 'dist',
    ...devServer,
  };
  ```

  Flow: `CAP_LIVE_RELOAD=1 npx cap sync ios` → build + install the native
  shell once over the network → run `npm run dev -- --host` on the Mac.
  Thereafter every web (JS/CSS/TSX) change hot-reloads on the phone with no
  rebuild, reinstall, or cable.
- **`app/vite.config.ts` `server` block** (`vite.config.ts:12-23`) needs
  `host: true` (listen on `0.0.0.0`) and the LAN IP + `.local` added to
  `allowedHosts` (currently `['.trycloudflare.com']` only) →
  `['.trycloudflare.com', '192.168.0.15', 'macbook-air-2.local', '.local']`.
  `headers: { 'Cache-Control': 'no-store' }` is already set — keep it.
- **API base:** `api.ts:14-16` computes
  `API_BASE = http://${window.location.hostname}:8000` for any non-localhost
  origin, so loading from `http://192.168.0.15:5173` auto-targets
  `http://192.168.0.15:8000` — no `VITE_API_BASE` needed. Backend must
  listen on `0.0.0.0:8000` (`uvicorn --host 0.0.0.0`).
- **iOS ATS:** `Info.plist` already has `NSAppTransportSecurity` →
  `NSAllowsLocalNetworking = true` (`Info.plist:29-32`). That normally
  covers a cleartext `http://192.168.x.x` origin for the WKWebView; if it
  still blocks, add an `NSExceptionDomains` entry for `192.168.0.15` and
  `macbook-air-2.local` with `NSExceptionAllowsInsecureHTTPLoads = true`.
- **Network device pairing:** pair the iPhone once over USB in Xcode →
  Devices & Simulators → "Connect via network". After that
  `xcodebuild -destination 'id=00008120-000E35C82102201E'` and `devicectl`
  work over WiFi for the occasional native rebuild.
- Only native/plugin changes need a rebuild + reinstall; JS/CSS/TSX
  changes are instant.

---

## Item C (workflow) — On-device persistence + in-app "Clear all data"

Findings + light implementation notes; implementation is later.

- **Persistence already works.** `localStorage` in the iOS WKWebView
  survives app relaunches. `cukai_v7_data` is written on every state
  change (`StoreProvider.tsx:57` → `persistState`) and merged on boot
  (`mergePersisted`, `initialState.ts:235`). In live-reload mode the store
  is keyed to origin `http://192.168.0.15:5173` — stable while the IP is
  stable; changing the IP (or switching to `.local`) starts a fresh store.
- **"Clear all data" button — current state.** `MorePanel.tsx` already has
  a "Clear all data" row (`MorePanel.tsx:257-264`) calling
  `actions.clearAllData` (`StoreProvider.tsx:141` → dispatch
  `CLEAR_ALL_DATA`, reducer at `reducer.ts:260`). But it is **gated behind
  `state.userMode === 'developer'`** (`MorePanel.tsx:248-264`) and it only
  empties transactions/receipts/accounts/budget/subscriptions — it keeps
  the onboarding profile and does **not** clear `localStorage` or reload.
  There is a separate always-visible "Reset onboarding" row
  (`MorePanel.tsx:241-247`) calling `actions.resetOnboarding`
  (`StoreProvider.tsx:136-139` → `clearPersisted()` + `window.location.reload()`),
  which is the true full wipe.
- **Recommendation.** In `app/src/screens/modals/MorePanel.tsx`, add a
  destructive-styled row outside the `userMode === 'developer'` guard that,
  after a `window.confirm(...)`, calls `actions.resetOnboarding` — reuse it
  as-is (`StoreProvider.tsx:136-139`; it already does
  `clearPersisted()` (`initialState.ts:231`) + reload). For a
  "keep profile, clear financial data only" variant instead, un-gate the
  existing `clearAllData` row (`CLEAR_ALL_DATA`, `reducer.ts:260`) and add
  the same confirm.

---

## Commit plan

One commit per item 1–7, each independently `cap`-buildable. Workflow B/C
setup is committed separately by the main session.

1. `scan camera: remove open-time re-upscale that caused the black flash`
2. `scan flow: animate the camera overlay on close`
3. `home: use shared TxIcon so every recent-activity row has an icon`
4. `finance net worth: hide Property + Liabilities sections (math unchanged)`
5. `home: drop shared-element morph on net-worth card tap`
6. `ai: Groq llama-3.3-70b backend with canned fallback`
7. `ai assistant: centered greeting, chips above input, keyboard auto-opens`
