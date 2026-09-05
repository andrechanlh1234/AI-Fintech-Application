"""Transactional email — currently just the "Welcome to Cukai" email sent
once, on first-time account creation (not on every login).

Two transports, tried in this order, each degrading to the next when
unconfigured — signup must never fail because email delivery isn't set
up, the same contract the Google OAuth integration already holds (see
backend/google_oauth.py):

1. **Gmail SMTP** (a real Gmail account + an App Password) — no domain
   needed, so this is the practical option before Cukai owns a domain.
   Can send to any real recipient today.
2. **Resend** (https://resend.com) — a plain HTTP API, no SDK needed.
   Kept for later: once a domain is verified there, Resend is the more
   scalable choice. Until a domain is verified, Resend's free tier can
   only deliver to the address you signed up to Resend with — every
   other recipient is silently accepted but never delivered.
3. Neither configured — sending is skipped with a log line.

See backend/EMAIL_SETUP.md for how to set up either one.
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger("cukai.email")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Scoped to this one logger only — deliberately not touching the root
    # logger's config, which would make third-party libraries noisy too.
    logger.addHandler(logging.StreamHandler())
    logger.propagate = False

GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
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


def _reset_html(code: str) -> str:
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
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#44403c;">
                  Someone (hopefully you) asked to reset the password on your Cukai account.
                  Enter this code in the app to set a new password. It expires in 15 minutes.
                  If you didn't request this, you can safely ignore this email.
                </p>
                <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1a1a1a;background:#f5f5f4;border-radius:10px;padding:18px 0;text-align:center;">
                  {code}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _send_via_gmail(to_email: str, subject: str, html: str, log_label: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Cukai <{GMAIL_ADDRESS}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())
    except Exception:
        # Sending an email is never allowed to break the request that triggered it.
        logger.exception("%s failed to send via Gmail to %s", log_label, to_email)


def _send_via_resend(to_email: str, subject: str, html: str, log_label: str) -> None:
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
        logger.exception("%s failed to send to %s", log_label, to_email)


def _send(to_email: str, subject: str, html: str, log_label: str) -> None:
    if GMAIL_ADDRESS and GMAIL_APP_PASSWORD:
        _send_via_gmail(to_email, subject, html, log_label)
        return
    if RESEND_API_KEY:
        _send_via_resend(to_email, subject, html, log_label)
        return
    logger.info("%s not configured — skipped (%s)", log_label, to_email)


def send_welcome_email(to_email: str, name: str | None) -> None:
    _send(to_email, "Welcome to Cukai", _welcome_html(name), "Welcome email")


def send_password_reset_email(to_email: str, code: str) -> None:
    email_configured = (GMAIL_ADDRESS and GMAIL_APP_PASSWORD) or RESEND_API_KEY
    if not email_configured:
        # Dev affordance: with no email provider configured the code would
        # otherwise be unreachable. Never logged once a transport above is
        # configured (then it's actually emailed instead).
        logger.info("Password reset code for %s: %s", to_email, code)
    _send(to_email, "Your Cukai password reset code", _reset_html(code), "Password reset email")
