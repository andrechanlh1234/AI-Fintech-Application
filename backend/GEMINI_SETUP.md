# Setting up real AI chat replies (free)

The code side is done — this is what you need to do to get the AI tab
answering with a real model instead of its canned/scripted replies.

## 1. Get a free Gemini API key

1. Go to https://aistudio.google.com/apikey and sign in with a Google
   account.
2. Click **Create API key** (choose "Create API key in new project" if
   asked). Copy it — shown once, like the other keys you've set up here.

No credit card is required for the free tier.

## 2. Put it in `backend/.env`

Add to `backend/.env` (create it if it doesn't exist yet — see
`backend/GOOGLE_OAUTH_SETUP.md` if you're setting that up too):

```
GEMINI_API_KEY=your_key_here
```

## 3. Restart the backend

```bash
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

That's it. Without `GEMINI_API_KEY` set, the AI tab still works completely
normally — it just quietly falls back to the existing canned replies (the
backend logs "Gemini not configured — falling back to canned replies"), so
you can leave this unconfigured for as long as you like with no downside.

## Free tier limits

The default model (`gemini-2.0-flash`) has generous free-tier limits, but
Google does change these over time — check the current numbers on the
pricing page at https://ai.google.dev/gemini-api/docs/rate-limits rather
than trusting a number written here months from now. As a safety net
regardless of Gemini's own limit, this backend caps AI chat itself at 20
messages per 10 minutes per visitor (`backend/rate_limit.py`), so one
person can't accidentally burn through the whole app's shared free-tier
quota.

## Changing the model

If Google renames or retires `gemini-2.0-flash`, set `GEMINI_MODEL` in
`backend/.env` to whatever the current flash-tier model is called — no
code change needed:

```
GEMINI_MODEL=gemini-2.0-flash
```

## What it can and can't do

The assistant is told what Cukai actually does (budgets, tax relief
tracking, receipt scanning) and told not to claim things it can't do yet
(reading real bank accounts, filing taxes). It doesn't currently see the
user's real financial data as context — it answers from general knowledge
plus what's in the conversation itself. Wiring in real account/budget
data as context is a reasonable next step, not done here.
