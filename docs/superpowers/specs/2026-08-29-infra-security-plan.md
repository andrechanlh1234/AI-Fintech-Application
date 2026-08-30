# Cukai — infrastructure & security plan

Status: planning. Nothing here is built yet. Written 2026-08-29.

## Why now

We're wiring up several third-party APIs (Groq, Resend, Google OAuth) and
the product roadmap is: **classify every user's tax-deductible receipts
server-side and sell them a consolidated filing file.** That makes the
server the source of truth for personal financial data, which raises the
security bar and forces a few decisions.

## Storage: cloud is the source of truth

The roadmap can't run on device-only storage — we need every user's full
receipt/transaction history server-side to classify and consolidate it,
and to generate and deliver the filing file.

Current shape is already right: when a user is signed in, the frontend
syncs its whole state blob to `user_state` in the backend DB, and keeps a
`localStorage` mirror for offline + speed. Guests keep data only on
device. **Keep this model.** The work is productionising it.

| Piece | Now | Target |
|---|---|---|
| DB | `backend/cukai.db` (SQLite file on a laptop) | Managed **Postgres** (Neon / Supabase / RDS) — encryption-at-rest on by default, PITR backups |
| State storage | one JSON blob per user in `user_state` | Keep the blob for app state; **also** write receipts/transactions to real relational tables so they're queryable for tax classification |
| Transport | `http://` on the LAN | **HTTPS/TLS** everywhere (managed host terminates TLS) |
| Token on device | `localStorage` | iOS **Keychain** via a Capacitor secure-storage plugin |
| Secrets | `backend/.env` (gitignored) | Host's secret manager / env config; never in the app bundle (nothing without a `VITE_` prefix ships to the client — keep it that way) |
| PII at rest | plaintext columns | Rely on Postgres encryption-at-rest + strict access; consider column encryption only for the most sensitive fields (full names on receipts, IC numbers if ever captured) |

## Encryption — concrete checklist

1. **TLS in transit** — the moment the backend is off the LAN. Managed
   hosts give this free. Set HSTS.
2. **Encryption at rest** — default on for Neon/Supabase/RDS. No app work.
3. **Passwords** — already bcrypt. Keep.
4. **Session token** — move from `localStorage` to Keychain
   (`@capacitor-community/secure-storage` or `capacitor-secure-storage-plugin`).
   Small frontend change in `app/src/lib/api.ts` (`getToken`/`setToken`).
5. **`CUKAI_JWT_SECRET`** — currently a gitignored on-disk file for dev.
   Production: a real secret in the host's config, rotated if leaked.
6. **API keys** (`GROQ_API_KEY`, `RESEND_API_KEY`, Google secret) — backend
   only, host secret manager. Audit that none get a `VITE_` prefix.
7. **Rate limiting** — `backend/rate_limit.py` is in-memory per-process;
   fine now, move to Redis when there's more than one worker.
8. **Backups** — Postgres PITR + a periodic logical dump to object storage.
9. **Data deletion** — a real "delete my account" that purges `users` +
   `user_state` + receipt rows + any generated files (GDPR/PDPA-style).

## Hosting shape (proposed)

- **Backend**: a container on Fly.io / Render / Railway. HTTPS, env-based
  secrets, 1 region to start (Singapore for MY users).
- **DB**: Neon or Supabase Postgres, same region.
- **Object storage**: Cloudflare R2 / S3 for receipt images and generated
  filing files (private buckets, signed URLs, server-side encryption).
- **Email**: Resend (already coded) with a verified sending domain so it
  can email anyone, not just the account owner.
- **Auth callback domain**: a stable HTTPS host is also what unblocks
  Google OAuth (see below).

## Google OAuth on the installed app

Two things are needed and they're independent of hosting choice:

1. **A stable public HTTPS URL for the backend.** Google rejects `http://`
   redirect URIs on anything but `localhost`, and rejects private IPs
   outright — that's the "access blocked, request is invalid" today
   (`GOOGLE_REDIRECT_URI` also points at a dead quick-tunnel). Use the
   production host, or for local testing an **ngrok reserved domain** /
   **named Cloudflare tunnel** (not a random quick-tunnel). Register
   `https://<host>/auth/google/callback` in Google Cloud Console.
2. **Deep-link back into the native app.** The OAuth callback currently
   redirects to `FRONTEND_URL/?oauth_token=...`, a web URL the installed
   app can't receive. Needs:
   - a custom URL scheme (`com.andrechan.cukai://auth`) in `Info.plist`
     (`CFBundleURLTypes`),
   - `@capacitor/browser` to open the Google auth URL in the system
     browser (Google blocks OAuth inside an embedded WKWebView),
   - a `@capacitor/app` `appUrlOpen` listener to catch
     `com.andrechan.cukai://auth?oauth_token=...` and adopt the session,
   - backend `FRONTEND_URL` (for the OAuth redirect only) set to that
     scheme.

Until both are in place, "Continue with Google" cannot work on the phone.
Interim option already discussed: hide the button while `VITE_API_BASE`
is not HTTPS.

## Suggested order

1. Managed Postgres + migrate `users` / `user_state`; deploy backend to a
   host with HTTPS. (Unblocks everything else.)
2. Point the app's `VITE_API_BASE` at the deployed backend; keep the
   local flow for dev.
3. Keychain for the token.
4. Verified Resend domain.
5. Google OAuth: reserved HTTPS URL + native deep-link plumbing.
6. Relational receipt/transaction tables for the tax-classification
   pipeline (its own spec).
