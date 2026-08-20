"""Transactional email — currently just the "Welcome to Cukai" email sent
once, on first-time account creation (not on every login).

Uses Resend (https://resend.com) — a plain HTTP API, no SDK needed. Config
via the RESEND_API_KEY env var (see backend/.env, loaded by main.py via
python-dotenv before this module is imported). If it's unset, sending is
skipped with a log line — signup must never fail because email delivery
did, the same "degrades gracefully when unconfigured" contract the Google
OAuth integration already holds (see backend/google_oauth.py).

See backend/EMAIL_SETUP.md for how to obtain an API key.
"""

import logging
import os

import httpx

logger = logging.getLogger("cukai.email")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Scoped to this one logger only — deliberately not touching the root
    # logger's config, which would make third-party libraries noisy too.
    logger.addHandler(logging.StreamHandler())
    logger.propagate = False

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "Cukai <onboarding@resend.dev>")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# No real Cukai social accounts exist yet — these stay "#" until someone
# sets the env vars, rather than a made-up-looking URL.
TWITTER_URL = os.environ.get("CUKAI_TWITTER_URL", "#")
INSTAGRAM_URL = os.environ.get("CUKAI_INSTAGRAM_URL", "#")
LINKEDIN_URL = os.environ.get("CUKAI_LINKEDIN_URL", "#")

ACCENT = "#1F7A2E"  # app/src/styles/overrides.css --color-accent-500 (the v7 accent green)


def _welcome_html(name: str | None) -> str:
    greeting = f"Welcome to Cukai, {name}!" if name else "Welcome to Cukai!"
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:{ACCENT};padding:28px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;">Cukai</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">{greeting}</h1>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;">
                  Cukai is your personal finance and Malaysian tax operating system — track your
                  net worth, set budgets, and see exactly which LHDN tax reliefs you qualify for
                  as you spend, with receipt scanning that reads the details for you.
                </p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#44403c;">
                  Your account is ready. Jump back in whenever you like — everything you've
                  entered is saved to your account and follows you across devices.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:{ACCENT};">
                      <a href="{FRONTEND_URL}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                        Open Cukai
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e7e5e4;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:16px;"><a href="{TWITTER_URL}" style="color:#78716c;font-size:12px;text-decoration:none;">Twitter</a></td>
                    <td style="padding-right:16px;"><a href="{INSTAGRAM_URL}" style="color:#78716c;font-size:12px;text-decoration:none;">Instagram</a></td>
                    <td><a href="{LINKEDIN_URL}" style="color:#78716c;font-size:12px;text-decoration:none;">LinkedIn</a></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _reset_html(reset_link: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:{ACCENT};padding:28px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;">Cukai</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Reset your password</h1>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;">
                  Someone (hopefully you) asked to reset the password on your Cukai account. This
                  link works for 1 hour. If you didn't request this, you can safely ignore this
                  email — your password won't change unless you click through and set a new one.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                  <tr>
                    <td style="border-radius:8px;background:{ACCENT};">
                      <a href="{reset_link}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _send(to_email: str, subject: str, html: str, log_label: str) -> None:
    if not RESEND_API_KEY:
        logger.info("%s not configured — skipped (%s)", log_label, to_email)
        return
    try:
        res = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": RESEND_FROM, "to": [to_email], "subject": subject, "html": html},
            timeout=10,
        )
        if res.status_code >= 400:
            logger.warning("%s to %s failed: %s %s", log_label, to_email, res.status_code, res.text)
    except Exception:
        # Sending an email is never allowed to break the request that triggered it.
        logger.exception("%s failed to send to %s", log_label, to_email)


def send_welcome_email(to_email: str, name: str | None) -> None:
    _send(to_email, "Welcome to Cukai", _welcome_html(name), "Welcome email")


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    _send(to_email, "Reset your Cukai password", _reset_html(reset_link), "Password reset email")
