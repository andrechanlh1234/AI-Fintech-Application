# High-priority Residual + Render CORS / PWA Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the last fabricated-data surface (AI "Past conversations"), unblock the deployed PWA from calling the deployed API (CORS), enable a real service worker, and verify the app works end-to-end from the user's phone on Render.

**Architecture:** Two small code changes plus one config flip. Frontend: `AI_CHAT_HISTORY` becomes `[]` and the AI history panel grows an empty state (`app/src/lib/seedData.ts`, `app/src/screens/ai/AiChat.tsx`). Backend: a `_allowed_origins()` helper adds the deployed web origin (and `FRONTEND_URL`) to the CORS allow-list (`backend/main.py`). Config: `VitePWA({ selfDestroying: false })` so the hosted deployment precaches its shell. Then a merge to `main` triggers Render's `autoDeployTrigger: commit` and a manual device verification pass.

**Tech Stack:** React 19 + TypeScript + Vite + `vite-plugin-pwa`; vitest for frontend logic tests. FastAPI + Starlette `CORSMiddleware`; pytest (no `TestClient` in the existing suite — it avoids the DB-touching startup). Render Blueprint (`render.yaml`), Supabase Postgres.

## Global Constraints

- **No fabricated user data.** Sample arrays that render as if they were the user's own data must be empty until a real data source exists — matching the rationale already written above `NOTIFICATIONS` in `app/src/lib/seedData.ts`.
- **Frontend has vitest for logic only** (`app/package.json` `"test": "vitest run"`; test files are `*.test.ts` under `app/src/lib/` and `app/src/store/`). No component-render test library. UI changes are verified manually in the running app, per repo convention.
- **Backend tests must not require a live database.** The existing suite (`backend/tests/test_auth.py`) imports modules directly and never constructs a `TestClient`, because `main.py`'s startup runs `init_db()` which raises without `DATABASE_URL`. New tests follow this — no `TestClient`.
- **Follow existing style:** frontend uses inline `style={{ ... }}` objects, `var(--color-*)` / `var(--font-*)` design tokens, `className="pressable"` on interactive elements, `all: 'unset'` on custom buttons.
- **CORS belt-and-braces:** the literal `https://cukai-web.onrender.com` is always in the allow-list, independent of whether the `FRONTEND_URL` env var is set on the API service.
- **`render.yaml` is not modified** — it already declares `FRONTEND_URL` on `cukai-api` (`sync: false`). Its value is set in the Render dashboard by the user.
- Commit after every task. Conventional-commit prefixes (`fix:`, `chore:`, `test:`, `docs:`).

---

### Task 1: Empty the fabricated AI chat history + guard test

**Files:**
- Modify: `app/src/lib/seedData.ts` (the `AI_CHAT_HISTORY` const, currently ~line 181, and its block comment)
- Modify: `app/src/screens/ai/AiChat.tsx` (the `{isHistory && (...)}` panel, currently ~lines 239–297)
- Create: `app/src/lib/seedData.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `AI_CHAT_HISTORY: AiHistoryItem[]` is now always `[]` (empty). The `AiHistoryItem` and `AiMessage` type exports are unchanged and still used by `AiChat.tsx` and `useActions().openAiHistoryChat`.

- [ ] **Step 1: Write the failing guard test**

Create `app/src/lib/seedData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AI_CHAT_HISTORY, NOTIFICATIONS } from './seedData';

// Regression lock: neither of these may carry fabricated sample rows that
// render as if they were the signed-in user's own data. They stay empty
// until there is a real per-user source for each (see the comments above
// their definitions in seedData.ts). Bug-report H3 / M8.
describe('no fabricated user data ships in seedData', () => {
  it('AI_CHAT_HISTORY is empty', () => {
    expect(AI_CHAT_HISTORY).toEqual([]);
  });

  it('NOTIFICATIONS is empty', () => {
    expect(NOTIFICATIONS).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, expect the `AI_CHAT_HISTORY` case to fail**

Run: `cd app && npx vitest run src/lib/seedData.test.ts`
Expected: `NOTIFICATIONS is empty` passes; `AI_CHAT_HISTORY is empty` FAILS (it currently has 3 items).

- [ ] **Step 3: Empty `AI_CHAT_HISTORY` in `app/src/lib/seedData.ts`**

Replace the whole `export const AI_CHAT_HISTORY: AiHistoryItem[] = [ ... ];` block (the three `c1`/`c2`/`c3` objects) and the comment above it with:

```ts
// No fabricated chat history. The previous fixed sample list rendered
// under "Past conversations" for every user regardless of state — a
// brand-new account saw threads quoting "RM 2,180 of your RM 2,500
// Lifestyle cap" etc. as if they were its own. There is no per-user
// conversation persistence yet (openAiHistoryChat just replays a message
// array; nothing is stored per thread), so the honest default is an
// empty list + an empty state in AiChat. Re-populate this from real
// stored conversations when that exists. Bug-report H3.
export const AI_CHAT_HISTORY: AiHistoryItem[] = [];
```

Leave the `AiHistoryItem` / `AiMessage` interface exports exactly as they are.

- [ ] **Step 4: Run the test, expect it to pass**

Run: `cd app && npx vitest run src/lib/seedData.test.ts`
Expected: both cases PASS.

- [ ] **Step 5: Add the empty state to the AI history panel**

In `app/src/screens/ai/AiChat.tsx`, inside `{isHistory && ( ... )}`, the block is currently:

```tsx
          <div style={{ borderTop: '1px solid var(--color-divider)' }} />
          {AI_CHAT_HISTORY.map((c) => (
            <button
              key={c.id}
              ...
            </button>
          ))}
        </div>
      )}
```

Change the `{AI_CHAT_HISTORY.map(...)}` expression to fall back to an empty state when the list is empty. Keep the existing `.map` body verbatim for when it is non-empty:

```tsx
          <div style={{ borderTop: '1px solid var(--color-divider)' }} />
          {AI_CHAT_HISTORY.length === 0 ? (
            <div
              style={{
                padding: '28px 8px',
                textAlign: 'center',
                fontSize: 12.5,
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
              }}
            >
              No past conversations yet.<br />Start a new one above.
            </div>
          ) : (
            AI_CHAT_HISTORY.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => actions.openAiHistoryChat(c.messages)}
                className="pressable"
                style={{
                  all: 'unset',
                  display: 'block',
                  width: '100%',
                  cursor: 'pointer',
                  padding: '13px 0',
                  borderBottom: '1px solid var(--color-neutral-300)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 3 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>{c.date}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.preview}
                </div>
              </button>
            ))
          )}
        </div>
      )}
```

The `AI_CHAT_HISTORY` import at the top of the file stays.

- [ ] **Step 6: Type-check and full frontend test run**

Run: `cd app && npx tsc -b && npm test`
Expected: `tsc` exits 0; vitest reports all files passing (the prior count plus the 2 new `seedData.test.ts` cases).

- [ ] **Step 7: Manual check in the dev server**

Run: `cd app && npm run dev`, open the app, go to the AI tab, open the history view (the sparkle/clock toggle top-right).
Expected: "New conversation" button and "Past conversations" label still render; below them, "No past conversations yet. Start a new one above." — no fabricated threads. "New conversation" still starts a chat.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/seedData.ts app/src/lib/seedData.test.ts app/src/screens/ai/AiChat.tsx
git commit -m "fix: drop fabricated AI chat history, show empty state (bug-report H3)"
```

---

### Task 2: Allow the deployed web origin through CORS

**Files:**
- Modify: `backend/main.py` (imports; the `app.add_middleware(CORSMiddleware, ...)` call at ~lines 41–59)
- Create: `backend/tests/test_cors.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `backend.main._allowed_origins() -> list[str]` — the static dev origins, plus `os.environ["FRONTEND_URL"]` when set and non-empty, plus the literal `"https://cukai-web.onrender.com"`, de-duplicated, order-stable.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_cors.py`:

```python
"""CORS allow-list construction (backend/main.py:_allowed_origins)."""

import importlib

import backend.main as main


def _reload():
    # _allowed_origins reads os.environ at call time, not import time, so a
    # reload is not strictly required — but keep the module handle fresh in
    # case earlier tests in the process mutated it.
    return importlib.reload(main)


def test_deployed_web_origin_is_always_present(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    origins = _reload()._allowed_origins()
    assert "https://cukai-web.onrender.com" in origins


def test_local_dev_origins_are_present(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    origins = main._allowed_origins()
    assert "http://localhost:5173" in origins
    assert "capacitor://localhost" in origins


def test_frontend_url_env_is_included_when_set(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://staging.example.com")
    origins = main._allowed_origins()
    assert "https://staging.example.com" in origins


def test_no_duplicates(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://cukai-web.onrender.com")
    origins = main._allowed_origins()
    assert len(origins) == len(set(origins))


def test_unset_frontend_url_does_not_raise(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    main._allowed_origins()  # must not raise
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd backend && python -m pytest tests/test_cors.py -v`
Expected: FAIL — `AttributeError: module 'backend.main' has no attribute '_allowed_origins'`.

- [ ] **Step 3: Add `_allowed_origins()` and wire it in**

In `backend/main.py`, ensure `os` is imported (it is used elsewhere — confirm `import os` is present near the top; add it if not). Immediately **above** the `app.add_middleware(CORSMiddleware, ...)` call, add:

```python
# The deployed frontend origin must reach the API. `FRONTEND_URL` is the
# env var the email + Google-OAuth code already read; include it here too
# when set. The literal onrender origin is always included as a fallback
# so a missing/empty FRONTEND_URL on the API service does not silently
# re-break the deployed PWA (bug-report deploy blocker, 2026-09-04).
_DEPLOYED_WEB_ORIGIN = "https://cukai-web.onrender.com"
_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "capacitor://localhost"]


def _allowed_origins() -> list[str]:
    origins = list(_DEV_ORIGINS)
    frontend_url = os.environ.get("FRONTEND_URL", "").strip()
    if frontend_url:
        origins.append(frontend_url)
    origins.append(_DEPLOYED_WEB_ORIGIN)
    # de-dupe, preserve order
    seen: set[str] = set()
    return [o for o in origins if not (o in seen or seen.add(o))]
```

Then change the middleware call's `allow_origins=` argument from the inline list literal to `allow_origins=_allowed_origins()`. Leave `allow_origin_regex`, `allow_methods`, `allow_headers` exactly as they are.

- [ ] **Step 4: Run the CORS tests, expect pass**

Run: `cd backend && python -m pytest tests/test_cors.py -v`
Expected: all 5 PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass (the existing `test_auth.py` + `test_my_tax_kb.py` + the new `test_cors.py`); no import errors.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_cors.py
git commit -m "fix: allow deployed web origin + FRONTEND_URL through CORS"
```

---

### Task 3: Enable a real (precaching) service worker for the hosted deploy

**Files:**
- Modify: `app/vite.config.ts` (the `VitePWA({ ... })` options — `selfDestroying` and its comment)

**Interfaces:**
- Consumes: nothing.
- Produces: production builds now ship a precaching, auto-updating service worker instead of a self-destroying one.

- [ ] **Step 1: Flip `selfDestroying` and rewrite its comment**

In `app/vite.config.ts`, in the `VitePWA({ ... })` call, change `selfDestroying: true` to `selfDestroying: false`, and replace the preceding block comment with:

```ts
      // Precaching, auto-updating SW. It was previously self-destroying
      // because the only "deployment" was a Cloudflare quick tunnel that
      // served modules `no-store`, and iOS WKWebView / installed-PWA
      // clients pinned a stale precache with no reliable update handshake.
      // The app is now hosted on Render with content-hashed, properly
      // cached production assets, so `registerType: 'autoUpdate'` +
      // the manual `virtual:pwa-register` call in main.tsx give a silent
      // update-and-reload, and precaching the shell lets the installed
      // PWA boot offline. Revisit only if stale-content bugs resurface on
      // device.
```

- [ ] **Step 2: Production build succeeds and emits a SW**

Run: `cd app && npm run build`
Expected: build exits 0; output lists a generated `sw.js` (or `dist/sw.js`) and `dist/manifest.webmanifest`. (With `selfDestroying: true` the SW was a stub; now it precaches the shell glob.)

- [ ] **Step 3: Commit**

```bash
git add app/vite.config.ts
git commit -m "chore: enable precaching service worker now that the app is hosted"
```

---

### Task 4: Merge to `main`, deploy, verify from the phone

**Files:** none (git + Render dashboard + device).

**Interfaces:**
- Consumes: Tasks 1–3 committed on `fix/highprio-residual-and-cors-2026-09-04`.
- Produces: a verified live deployment.

- [ ] **Step 1: Rebase check + full local verification**

Run:
```bash
cd ~/AI-Fintech-Application
git fetch origin && git log --oneline origin/main -1
cd app && npm test && npx tsc -b && npm run build && cd ..
cd backend && python -m pytest tests/ -v && cd ..
```
Expected: local branch is ahead of `origin/main` by the Task 1–3 commits (plus the spec commit); every check green.

- [ ] **Step 2: User sets `FRONTEND_URL` in the Render dashboard**

Ask the user to, in the Render dashboard → `cukai-api` service → Environment: set `FRONTEND_URL = https://cukai-web.onrender.com` (add it if absent), and to note which of `GROQ_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` currently have values (informational — those paths degrade gracefully when unset; not a blocker for this pass).

- [ ] **Step 3: Merge the branch to `main` and push**

```bash
cd ~/AI-Fintech-Application
git checkout main
git merge --no-ff fix/highprio-residual-and-cors-2026-09-04 -m "merge: AI history empty state + Render CORS/PWA deploy fix"
git push origin main
```
Expected: push succeeds; Render starts a deploy of both `cukai-api` and `cukai-web` (`autoDeployTrigger: commit`).

- [ ] **Step 4: Wait for both Render deploys to go live**

Check the Render dashboard (or `curl -sI https://cukai-api.onrender.com/docs`) until `cukai-api` shows the new deploy live and `cukai-web` shows "Deploy live". Backend cold start after build can take a few minutes.

- [ ] **Step 5: Verify the CORS preflight from the deployed origin**

Run:
```bash
curl -s -i -X OPTIONS https://cukai-api.onrender.com/state \
  -H "Origin: https://cukai-web.onrender.com" \
  -H "Access-Control-Request-Method: GET" | grep -i "http/\|access-control-allow-origin"
```
Expected: `HTTP/2 200` **and** `access-control-allow-origin: https://cukai-web.onrender.com`. (Before this change it was `HTTP/2 400` with no allow-origin header.)

- [ ] **Step 6: Device round-trip — signup + sync persistence**

On the user's phone browser, open `https://cukai-web.onrender.com`:
1. Complete onboarding / sign up with a real email + password.
2. Add one transaction (Record → add).
3. Fully close the browser tab, reopen the URL.
Expected: still signed in; the transaction is still there (proves `PUT /state` → Supabase → `GET /state` works from the device). If the first request hangs ~30–60 s, that is the free-plan cold start — retry once.

- [ ] **Step 7: Device — no fabricated AI history**

On the phone, AI tab → history view.
Expected: the "No past conversations yet." empty state, not the three fabricated RM-quoting threads.

- [ ] **Step 8: Device — PWA install**

On the phone: Safari → Share → **Add to Home Screen** → Add. Launch from the new home-screen icon.
Expected: the icon is the Cukai mark (green), the app opens full-screen with no Safari chrome, `apple-mobile-web-app-title` shows "Cukai". Then enable Airplane Mode and relaunch from the icon — the app shell still boots (precache), even though API calls will fail offline.

- [ ] **Step 9: Mark the bug-report findings resolved**

In `docs/bug-report.md`, append a short dated note under C1/H1/H2/H3/H4 (or a "Resolution — 2026-09-04" line at the top of the file) recording: C1/H1/H2(client)/H4 fixed by the 2026-09-02 merge; H3 completed here (canned reply figure-free earlier, fabricated history removed now); H2 server-side version guard still open, tracked to the infra-security work.

```bash
git add docs/bug-report.md
git commit -m "docs: record Critical/High bug-report findings as resolved"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- H3 residual (empty `AI_CHAT_HISTORY` + empty state) → Task 1. ✓
- Regression guard test → Task 1 Step 1. ✓
- CORS `_allowed_origins()` helper + `FRONTEND_URL` + literal onrender origin → Task 2. ✓
- CORS test without `TestClient` → Task 2 (`test_cors.py`, direct calls). ✓
- `render.yaml` untouched; `FRONTEND_URL` set in dashboard → Task 4 Step 2, and stated in Global Constraints. ✓
- Deploy via `autoDeployTrigger: commit` → Task 4 Step 3. ✓
- Preflight verification + device signup/sync + AI-history check → Task 4 Steps 5–7. ✓
- PWA `selfDestroying: false` → Task 3; install check → Task 4 Step 8. ✓
- Out of scope (server-side PUT /state guard, other findings, API keys, native iOS) → not planned; recorded in Task 4 Step 9 note. ✓

**Placeholder scan:** No TBD/TODO; every code step has the literal code. Empty-state copy is concrete ("No past conversations yet. Start a new one above."). ✓

**Type consistency:** `_allowed_origins() -> list[str]` used identically in Task 2 Steps 1, 3, 4 and the Interfaces block. `AI_CHAT_HISTORY: AiHistoryItem[]` consistent between `seedData.ts` and `AiChat.tsx`. `AiHistoryItem` / `AiMessage` exports explicitly preserved. ✓
