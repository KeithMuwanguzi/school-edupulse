"""Transactional email via SMTP (credentials, password resets)."""
from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("skulpulse.email")


def _send_sync(*, to: str, subject: str, text: str, html: str) -> None:
    if not settings.smtp_host:
        raise RuntimeError("SMTP host is not configured.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    if settings.smtp_use_tls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)


async def send_email(*, to: str, subject: str, text: str, html: str) -> bool:
    """Send an email. Returns True on success, False when disabled or on failure."""
    to = to.strip()
    if not to:
        return False
    if not settings.smtp_enabled:
        log.warning("email.skipped", reason="smtp_disabled", to=to, subject=subject)
        return False
    try:
        await asyncio.to_thread(
            _send_sync,
            to=to,
            subject=subject,
            text=text,
            html=html,
        )
        log.info("email.sent", to=to, subject=subject)
        return True
    except Exception:
        log.exception("email.failed", to=to, subject=subject)
        return False


def _credentials_html(
    *,
    school_name: str,
    username: str,
    password: str,
    portal_url: str,
    intro: str,
) -> str:
    return f"""<!DOCTYPE html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1e293b;max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#15655a;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px">
    <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#e5a627">SkulPulse</p>
    <h1 style="margin:8px 0 0;font-size:22px;font-weight:600">{school_name}</h1>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;background:#fff">
    <p>{intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:8px 0;color:#64748b;width:120px">Portal URL</td><td><a href="{portal_url}">{portal_url}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Username</td><td><strong>{username}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Password</td><td><strong>{password}</strong></td></tr>
    </table>
    <p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;font-size:13px;color:#92400e">
      For security, you will be asked to choose a new password the first time you sign in.
    </p>
    <p style="font-size:12px;color:#64748b;margin-top:24px">Questions? Reply to this email or contact info@skulpulse.com</p>
  </div>
</body></html>"""


def _credentials_text(
    *,
    school_name: str,
    username: str,
    password: str,
    portal_url: str,
    intro: str,
) -> str:
    return (
        f"{school_name} — SkulPulse\n\n"
        f"{intro}\n\n"
        f"Portal: {portal_url}\n"
        f"Username: {username}\n"
        f"Password: {password}\n\n"
        "You will be asked to choose a new password on first sign-in.\n"
    )


async def send_guardian_portal_credentials(
    *,
    to: str,
    school_name: str,
    username: str,
    password: str,
    child_name: str | None = None,
) -> bool:
    child_label = child_name or "your child"
    intro = (
        f"A parent portal login for {child_label} at {school_name} is ready. "
        "All guardians of this learner share the same username and password below."
    )
    subject = f"Parent portal access — {school_name}"
    portal_url = settings.tenant_portal_url.rstrip("/")
    return await send_email(
        to=to,
        subject=subject,
        text=_credentials_text(
            school_name=school_name,
            username=username,
            password=password,
            portal_url=portal_url,
            intro=intro,
        ),
        html=_credentials_html(
            school_name=school_name,
            username=username,
            password=password,
            portal_url=portal_url,
            intro=intro,
        ),
    )


async def send_portal_credentials(
    *,
    to: str,
    school_name: str,
    username: str,
    password: str,
    intro: str | None = None,
) -> bool:
    portal_url = settings.tenant_portal_url.rstrip("/")
    intro_text = intro or (
        f"Your SkulPulse school portal for {school_name} is ready. "
        "Use the credentials below to sign in."
    )
    subject = f"SkulPulse portal access — {school_name}"
    return await send_email(
        to=to,
        subject=subject,
        text=_credentials_text(
            school_name=school_name,
            username=username,
            password=password,
            portal_url=portal_url,
            intro=intro_text,
        ),
        html=_credentials_html(
            school_name=school_name,
            username=username,
            password=password,
            portal_url=portal_url,
            intro=intro_text,
        ),
    )


async def send_password_reset_notice(
    *,
    to: str,
    school_name: str,
    username: str,
    password: str,
    reset_by: str,
) -> bool:
    intro = (
        f"An administrator ({reset_by}) reset your SkulPulse password for {school_name}. "
        "Sign in with the temporary password below, then choose a new one."
    )
    subject = f"SkulPulse password reset — {school_name}"
    portal_url = settings.tenant_portal_url.rstrip("/")
    return await send_email(
        to=to,
        subject=subject,
        text=_credentials_text(
            school_name=school_name,
            username=username,
            password=password,
            portal_url=portal_url,
            intro=intro,
        ),
        html=_credentials_html(
            school_name=school_name,
            username=username,
            password=password,
            portal_url=portal_url,
            intro=intro,
        ),
    )


def _platform_credentials_html(
    *,
    title: str,
    email: str,
    password: str,
    portal_url: str,
    intro: str,
) -> str:
    return f"""<!DOCTYPE html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1e293b;max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#0f172a;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px">
    <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8">SkulPulse Platform</p>
    <h1 style="margin:8px 0 0;font-size:22px;font-weight:600">{title}</h1>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;background:#fff">
    <p>{intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:8px 0;color:#64748b;width:120px">Console URL</td><td><a href="{portal_url}">{portal_url}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Email</td><td><strong>{email}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Password</td><td><strong>{password}</strong></td></tr>
    </table>
    <p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;font-size:13px;color:#92400e">
      For security, you will be asked to choose a new password the first time you sign in.
    </p>
  </div>
</body></html>"""


def _platform_credentials_text(
    *,
    title: str,
    email: str,
    password: str,
    portal_url: str,
    intro: str,
) -> str:
    return (
        f"{title} — SkulPulse Platform\n\n"
        f"{intro}\n\n"
        f"Console: {portal_url}\n"
        f"Email: {email}\n"
        f"Password: {password}\n\n"
        "You will be asked to choose a new password on first sign-in.\n"
    )


async def send_platform_admin_credentials(
    *,
    to: str,
    name: str,
    email: str,
    password: str,
    intro: str | None = None,
) -> bool:
    portal_url = settings.platform_portal_url.rstrip("/")
    intro_text = intro or (
        "Your SkulPulse platform administrator account is ready. "
        "Use the credentials below to sign in to the platform console."
    )
    subject = "SkulPulse platform administrator access"
    return await send_email(
        to=to,
        subject=subject,
        text=_platform_credentials_text(
            title=name,
            email=email,
            password=password,
            portal_url=portal_url,
            intro=intro_text,
        ),
        html=_platform_credentials_html(
            title=name,
            email=email,
            password=password,
            portal_url=portal_url,
            intro=intro_text,
        ),
    )


async def send_platform_admin_password_reset(
    *,
    to: str,
    name: str,
    email: str,
    password: str,
    reset_by: str,
) -> bool:
    intro = (
        f"An administrator ({reset_by}) reset your SkulPulse platform console password. "
        "Sign in with the temporary password below, then choose a new one."
    )
    subject = "SkulPulse platform password reset"
    portal_url = settings.platform_portal_url.rstrip("/")
    return await send_email(
        to=to,
        subject=subject,
        text=_platform_credentials_text(
            title=name,
            email=email,
            password=password,
            portal_url=portal_url,
            intro=intro,
        ),
        html=_platform_credentials_html(
            title=name,
            email=email,
            password=password,
            portal_url=portal_url,
            intro=intro,
        ),
    )
