# High-priority bug residual + Render CORS / PWA deploy

Date: 2026-09-04
Status: approved, ready for implementation plan.

## Why now

The user wants the app fixed and usable on their phone via the existing
Render deployment. A re-check of the five Critical/High findings in
`docs/bug-report.md` (2026-08-28) against current `main` shows the
2026-09-02 merge (`fix/qa-findings-2026-08-28`) already resolved four of
them:

| # | Finding | Current state on `main` |
|---|---|---|
| C1 | Password-reset JWT accepted as a session token | **Fixed.** `backend/auth.py:decode_token` rejects any token carrying a `purpose` claim; the reset flow was rewritten to in-memory 6-digit codes (`create_reset_code`/`verify_reset_code`) — no reset JWT is minted anywhere. |
| H1 | Stray detail modal over Home after onboarding | **Fixed.** `app/src/store/reducer.ts` `OB_FINISH` now nulls `budgetItemDetailOpen`, `balanceDetailOpen`, `investDetailOpen`, `historyOpen`, `txDetailOpen`. |
| H2 | Login sync race overwrites server data with guest state | **Fixed (client race closed).** `app/src/store/StoreProvider.tsx` now dispatches `SET_AUTH_USER` only *after* `fetchRemoteState()` resolves, in the same batch as `APPLY_REMOTE_STATE`, so the debounced push effect can never fire against pre-login state. The server-side `PUT /state` version guard is still absent and is **explicitly out of scope** here (deferred to the infra-security work). |
| H3 | AI states fabricated money figures as the user's data | **Partially fixed.** `aiCraftReply()` is now figure-free and `NOTIFICATIONS` is `[]`, but `AI_CHAT_HISTORY` in `app/src/lib/seedData.ts` still holds three fabricated conversations with specific RM amounts, and `app/src/screens/ai/AiChat.tsx` renders them live under a "Past conversations" heading as if they were the user's own history. |
| H4 | `useActions` memoized on a stale dep; AI context frozen | **Fixed.** `useActions` reads all state through `stateRef = useRef(state)` refreshed every render. |

Separately, a direct probe of the live Render services found:

- `https://cukai-api.onrender.com` — **live**; `/state` returns a clean
  `401` (not a 500), so `init_db()` succeeded on startup ⇒ `DATABASE_URL`
  is set and Supabase Postgres is connected.
- `https://cukai-web.onrender.com` — **live**; serving the built PWA.
- **CORS blocks the two from talking.** A preflight `OPTIONS` from
  `Origin: https://cukai-web.onrender.com` returns `HTTP 400` with no
  `access-control-allow-origin` header. `backend/main.py`'s
  `allow_origins` is `["http://localhost:5173", "http://127.0.0.1:5173",
  "capacitor://localhost"]` plus an `allow_origin_regex` covering private
  LAN IPs and `*.trycloudflare.com` — the deployed web origin is not in
  either list. Every API call from the deployed PWA (signup, login,
  `/state` sync, `/ai/chat`) fails in the browser. This is the actual
  blocker to phone use.

## Scope

In scope:

1. **H3 residual** — stop rendering fabricated AI chat history.
2. **CORS** — allow the deployed web origin to call the API.
3. **Deploy & verify** — push to `main`, both Render services auto-deploy
   (`render.yaml` has `autoDeployTrigger: commit`), verify the preflight
   and a real signup/sync round-trip from a phone browser.
4. **PWA install polish** — confirm the installed-to-home-screen
   experience; enable a real (non-self-destroying) service worker now that
   a hosted deployment exists.

Explicitly out of scope: server-side `PUT /state` optimistic-concurrency
guard (H2 deep half); the remaining Medium/Low findings in
`docs/bug-report.md`; Groq/Gemini/Google-OAuth key setup (those paths
degrade gracefully when unset); native iOS / App Store submission (the
Capacitor path stays as-is and already targets the prod API — a separate
future project).

## Design

### 1. H3 residual — empty AI chat history

`app/src/lib/seedData.ts`

- Replace the three-item `AI_CHAT_HISTORY` array with `[]`, and replace
  the block comment with the same rationale already written above
  `NOTIFICATIONS` ("no real per-conversation persistence exists yet, so
  the honest default is empty; re-populate from real state when there is
  one"). Keep the `AiHistoryItem` / `AiMessage` type exports — they are
  still used by `openAiHistoryChat` and the live chat view.

`app/src/screens/ai/AiChat.tsx`

- The `{AI_CHAT_HISTORY.map(...)}` block in the `isHistory` panel now
  renders nothing. Add an empty state in its place, matching the app's
  existing empty-state idiom (centered, muted, `var(--color-text-muted)`,
  a short line such as "No past conversations yet. Start a new one
  above."). The existing "New conversation" button and "Past
  conversations" label stay.
- Keep the `AI_CHAT_HISTORY` import (now `[]`); the `.map` over an empty
  array plus the empty-state fallback is the whole change. No change to
  `openAiHistoryChat`, `startNewAiChat`, or the live chat view.

Regression guard: add `app/src/lib/seedData.test.ts` (vitest) asserting
`AI_CHAT_HISTORY` and `NOTIFICATIONS` are both empty — a cheap lock
against fabricated sample data creeping back in.

### 2. CORS — allow the deployed web origin

`backend/main.py`

- Add a module-level `_allowed_origins()` helper that returns the static
  dev list plus, when set and non-empty, `os.environ["FRONTEND_URL"]`,
  plus the literal `"https://cukai-web.onrender.com"` (belt-and-braces so
  a missing `FRONTEND_URL` env on the API service does not silently
  re-break CORS). De-duplicate.
- `add_middleware(CORSMiddleware, allow_origins=_allowed_origins(), ...)`.
  The `allow_origin_regex` (LAN IPs, `*.trycloudflare.com`) is unchanged.
- `render.yaml` already declares `FRONTEND_URL` on `cukai-api` with
  `sync: false`; no blueprint change needed. The user sets its value to
  `https://cukai-web.onrender.com` in the Render dashboard (also fixes
  password-reset email links and the Google-OAuth redirect target, both
  of which already read `FRONTEND_URL`).

Test: `backend/tests/test_cors.py` (no `TestClient` — the existing suite
avoids it because startup runs `init_db()` and needs a live DB).
Unit-test `_allowed_origins()` directly with `monkeypatch.setenv` /
`delenv`: asserts `https://cukai-web.onrender.com` is always present, that
a set `FRONTEND_URL` is included, and that an unset `FRONTEND_URL` does
not raise.

### 3. Deploy & verify

- Commit both changes to `main`; push. `autoDeployTrigger: commit`
  rebuilds `cukai-api` (Docker) and `cukai-web` (static). `cukai-web`'s
  build already bakes `VITE_API_BASE=https://cukai-api.onrender.com`
  (`app/.env`).
- Post-deploy verification (from a dev machine + the user's phone):
  1. `curl -i -X OPTIONS https://cukai-api.onrender.com/state -H 'Origin:
     https://cukai-web.onrender.com' -H 'Access-Control-Request-Method:
     GET'` → `HTTP 200` **with** `access-control-allow-origin:
     https://cukai-web.onrender.com`.
  2. On the phone browser: open `https://cukai-web.onrender.com`, complete
     signup, add one transaction, force-quit, reopen → the transaction and
     session persist (proves the full `PUT /state` → Supabase → `GET
     /state` round-trip works from the device).
  3. AI tab → "Past conversations" shows the empty state, not the three
     fabricated threads.

Note: the `cukai-api` free plan spins down after ~15 min idle; the first
request after idle takes ~30–60 s. This is acceptable for now
(documented, not fixed here).

### 4. PWA install polish

`app/index.html` already carries `apple-touch-icon`,
`apple-mobile-web-app-capable`, `apple-mobile-web-app-title`,
`theme-color`; `app/vite.config.ts`'s `VitePWA` manifest is complete
(name, icons 192/512/maskable, `display: standalone`, `start_url`,
`scope`); `app/public/` has all three PWA PNGs. Installability needs no
change.

One change: flip `VitePWA({ selfDestroying: true })` →
`selfDestroying: false` in `app/vite.config.ts`. It was set
self-destroying because the *dev tunnel* served modules `no-store` and
iOS WKWebView pinned a stale precache. Render serves content-hashed,
properly-cached production assets, so the `registerType: 'autoUpdate'` +
manual `virtual:pwa-register` flow in `main.tsx` (already wired) gives
silent update-and-reload, and precaching the shell lets the installed PWA
boot offline. Update the block comment to say the hosted deployment is
now the reason it is enabled.

Verification: after deploy, on the phone — Safari → Share → Add to Home
Screen → the icon is the Cukai mark (not a screenshot), launches
full-screen with no browser chrome, and a second launch with airplane
mode on still boots to the app shell.

## Testing

- Frontend: `cd app && npm test` (vitest) and `npx tsc -b` — both green.
  New `seedData.test.ts` passes.
- Backend: `cd backend && python -m pytest tests/ -v` — green, including
  new `test_cors.py`.
- Manual: the three post-deploy verification steps in §3, plus the PWA
  install check in §4.
- Regression: re-run the H1 repro (onboarding → add blank account →
  finish → Home is clean) and H3 repro (fresh guest → AI tab → no
  fabricated history) from `docs/bug-report.md`.

## Files touched

- `app/src/lib/seedData.ts` — `AI_CHAT_HISTORY = []` + comment.
- `app/src/screens/ai/AiChat.tsx` — empty state for the history panel.
- `app/src/lib/seedData.test.ts` — new; fabricated-data guard.
- `backend/main.py` — `_allowed_origins()` helper + wire into CORS middleware.
- `backend/tests/test_cors.py` — new; unit tests for `_allowed_origins()`.
- `app/vite.config.ts` — `selfDestroying: false` + comment.
- No change to `render.yaml` (env var already declared); the user sets
  `FRONTEND_URL` in the Render dashboard.
