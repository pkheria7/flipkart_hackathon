"""
Feedback ingestor for officer and citizen feedback.

Wraps the M12 feedback backend and provides agent-friendly helpers.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.officer.feedback_backend import (
    insert_feedback,
    get_feedback_summary_for_scoring,
)
from app.utils.db_helpers import get_sqlite_connection

VALID_OFFICER_ACTIONS = {"towed", "warned", "could_not_enforce"}
VALID_OFFICER_OUTCOMES = {"resolved", "recurred", "no_violation"}
VALID_REASON_CODES = {
    "no_parking_space",
    "customer_waiting",
    "loading",
    "broke_down",
    "ignored_sign",
    "other",
}
VALID_SOURCES = {"officer", "citizen", "synthetic_demo"}

# Mapping from agent-friendly terms to M12 backend enum values
ACTION_MAP = {
    "towed": "towing",
    "warned": "challan",
    "could_not_enforce": "other",
}
OUTCOME_MAP = {
    "resolved": "improved",
    "recurred": "recurred",
    "no_violation": "no_change",
}


def ingest_officer_feedback(
    cluster_id: str,
    officer_id: str,
    action: str,
    outcome: str,
    reason_code: str | None = None,
    reason_text: str | None = None,
    assigned_station: str | None = None,
    source: str = "officer",
) -> dict:
    """Insert an officer feedback event."""
    if action not in VALID_OFFICER_ACTIONS:
        raise ValueError(f"action must be one of {VALID_OFFICER_ACTIONS}")
    if outcome not in VALID_OFFICER_OUTCOMES:
        raise ValueError(f"outcome must be one of {VALID_OFFICER_OUTCOMES}")
    if reason_code and reason_code not in VALID_REASON_CODES:
        raise ValueError(f"reason_code must be one of {VALID_REASON_CODES}")
    if source not in VALID_SOURCES:
        raise ValueError(f"source must be one of {VALID_SOURCES}")

    backend_action = ACTION_MAP[action]
    backend_outcome = OUTCOME_MAP[outcome]
    enforcement_done = 1 if action != "could_not_enforce" else 0
    recurred = 1 if outcome == "recurred" else 0

    notes = reason_text or ""
    if reason_code:
        notes = f"[{reason_code}] {notes}".strip()

    row_id = insert_feedback(
        cluster_id=cluster_id,
        action_type=backend_action,
        enforcement_done=enforcement_done,
        outcome=backend_outcome,
        officer_id=officer_id,
        assigned_station=assigned_station or "",
        recurred_after_enforcement=recurred,
        notes=notes,
        source=source,
    )

    return {
        "row_id": row_id,
        "cluster_id": cluster_id,
        "officer_id": officer_id,
        "action": action,
        "outcome": outcome,
        "source": source,
    }


def ingest_citizen_feedback(
    cluster_id: str,
    reason_code: str,
    reason_text: str | None = None,
    source: str = "citizen",
) -> dict:
    """Insert a citizen feedback event into a dedicated citizen_feedback table."""
    if reason_code not in VALID_REASON_CODES:
        raise ValueError(f"reason_code must be one of {VALID_REASON_CODES}")
    if source not in VALID_SOURCES:
        raise ValueError(f"source must be one of {VALID_SOURCES}")

    from app.officer.feedback_backend import get_db_path

    now = datetime.now(timezone.utc)
    with get_sqlite_connection(get_db_path()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS citizen_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cluster_id TEXT NOT NULL,
                reason_code TEXT,
                reason_text TEXT,
                source TEXT,
                created_at_ist TEXT,
                created_at TEXT
            )
            """
        )
        cursor.execute(
            """
            INSERT INTO citizen_feedback (cluster_id, reason_code, reason_text, source, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (cluster_id, reason_code, reason_text or "", source, now.isoformat()),
        )
        conn.commit()
        row_id = cursor.lastrowid

    return {
        "row_id": row_id,
        "cluster_id": cluster_id,
        "reason_code": reason_code,
        "source": source,
    }


def read_feedback_for_period(days: int = 7) -> dict:
    """Return feedback summary for the last N days."""
    return get_feedback_summary_for_scoring(days=days)


def clear_synthetic_feedback() -> None:
    """Remove all synthetic_demo feedback events (useful for clean re-runs)."""
    from app.officer.feedback_backend import get_db_path

    with get_sqlite_connection(get_db_path()) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM feedback_events WHERE source = ?", ("synthetic_demo",))
        try:
            cursor.execute("DELETE FROM citizen_feedback WHERE source = ?", ("synthetic_demo",))
        except Exception:
            pass  # table may not exist yet
        conn.commit()
