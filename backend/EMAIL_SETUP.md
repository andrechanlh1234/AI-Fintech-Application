# Setting up the "Welcome to Cukai" email (free)

The code side is done — this is what you need to do to get a real welcome
email sending when someone creates an account.

## 1. Create a free Resend account

1. Go to https://resend.com and sign up (free tier: 3,000 emails/month,
   100/day — plenty for this).
2. In the dashboard, go to **API Keys** → **Create API Key**. Copy it —
   like the Google client secret, it's shown once.

## 2. Put it in `backend/.env`

Add to `backend/.env` (create it if it doesn't exist yet — see
`backend/GOOGLE_OAUTH_SETUP.md` if you're setting that up too):

```
RESEND_API_KEY=re_your_key_here
```

## 3. Restart the backend

```bash
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

That's enough to start sending. Without `RESEND_API_KEY` set, signup still
works completely normally — it just silently skips sending the email (you'll
see "Welcome email not configured — skipped" in the backend's terminal
output), so you can leave this unconfigured for a while with no downside.

## Important: sandbox sending limit

Until you verify your own domain with Resend, the default sender
(`onboarding@resend.dev`) can **only deliver to the email address you
signed up to Resend with** — every other recipient is silently accepted by
the API but never actually delivered. This is a Resend account restriction,
not a bug here. If you test signup with a different email and nothing
arrives, this is almost certainly why.

To send to real, arbitrary users:

1. **Domain** → **Add Domain** in the Resend dashboard, add the DNS
   records it gives you (at your domain registrar).
2. Once verified, set `RESEND_FROM` in `backend/.env` to an address on
   that domain, e.g.:
   ```
   RESEND_FROM=Cukai <hello@yourdomain.com>
   ```
   (defaults to `Cukai <onboarding@resend.dev>` if unset.)

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
