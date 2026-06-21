"""
Email sender for agent notifications.

Uses SMTP for real sending; defaults to dry-run mode that writes .eml files.
"""

from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EML_DIR = PROJECT_ROOT / "data" / "outputs" / "eml"


def _ensure_dirs() -> None:
    EML_DIR.mkdir(parents=True, exist_ok=True)


def _smtp_config() -> dict:
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASS", ""),
        "from_email": os.getenv("FROM_EMAIL", "btp-parking-agent@example.com"),
    }


def send_email(
    to: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
    dry_run: bool = True,
) -> dict:
    """Send an email or write an .eml file if dry_run=True."""
    _ensure_dirs()
    config = _smtp_config()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config["from_email"]
    msg["To"] = to

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    if dry_run:
        eml_path = EML_DIR / f"{to.replace('@', '_at_')}_{subject.replace(' ', '_')[:50]}.eml"
        eml_path.write_bytes(msg.as_bytes())
        return {"sent": False, "dry_run": True, "eml_path": str(eml_path)}

    if not config["user"] or not config["password"]:
        raise RuntimeError("SMTP_USER and SMTP_PASS must be set for real email sending")

    with smtplib.SMTP(config["host"], config["port"]) as server:
        server.starttls()
        server.login(config["user"], config["password"])
        server.sendmail(config["from_email"], [to], msg.as_bytes())

    return {"sent": True, "dry_run": False, "to": to}
