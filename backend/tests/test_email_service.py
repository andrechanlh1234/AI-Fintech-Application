"""Email transport selection (backend/email_service.py).

Item 3 of the roadmap: Resend's free tier can only deliver to the address
you signed up to Resend with until a domain is verified there -- no
domain is available yet, but a real Gmail account is, so Gmail SMTP
(App Password, no domain needed) is now the preferred transport when
configured, with Resend kept as a fallback for later (once a domain
exists) and the pre-existing "log and skip" behavior kept as the final
fallback so signup never fails because email delivery isn't configured.

Mocks smtplib.SMTP_SSL and httpx.post -- no real email is ever sent by
these tests.
"""

from unittest.mock import MagicMock, patch

from backend import email_service


def test_gmail_used_when_configured(monkeypatch):
    monkeypatch.setattr(email_service, "GMAIL_ADDRESS", "me@gmail.com")
    monkeypatch.setattr(email_service, "GMAIL_APP_PASSWORD", "app-password")
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "")

    mock_server = MagicMock()
    mock_smtp = MagicMock()
    mock_smtp.return_value.__enter__.return_value = mock_server
    with patch("smtplib.SMTP_SSL", mock_smtp), patch("httpx.post") as mock_post:
        email_service._send("someone@example.com", "Hi", "<p>hi</p>", "Test email")

    mock_smtp.assert_called_once_with("smtp.gmail.com", 465, timeout=10)
    mock_server.login.assert_called_once_with("me@gmail.com", "app-password")
    assert mock_server.sendmail.call_count == 1
    from_addr, to_addrs, message = mock_server.sendmail.call_args[0]
    assert from_addr == "me@gmail.com"
    assert to_addrs == ["someone@example.com"]
    assert "someone@example.com" in message
    assert "Hi" in message
    mock_post.assert_not_called()  # Resend never touched


def test_prefers_gmail_over_resend_when_both_configured(monkeypatch):
    monkeypatch.setattr(email_service, "GMAIL_ADDRESS", "me@gmail.com")
    monkeypatch.setattr(email_service, "GMAIL_APP_PASSWORD", "app-password")
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "re_key")

    mock_server = MagicMock()
    mock_smtp = MagicMock()
    mock_smtp.return_value.__enter__.return_value = mock_server
    with patch("smtplib.SMTP_SSL", mock_smtp), patch("httpx.post") as mock_post:
        email_service._send("someone@example.com", "Hi", "<p>hi</p>", "Test email")

    mock_smtp.assert_called_once()
    mock_post.assert_not_called()


def test_falls_back_to_resend_when_gmail_not_configured(monkeypatch):
    monkeypatch.setattr(email_service, "GMAIL_ADDRESS", "")
    monkeypatch.setattr(email_service, "GMAIL_APP_PASSWORD", "")
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "re_key")
    monkeypatch.setattr(email_service, "RESEND_FROM", "Cukai <onboarding@resend.dev>")

    mock_response = MagicMock(status_code=200)
    with patch("smtplib.SMTP_SSL") as mock_smtp, patch("httpx.post", return_value=mock_response) as mock_post:
        email_service._send("someone@example.com", "Hi", "<p>hi</p>", "Test email")

    mock_smtp.assert_not_called()
    mock_post.assert_called_once()
    assert mock_post.call_args.kwargs["json"]["to"] == ["someone@example.com"]


def test_skips_silently_when_nothing_configured(monkeypatch):
    monkeypatch.setattr(email_service, "GMAIL_ADDRESS", "")
    monkeypatch.setattr(email_service, "GMAIL_APP_PASSWORD", "")
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "")

    with patch("smtplib.SMTP_SSL") as mock_smtp, patch("httpx.post") as mock_post:
        email_service._send("someone@example.com", "Hi", "<p>hi</p>", "Test email")  # must not raise

    mock_smtp.assert_not_called()
    mock_post.assert_not_called()


def test_gmail_send_failure_does_not_raise(monkeypatch):
    monkeypatch.setattr(email_service, "GMAIL_ADDRESS", "me@gmail.com")
    monkeypatch.setattr(email_service, "GMAIL_APP_PASSWORD", "wrong-password")

    with patch("smtplib.SMTP_SSL", side_effect=RuntimeError("auth failed")):
        email_service._send("someone@example.com", "Hi", "<p>hi</p>", "Test email")  # must not raise
