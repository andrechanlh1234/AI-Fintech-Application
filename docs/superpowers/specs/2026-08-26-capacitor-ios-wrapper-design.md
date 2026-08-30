# Capacitor iOS wrapper for Xcode Simulator

## Context

Cukai (`app/`) is a React 19 + TypeScript + Vite app, currently shipped as a
PWA (`vite-plugin-pwa`) and tested on phones over a Cloudflare tunnel
(`app/vite.config.ts`'s `allowedHosts`). The backend (`backend/main.py`) is a
local FastAPI server on port 8000.

The user wants to run the app inside Xcode / the iOS Simulator, without
rewriting the app. Capacitor wraps the existing Vite build output (`dist/`)
in a native iOS shell and generates a real Xcode project (`ios/App/App.xcworkspace`) —
no UI code changes required. This is purely additive: the existing PWA/web
deploy path is untouched.

Scope check: this only touches `app/` (new Capacitor deps + config,
generated `ios/` folder, one `.env` value) and `backend/main.py` (CORS
origins list). No screen, store, or component code changes.

## Decisions

**Capacitor, not React Native.** The app is a finished, working React web
app; Capacitor reuses 100% of it. A React Native rewrite was considered and
rejected as disproportionate — it would throw away every existing screen and
component for no benefit the user asked for.

**Target the Simulator only, for now.** No code signing / physical device
provisioning is set up in this pass — just get a real Xcode project running
in the Simulator. Signing for a physical device or App Store distribution is
a separate, later step if the user wants it.

**Bundle ID: `com.andrechan.cukai`.** Matches the project's working name;
easy to change later in `ios/App/App.xcodeproj` if the user wants a
different one before any real distribution.

**Point the Capacitor build at `127.0.0.1:8000`, not the Cloudflare tunnel.**
`app/.env`'s `VITE_API_BASE` currently holds a leftover tunnel URL from phone
testing. The iOS *Simulator* (unlike a physical device) runs on the same
machine and shares its network namespace, so it can reach the Mac's
`127.0.0.1:8000` directly — no tunnel needed. This value will be swapped
back to reflect local backend testing.

**Add `capacitor://localhost` to backend CORS, don't loosen it broadly.**
`backend/main.py`'s `allow_origins` only lists the Vite dev server origins.
A Capacitor iOS app's webview requests originate from `capacitor://localhost`;
that exact origin is added alongside the existing two, rather than switching
to a wildcard.

**ATS exception scoped to local networking, not a blanket HTTP allowance.**
iOS blocks plain HTTP by default (App Transport Security). Rather than
disabling ATS globally, `ios/App/App/Info.plist` gets `NSAllowsLocalNetworking`,
which permits unencrypted connections to `localhost`/local-network addresses
only — the local FastAPI backend's actual use case — while leaving ATS's
protections against arbitrary insecure internet connections intact.

**Camera/native permissions deferred.** The web app already does
camera-based receipt capture over `getUserMedia`; Capacitor's WKWebView can
support that, but it needs an `NSCameraUsageDescription` entry in
`Info.plist`. Out of scope for this pass — added only if/when the user hits
a permission failure testing that flow in the Simulator (Simulator also
doesn't have a real camera, so this needs a physical device to fully verify
either way).

## Steps

1. `app/`: add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`;
   `npx cap init` with name "Cukai", id `com.andrechan.cukai`, `webDir: dist`.
2. Install CocoaPods (`brew install cocoapods`) — required by
   `cap add ios` / `cap sync`; not currently installed on this machine.
3. `npx cap add ios` to generate `ios/App/App.xcworkspace`.
4. `npm run build && npx cap sync ios` to copy the built web app in.
5. Update `app/.env`'s `VITE_API_BASE` to `http://127.0.0.1:8000`; rebuild +
   re-sync so the native shell ships pointing at the local backend.
6. Add `"capacitor://localhost"` to `allow_origins` in `backend/main.py`.
7. Add `NSAllowsLocalNetworking` to `ios/App/App/Info.plist`.
8. Open `ios/App/App.xcworkspace` in Xcode, select an iPhone Simulator, Run.

## Testing

- Start the backend (`python backend/main.py` or its usual run command) so
  `127.0.0.1:8000` is live.
- Build and run the Xcode project on an iPhone Simulator; confirm the app
  launches to a real screen (not a blank/error page).
- Exercise one flow that round-trips to the backend (e.g. login or loading
  seeded data) to confirm the CORS + ATS wiring actually works end-to-end,
  not just that the static shell loads.
- Confirm `npm run dev` / the existing PWA flow still works unchanged
  afterward (this pass should be purely additive).
