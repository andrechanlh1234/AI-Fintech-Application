# Setting up the "Welcome to Cukai" and password-reset emails

The code side is done — this is what you need to do to get real emails
sending. There are two options; **use Gmail until you own a domain**, then
switch to Resend later if you want higher sending volume.

## Option A: Gmail (recommended for now — no domain needed)

Sends using your own real Gmail address via an "App Password" — a
16-character code Google generates that lets one specific app sign in
without your actual Gmail password. It can deliver to **any** real
recipient today, unlike Resend below before a domain is verified.

### 1. Turn on 2-Step Verification (if not already on)

App Passwords only exist once 2-Step Verification is on for your Google
Account: https://myaccount.google.com/security → **2-Step Verification**.

### 2. Create an App Password

1. Go to https://myaccount.google.com/apppasswords (or Security → 2-Step
   Verification → **App passwords**, if the direct link asks you to sign
   in again).
2. Name it something like "Cukai backend".
3. Google shows a 16-character password **once** — copy it now.

### 3. Put both values in `backend/.env`

```
GMAIL_ADDRESS=your.address@gmail.com
GMAIL_APP_PASSWORD=the16charcodefromgoogle
```

(No spaces — Google displays it in groups of 4 for readability, but paste
it with or without the spaces, both work.)

### 4. Restart the backend

```bash
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

Emails now send as `Cukai <your.address@gmail.com>` via Gmail's own
servers. Every recipient's inbox will show your real Gmail address as the
sender — that's expected until you own a domain (Option B).

### On Render (production)

In the Render dashboard → `cukai-api` service → **Environment**, add
`GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` the same way you added
`FRONTEND_URL`. `render.yaml` already declares both keys, but Render only
prompts for brand-new Blueprint keys on a fresh apply — for an
already-running service, add them directly in the dashboard.

## Option B: Resend (switch to this once you own a domain)

1. Go to https://resend.com and sign up (free tier: 3,000 emails/month,
   100/day).
2. In the dashboard: **API Keys** → **Create API Key**. Copy it — like
   the Google client secret, it's shown once.
3. **Domain** → **Add Domain**, add the DNS records Resend gives you at
   your domain registrar, wait for it to verify.
4. Put in `backend/.env`:
   ```
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM=Cukai <hello@yourdomain.com>
   ```

**Important:** until that domain is verified, Resend's sandbox sender
(`onboarding@resend.dev`) can only deliver to the email address you
signed up to Resend with — every other recipient is silently accepted by
the API but never actually delivered. This is a Resend account
restriction, not a bug here.

**Gmail takes priority when both are configured** — set both
`GMAIL_ADDRESS`/`GMAIL_APP_PASSWORD` and `RESEND_API_KEY`, and Gmail is
what actually sends. Remove the Gmail env vars once you're ready to
switch to Resend.

## Neither configured?

Signup and password reset still work completely normally — sending is
silently skipped (you'll see a "not configured — skipped" line in the
backend's terminal output; a password-reset code is logged there instead
so you can still test the flow locally). No downside to leaving this
unconfigured for a while.

## Optional: social links in the email footer

The email has a footer row of social links, currently pointing nowhere
(`#`) since there are no real Cukai accounts yet. Set these once you have
them:

```
CUKAI_TWITTER_URL=https://twitter.com/yourhandle
CUKAI_INSTAGRAM_URL=https://instagram.com/yourhandle
CUKAI_LINKEDIN_URL=https://linkedin.com/company/yourcompany
```

## When it's sent

Once per account, on first-time creation only — not on every login. That's
both email/password signup (`/auth/signup`) and the first time someone
signs in with a brand-new Google account (`backend/google_oauth.py`); an
existing account logging in again never re-triggers it.
