# Capacitor iOS Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Cukai React/Vite web app in Capacitor to produce a real Xcode project that builds and runs in the iOS Simulator, talking to the local FastAPI backend.

**Architecture:** Capacitor copies `app/dist` (the existing Vite build output) into a generated native iOS shell at `app/ios/App/App.xcodeproj`. No React/TypeScript source changes. Two supporting changes make the shell able to actually talk to the backend from inside the Simulator: an `.env` pointing at `127.0.0.1:8000` instead of the old Cloudflare tunnel URL, a CORS origin added on the backend for the app's `capacitor://localhost` origin, and a scoped ATS exception in `Info.plist` for local (non-HTTPS) networking.

**Tech Stack:** Capacitor 6/7 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`), CocoaPods, Xcode 26.6 (already installed), existing Vite/React app, existing FastAPI backend.

## Global Constraints

- Bundle ID: `com.andrechan.cukai` (spec decision — easy to change later if the user wants a different one before real distribution).
- Simulator-only for this pass — no code signing / device provisioning.
- Purely additive: the existing PWA/web deploy path (`npm run dev`, `vite-plugin-pwa`) must keep working unchanged.
- Point the Capacitor build's `VITE_API_BASE` at `http://127.0.0.1:8000`, not a tunnel — the Simulator shares the Mac's network, so this works directly.
- CORS gets the exact origin `capacitor://localhost` added, not a wildcard.
- ATS exception must be scoped to local networking (`NSAllowsLocalNetworking`), not a blanket HTTP allowance.

---

### Task 1: Add Capacitor and generate the iOS Xcode project

**Files:**
- Modify: `app/package.json`, `app/package-lock.json` (via `npm install`)
- Create: `app/capacitor.config.ts` (via `npx cap init`)
- Create: `app/ios/` (via `npx cap add ios`) — the generated Xcode project, including `app/ios/App/App.xcodeproj`

**Interfaces:**
- Produces: `app/ios/App/App.xcodeproj` (the workspace Task 3/4 build and open), `app/capacitor.config.ts` with `appId: "com.andrechan.cukai"`, `webDir: "dist"`.

- [x] **Step 1: Install CocoaPods if missing**

Run: `pod --version || brew install cocoapods`
Expected: a version string prints (existing install), or Homebrew installs CocoaPods and a fresh `pod --version` then prints a version.

- [x] **Step 2: Install Capacitor packages**

Run (from `app/`): `cd app && npm install @capacitor/core @capacitor/cli @capacitor/ios`
Expected: `package.json` gains `@capacitor/core` and `@capacitor/ios` under `dependencies` and `@capacitor/cli` under `devDependencies` (or all three under `dependencies` — either is fine); `npm install` exits 0.

- [x] **Step 3: Initialize Capacitor config**

Run: `npx cap init "Cukai" "com.andrechan.cukai" --web-dir=dist`
Expected: creates `app/capacitor.config.ts` containing `appId: 'com.andrechan.cukai'`, `appName: 'Cukai'`, `webDir: 'dist'`.

- [x] **Step 4: Build the web app so there's something to wrap**

Run: `npm run build`
Expected: exits 0, `app/dist/` is populated (this already works today — no plan changes touch the build itself).

- [x] **Step 5: Add the iOS platform**

Run: `npx cap add ios`
Expected: exits 0, creates `app/ios/App/App.xcodeproj` and `app/ios/App/App/Info.plist`.

- [x] **Step 6: Verify Pods/build artifacts are excluded from git**

Run: `cat app/ios/.gitignore`
Expected: Capacitor's scaffolded `.gitignore` already excludes `App/Pods/`, `App/build/`, `App/output/`, `xcuserdata/`, and `DerivedData/`. If any of those four are missing, append them to `app/ios/.gitignore` before committing.

- [x] **Step 7: Commit**

```bash
cd ~/AI-Fintech-Application
git add app/package.json app/package-lock.json app/capacitor.config.ts app/ios
git commit -m "Add Capacitor iOS platform (generated Xcode project)"
```

---

### Task 2: Point the Capacitor build at the local backend

**Files:**
- Modify: `app/.env`

**Interfaces:**
- Consumes: `app/src/lib/api.ts`'s existing `VITE_API_BASE` env read (no code change — this task only changes the env value it reads).

- [x] **Step 1: Update the API base URL**

Change `app/.env` from:
```
VITE_API_BASE=https://antique-wine-cowboy-handbags.trycloudflare.com
```
to:
```
VITE_API_BASE=http://127.0.0.1:8000
```

- [x] **Step 2: Rebuild and re-sync so the native shell picks up the new value**

Run: `cd app && npm run build && npx cap sync ios`
Expected: both exit 0; `npx cap sync ios` reports copying web assets into `ios/App/App/public` and (if needed) running `pod install`.

- [x] **Step 3: Confirm there's nothing to commit**

Run: `git status`
Expected: `app/.env` and `app/dist/` do not appear as trackable changes — both are already gitignored (`app/.gitignore` lists `.env`, `.env.*`, and `dist`), so this task has no commit.

---

### Task 3: Wire CORS and the local-networking ATS exception

**Files:**
- Modify: `backend/main.py:44` (the `allow_origins` list)
- Modify: `app/ios/App/App/Info.plist`

**Interfaces:**
- Produces: backend now accepts requests whose `Origin` header is `capacitor://localhost`; the iOS shell's `Info.plist` now permits plain-HTTP connections to localhost/local-network addresses.

- [x] **Step 1: Add the Capacitor origin to backend CORS**

In `backend/main.py`, change:
```python
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
```
to:
```python
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "capacitor://localhost"],
```

- [x] **Step 2: Verify the backend still parses/imports cleanly**

Run: `backend/.venv/bin/python -c "import ast; ast.parse(open('backend/main.py').read())"`
Expected: no output, exit 0 (syntax is valid — a fast check before a full server start).

- [x] **Step 3: Add the local-networking ATS exception to Info.plist**

In `app/ios/App/App/Info.plist`, add this key/value pair as a top-level entry inside the outer `<dict>` (alongside the existing `CFBundle*` keys):
```xml
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
```

- [x] **Step 4: Verify the plist is still valid XML**

Run: `plutil -lint app/ios/App/App/Info.plist`
Expected: `app/ios/App/App/Info.plist: OK`

- [x] **Step 5: Commit**

```bash
cd ~/AI-Fintech-Application
git add backend/main.py app/ios/App/App/Info.plist
git commit -m "Allow Capacitor origin in CORS; add local-networking ATS exception"
```

---

### Task 4: Build, launch in the Simulator, and verify the backend round-trip

**Files:** none (verification-only task).

**Interfaces:**
- Consumes: `app/ios/App/App.xcodeproj` (Task 1), the local backend on `127.0.0.1:8000` (Task 2/3's target).

- [x] **Step 1: Start the backend**

Run (background, from repo root): `backend/.venv/bin/uvicorn backend.main:app --port 8000`
Expected: log line `Uvicorn running on http://127.0.0.1:8000`.

- [x] **Step 2: Pick and boot a Simulator**

Run: `xcrun simctl list devices available | grep -m1 "iPhone"`
Then boot it (skip if already `(Booted)`): `xcrun simctl boot "<device name from previous output>"`
Expected: boots without error, or reports it's already booted.

- [x] **Step 3: Build the app for that Simulator**

Run (from `app/ios/App`):
```bash
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=<device name>' \
  -derivedDataPath build build
```
Expected: ends with `** BUILD SUCCEEDED **`.

- [x] **Step 4: Install and launch on the Simulator**

Run:
```bash
xcrun simctl install <device name> app/ios/App/build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch <device name> com.andrechan.cukai
```
Expected: `install` exits 0; `launch` prints `com.andrechan.cukai: <pid>`.

- [x] **Step 5: Screenshot and visually confirm the app rendered**

Run: `xcrun simctl io <device name> screenshot /tmp/cukai-sim-launch.png`
Then read the screenshot: it should show a real Cukai screen (e.g. login/onboarding), not a blank white page or a WebView error page — a blank/error page would mean the shell loaded but the web assets or ATS/CORS wiring is broken.

- [ ] **Step 6: Manually verify the backend round-trip**

This step needs real interaction the command line can't drive: in the Simulator, log in (or otherwise trigger a network call, e.g. viewing synced data). A successful response confirms Task 2's `VITE_API_BASE` change and Task 3's CORS/ATS wiring actually work end-to-end, not just that the static shell loads.

**Not yet done** — the app is confirmed rendering the real onboarding screen (build/install/launch/paint all verified automatically), but nothing has exercised an actual network call to the backend yet. This is the one remaining manual check.

- [x] **Step 7: Confirm the existing web/PWA path is unaffected**

Run: `cd app && npm run dev` (start it, confirm it serves on `localhost:5173` without error, then stop it)
Expected: dev server starts cleanly — this pass didn't touch `vite.config.ts` or any screen/component code, so this should be unchanged from before Task 1.

- [x] **Step 8: Hand off to Xcode**

Run: `open app/ios/App/App.xcodeproj`
Expected: Xcode opens the workspace, ready for the user to build/run/iterate directly from the Xcode GUI going forward.
