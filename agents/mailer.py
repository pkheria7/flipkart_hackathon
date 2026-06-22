"""
Email sender for agent notifications.

Uses SMTP for real sending; defaults to dry-run mode that writes .eml files.

Dry-run emails are written to:
    data/outputs/eml/<run_id>/<recipient>_<subject_slug>.eml

When run_id is not provided, emails go to the flat eml/ directory (legacy).
"""

from __future__ import annotations

import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EML_DIR      = PROJECT_ROOT / "data" / "outputs" / "eml"


def _ensure_dirs(eml_dir: Path) -> None:
    eml_dir.mkdir(parents=True, exist_ok=True)


def _smtp_config() -> dict:
    return {
        "host":       os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port":       int(os.getenv("SMTP_PORT", "587")),
        "user":       os.getenv("SMTP_USER", ""),
        "password":   os.getenv("SMTP_PASS", ""),
        "from_email": os.getenv("FROM_EMAIL", "btp-parking-agent@example.com"),
    }


def _safe_slug(text: str, maxlen: int = 50) -> str:
    """Convert text to a filesystem-safe slug."""
    slug = re.sub(r"[^a-zA-Z0-9._-]", "_", text)
    return slug[:maxlen]


def send_email(
    to:         str,
    subject:    str,
    body_text:  str,
    body_html:  Optional[str] = None,
    dry_run:    bool          = True,
    run_id:     Optional[str] = None,
) -> dict:
    """
    Send an email or write an .eml file if dry_run=True.

    Parameters
    ----------
    to:        Recipient email address.
    subject:   Email subject line.
    body_text: Plain-text body.
    body_html: Optional HTML body.
    dry_run:   If True, write .eml instead of sending via SMTP.
    run_id:    When set, eml files go to eml/<run_id>/ subfolder.
               When None, eml files go to the flat eml/ directory.
    """
    config = _smtp_config()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = config["from_email"]
    msg["To"]      = to

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    if dry_run:
        eml_dir = (EML_DIR / run_id) if run_id else EML_DIR
        _ensure_dirs(eml_dir)
        recipient_slug = _safe_slug(to.replace("@", "_at_"))
        subject_slug   = _safe_slug(subject)
        eml_path = eml_dir / f"{recipient_slug}_{subject_slug}.eml"
        eml_path.write_bytes(msg.as_bytes())
        return {"sent": False, "dry_run": True, "eml_path": str(eml_path), "run_id": run_id}

    if not config["user"] or not config["password"]:
        raise RuntimeError("SMTP_USER and SMTP_PASS must be set for real email sending")

    with smtplib.SMTP(config["host"], config["port"]) as server:
        server.starttls()
        server.login(config["user"], config["password"])
        server.sendmail(config["from_email"], [to], msg.as_bytes())

    return {"sent": True, "dry_run": False, "to": to, "run_id": run_id}
