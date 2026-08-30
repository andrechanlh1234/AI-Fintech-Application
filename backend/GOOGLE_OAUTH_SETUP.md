# Setting up "Continue with Google" (free)

The code side is done — this is what you need to do in Google Cloud
Console to get the two values the backend needs.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Top-left project dropdown → **New Project** → give it any name (e.g.
   "Cukai") → **Create**.

## 2. Configure the OAuth consent screen

1. In the left sidebar: **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create.
3. Fill in the required fields (app name, your email as support + developer
   contact). Nothing else is required for local/personal use.
4. Save through to the end. You do **not** need to submit for verification —
   leave the app in **Testing** mode. In Testing mode, add your own Google
   account under **Test users** so you can actually log in with it.

## 3. Create the OAuth Client ID

1. **APIs & Services → Credentials** → **Create Credentials** → **OAuth
   client ID**.
2. Application type: **Web application**.
3. Name: anything (e.g. "Cukai local dev").
4. Under **Authorized redirect URIs**, add exactly:
   ```
   http://127.0.0.1:8000/auth/google/callback
   ```
5. Create. You'll get a **Client ID** and **Client Secret** — copy both.

## 4. Put them in `backend/.env`

Create `backend/.env` (this file is gitignored — never commit it):

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

`GOOGLE_REDIRECT_URI` and `FRONTEND_URL` don't need to be set unless you
change the ports — they default to `http://127.0.0.1:8000/auth/google/callback`
and `http://localhost:5173` respectively.

## 5. Restart the backend

```bash
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

Restart is required — the client ID/secret are only read once, at process
start.

## Test it

Open the app, go to the login screen, click **Continue with Google**. You
should land on a real Google account picker, and come back signed in. If
something's wrong, the app redirects back with `?oauth_error=...` in the
URL — check the backend's terminal output for the actual HTTP error from
Google alongside it.

## When you're ready to go live (public hosting, later)

- Add your production domain's callback URL (e.g.
  `https://yourdomain.com/auth/google/callback`) as another **Authorized
  redirect URI** in step 3 — you can have both the local and production
  ones registered at once.
- Set `GOOGLE_REDIRECT_URI` and `FRONTEND_URL` env vars on the server to
  the production values.
- Submit the consent screen for verification if you want any Google user
  to sign in, not just the test users you added in step 2.
