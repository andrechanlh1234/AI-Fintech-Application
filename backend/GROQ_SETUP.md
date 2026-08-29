# Setting up real AI chat replies (free, fast — Groq)

The code side is done. This is what you need to do to get the AI tab
answering with a real model instead of its canned/scripted replies.

Groq runs GPT-OSS 120B (OpenAI open-weight) on their own inference hardware — it's the
fastest free option, usually answering a short finance question in about
a second.

## 1. Get a free Groq API key

1. Go to https://console.groq.com/keys and sign in (Google/GitHub is fine).
2. Click **Create API Key**, give it a name, copy it — it's shown once.

No credit card required.

## 2. Put it in `backend/.env`

Add to `backend/.env` (create it if it doesn't exist yet):

```
GROQ_API_KEY=your_key_here
```

Optional — pin a different model:

```
GROQ_MODEL=openai/gpt-oss-120b
```

## 3. Restart the backend

```bash
backend/.venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

That's it. Without `GROQ_API_KEY` set, the backend falls back to
`GEMINI_API_KEY` if that's configured (see `GEMINI_SETUP.md`), and if
neither is set the AI tab still works — it just uses the client-side
canned replies (the backend logs "No AI provider configured — falling
back to canned replies").

## Free-tier limits

Groq's free tier is generous (roughly 30 requests/minute and thousands
per day for this model), but the numbers change — check
https://console.groq.com/docs/rate-limits for the current values. As a
safety net regardless, this backend caps AI chat itself at 20 messages
per 10 minutes per visitor (`backend/rate_limit.py`).

## Provider order

`backend/ai_chat.py` picks a provider per request:

1. **Groq** if `GROQ_API_KEY` is set — primary.
2. **Gemini** if only `GEMINI_API_KEY` is set — fallback.
3. **Canned** client-side replies if neither is set, or if the API call
   fails for any reason. A chat reply never comes back as an HTTP error.

The response's `source` field (`"groq"` / `"gemini"` / `"canned"`) tells
the frontend which one answered.
