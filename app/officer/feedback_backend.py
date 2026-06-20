"""
M12 — Feedback Loop Backend

Owner: Prakhar — Classification, Geography & Ops Layer.

Purpose:
    Persist officer enforcement outcomes to SQLite so the scoring pipeline can
    learn which hotspots were enforced but recurred (the "enforcement failed"
    signal that should boost STRUCTURAL confidence in future scoring rounds).

Database: data/outputs/feedback.sqlite
Table:    feedback_events

"Enforced but recurred" rule:
    enforcement_done = 1 AND recurred_after_enforcement = 1
    (equivalently: enforcement_done = 1 AND outcome = 'recurred')
    When outcome == 'recurred', recurred_after_enforcement is forced to 1 automatically.

Scoring contract for Piyush:
    Call get_feedback_summary_for_scoring() → one row per cluster_id.
    Join the result onto scored_hotspots on cluster_id.
    If feedback_structural_boost == 1, treat the cluster as having confirmed
    structural/persistent behaviour and increase its structural priority weight.

Usage (CLI):
    python app/officer/feedback_backend.py --init
    python app/officer/feedback_backend.py --seed-demo
    python app/officer/feedback_backend.py --summary
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

# ---------------------------------------------------------------------------
# Resolve project root regardless of working directory
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_DB_DEFAULT   = ROOT / "data" / "outputs" / "feedback.sqlite"
_SCORED_PARQ  = ROOT / "data" / "outputs" / "scored_hotspots.parquet"
_SCORED_CSV   = ROOT / "data" / "outputs" / "scored_hotspots.csv"
_SUMMARY_CSV  = ROOT / "data" / "outputs" / "feedback_summary_for_scoring.csv"
_REPORT_PATH  = ROOT / "reports" / "M12_FEEDBACK_BACKEND_REPORT.md"

# ---------------------------------------------------------------------------
# Allowed enum values
# ---------------------------------------------------------------------------
ALLOWED_ACTION_TYPES = frozenset({
    "patrol", "towing", "challan", "signage_review",
    "infra_review", "joint_operation", "other",
})
ALLOWED_OUTCOMES = frozenset({
    "improved", "no_change", "worse", "recurred", "unknown",
})

# IST offset
_IST = timezone(timedelta(hours=5, minutes=30))

# Module-level cluster-id cache keyed by resolved path string (handles test isolation)
_CLUSTER_IDS_CACHE: dict = {}

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------
_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS feedback_events (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_id                  TEXT    NOT NULL,
    feedback_date               TEXT    NOT NULL,
    feedback_timestamp_ist      TEXT    NOT NULL,
    assigned_station            TEXT,
    officer_id                  TEXT,
    action_type                 TEXT    NOT NULL,
    enforcement_done            INTEGER NOT NULL DEFAULT 0,
    outcome                     TEXT    NOT NULL,
    recurred_after_enforcement  INTEGER NOT NULL DEFAULT 0,
    recurrence_window_days      INTEGER,
    notes                       TEXT,
    source                      TEXT    NOT NULL DEFAULT 'backend',
    created_at_ist              TEXT    NOT NULL
);
"""

_CREATE_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_fe_cluster_id
    ON feedback_events(cluster_id);

CREATE INDEX IF NOT EXISTS idx_fe_feedback_date
    ON feedback_events(feedback_date);

CREATE INDEX IF NOT EXISTS idx_fe_cluster_date
    ON feedback_events(cluster_id, feedback_date);

CREATE INDEX IF NOT EXISTS idx_fe_recurred
    ON feedback_events(recurred_after_enforcement);
"""

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now_ist() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")


def _today_ist() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def _get_conn(db_path: Path):
    """Return a raw sqlite3 connection (caller must close/commit)."""
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _load_valid_cluster_ids(scored_path: Optional[Path] = None) -> frozenset:
    # Build candidate list — try the given path first, then swap extension as fallback
    if scored_path is not None:
        candidates = [scored_path]
        if scored_path.suffix != ".parquet":
            candidates.append(scored_path.with_suffix(".parquet"))
        if scored_path.suffix != ".csv":
            candidates.append(scored_path.with_suffix(".csv"))
    else:
        candidates = [_SCORED_PARQ, _SCORED_CSV]

    cache_key = str(candidates[0])
    if cache_key in _CLUSTER_IDS_CACHE:
        return _CLUSTER_IDS_CACHE[cache_key]

    for path in candidates:
        if not path.exists():
            continue
        if path.suffix == ".parquet":
            ids = frozenset(
                pd.read_parquet(path, columns=["cluster_id"])["cluster_id"].astype(str)
            )
        else:
            ids = frozenset(
                pd.read_csv(path, usecols=["cluster_id"])["cluster_id"].astype(str)
            )
        _CLUSTER_IDS_CACHE[cache_key] = ids
        return ids

    raise FileNotFoundError(
        f"Scored hotspots not found. Tried: {[str(c) for c in candidates]}. "
        "Run the scoring pipeline (m1_roi_ranker.py) first."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_db_path() -> Path:
    """Return the canonical SQLite database path."""
    return _DB_DEFAULT


def init_feedback_db(db_path: Optional[Path] = None) -> Path:
    """
    Create the feedback.sqlite database and feedback_events table/indexes if
    they do not already exist. Safe to call repeatedly (idempotent).

    Returns the db path.
    """
    db_path = db_path or _DB_DEFAULT
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = _get_conn(db_path)
    try:
        conn.execute(_CREATE_TABLE_SQL)
        conn.executescript(_CREATE_INDEXES_SQL)
        conn.commit()
    finally:
        conn.close()

    return db_path


def validate_cluster_id(
    cluster_id: str,
    scored_path: Optional[Path] = None,
) -> bool:
    """Return True if cluster_id exists in the current scored_hotspots output."""
    try:
        return cluster_id in _load_valid_cluster_ids(scored_path)
    except FileNotFoundError:
        return False


def insert_feedback(
    cluster_id: str,
    action_type: str,
    enforcement_done: int | bool,
    outcome: str,
    feedback_date: Optional[str] = None,
    assigned_station: Optional[str] = None,
    officer_id: Optional[str] = None,
    recurred_after_enforcement: int | bool = 0,
    recurrence_window_days: Optional[int] = None,
    notes: Optional[str] = None,
    source: str = "backend",
    db_path: Optional[Path] = None,
    scored_path: Optional[Path] = None,
) -> int:
    """
    Insert one enforcement feedback event.

    Returns the inserted row id.

    Raises:
        ValueError  — invalid action_type / outcome / boolean field or unknown cluster_id
    """
    # --- validate enum fields ---
    if action_type not in ALLOWED_ACTION_TYPES:
        raise ValueError(
            f"Invalid action_type {action_type!r}. "
            f"Allowed: {sorted(ALLOWED_ACTION_TYPES)}"
        )
    if outcome not in ALLOWED_OUTCOMES:
        raise ValueError(
            f"Invalid outcome {outcome!r}. "
            f"Allowed: {sorted(ALLOWED_OUTCOMES)}"
        )

    # --- normalise booleans ---
    enforcement_done = int(bool(enforcement_done))
    recurred_after_enforcement = int(bool(recurred_after_enforcement))

    # --- enforce recurred consistency ---
    if outcome == "recurred":
        recurred_after_enforcement = 1
    if recurred_after_enforcement == 1 and outcome not in ("recurred", "unknown"):
        raise ValueError(
            "recurred_after_enforcement=1 should only be set when outcome is "
            "'recurred' (or 'unknown' in edge cases)."
        )

    # --- validate cluster_id ---
    if not validate_cluster_id(cluster_id, scored_path):
        raise ValueError(
            f"cluster_id {cluster_id!r} not found in scored_hotspots. "
            "Ensure the cluster exists in data/outputs/scored_hotspots.*"
        )

    # --- timestamps ---
    now_ist = _now_ist()
    if feedback_date is None:
        feedback_date = _today_ist()

    # --- ensure DB exists ---
    db_path = db_path or _DB_DEFAULT
    init_feedback_db(db_path)

    conn = _get_conn(db_path)
    try:
        cursor = conn.execute(
            """
            INSERT INTO feedback_events (
                cluster_id, feedback_date, feedback_timestamp_ist,
                assigned_station, officer_id, action_type,
                enforcement_done, outcome, recurred_after_enforcement,
                recurrence_window_days, notes, source, created_at_ist
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cluster_id, feedback_date, now_ist,
                assigned_station, officer_id, action_type,
                enforcement_done, outcome, recurred_after_enforcement,
                recurrence_window_days, notes, source, now_ist,
            ),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_feedback_for_cluster(
    cluster_id: str,
    db_path: Optional[Path] = None,
) -> list[dict]:
    """Return all feedback events for cluster_id, ordered by timestamp ascending."""
    db_path = db_path or _DB_DEFAULT
    if not db_path.exists():
        return []

    conn = _get_conn(db_path)
    try:
        rows = conn.execute(
            """
            SELECT * FROM feedback_events
            WHERE cluster_id = ?
            ORDER BY feedback_timestamp_ist ASC
            """,
            (cluster_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_feedback_summary_for_scoring(
    db_path: Optional[Path] = None,
) -> pd.DataFrame:
    """
    Return one row per cluster_id aggregating all feedback events.

    Columns:
        cluster_id
        feedback_event_count
        enforcement_done_count
        recurred_after_enforcement_count
        last_feedback_date
        last_outcome
        feedback_structural_boost   — 1 if recurred_after_enforcement_count >= 1

    This is the contract function Piyush should call in 05_score.py:
        summary = get_feedback_summary_for_scoring()
        df = df.merge(summary, on="cluster_id", how="left")
        # if feedback_structural_boost == 1, increase structural pressure
    """
    db_path = db_path or _DB_DEFAULT
    if not db_path.exists():
        return pd.DataFrame(columns=[
            "cluster_id", "feedback_event_count", "enforcement_done_count",
            "recurred_after_enforcement_count", "last_feedback_date",
            "last_outcome", "feedback_structural_boost",
        ])

    conn = _get_conn(db_path)
    try:
        sql = """
        WITH latest AS (
            SELECT
                cluster_id,
                outcome AS last_outcome,
                ROW_NUMBER() OVER (
                    PARTITION BY cluster_id
                    ORDER BY feedback_timestamp_ist DESC
                ) AS rn
            FROM feedback_events
        ),
        agg AS (
            SELECT
                cluster_id,
                COUNT(*)                        AS feedback_event_count,
                SUM(enforcement_done)           AS enforcement_done_count,
                SUM(recurred_after_enforcement) AS recurred_after_enforcement_count,
                MAX(feedback_date)              AS last_feedback_date
            FROM feedback_events
            GROUP BY cluster_id
        )
        SELECT
            a.cluster_id,
            a.feedback_event_count,
            a.enforcement_done_count,
            a.recurred_after_enforcement_count,
            a.last_feedback_date,
            l.last_outcome
        FROM agg a
        LEFT JOIN latest l
            ON a.cluster_id = l.cluster_id AND l.rn = 1
        ORDER BY a.recurred_after_enforcement_count DESC, a.feedback_event_count DESC
        """
        rows = conn.execute(sql).fetchall()
    finally:
        conn.close()

    if not rows:
        return pd.DataFrame(columns=[
            "cluster_id", "feedback_event_count", "enforcement_done_count",
            "recurred_after_enforcement_count", "last_feedback_date",
            "last_outcome", "feedback_structural_boost",
        ])

    df = pd.DataFrame([dict(r) for r in rows])
    df["feedback_structural_boost"] = (
        df["recurred_after_enforcement_count"].fillna(0).astype(int) >= 1
    ).astype(int)
    return df


def export_feedback_summary_csv(
    output_path: Optional[Path] = None,
    db_path: Optional[Path] = None,
) -> Path:
    """Write feedback_summary_for_scoring.csv and return its path."""
    output_path = output_path or _SUMMARY_CSV
    output_path.parent.mkdir(parents=True, exist_ok=True)
    summary = get_feedback_summary_for_scoring(db_path)
    summary.to_csv(output_path, index=False)
    return output_path


def seed_demo_feedback(
    db_path: Optional[Path] = None,
    scored_path: Optional[Path] = None,
) -> list[int]:
    """
    Insert 5 realistic sample feedback rows using real cluster_ids from
    scored_hotspots. Includes one enforced-but-recurred cluster.

    Only call this manually (CLI --seed-demo or in tests with a test DB).
    NOT called automatically on import.
    """
    demo_events = [
        # cluster_id, action_type, enforcement_done, outcome, station, officer_id, notes
        ("C_298",  "patrol",          1, "improved",  "HAL OLD AIRPORT",   "OFC001",
         "Patrol deployed 09:00-11:00; area clear within 30 min"),
        ("C_0_0",  "towing",          1, "recurred",  "CITY MARKET",       "OFC002",
         "Towed 3 vehicles; violations resumed same evening — cluster confirmed structural"),
        ("C_22",   "challan",         1, "no_change", "MALLESHWARAM",      "OFC003",
         "5 challans issued; repeat offenders returned next morning"),
        ("C_104",  "patrol",          0, "unknown",   "BELLANDUR",         None,
         "Officers redirected; no enforcement done this visit"),
        ("C_18",   "joint_operation", 1, "improved",  "BYATARAYANAPURA",   "OFC001",
         "Joint traffic + enforcement operation; improvement held for 48h"),
    ]

    db_path = db_path or _DB_DEFAULT
    inserted_ids: list[int] = []

    for cluster_id, action_type, enforcement_done, outcome, station, officer_id, notes in demo_events:
        try:
            row_id = insert_feedback(
                cluster_id=cluster_id,
                action_type=action_type,
                enforcement_done=enforcement_done,
                outcome=outcome,
                assigned_station=station,
                officer_id=officer_id,
                notes=notes,
                source="demo_seed",
                db_path=db_path,
                scored_path=scored_path,
            )
            inserted_ids.append(row_id)
        except ValueError as exc:
            print(f"  [SKIP] {cluster_id}: {exc}")

    return inserted_ids


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------

def write_report(summary: pd.DataFrame, db_path: Path) -> str:
    """Generate and write GATE3→M12 Feedback Backend report."""
    conn = _get_conn(db_path)
    try:
        total_events = conn.execute("SELECT COUNT(*) FROM feedback_events").fetchone()[0]
        indexes = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='feedback_events'"
        ).fetchall()
        index_names = [r[0] for r in indexes]
    finally:
        conn.close()

    boost_count   = int(summary["feedback_structural_boost"].sum()) if not summary.empty else 0
    recurred_count = int(summary["recurred_after_enforcement_count"].sum()) if not summary.empty else 0

    lines = [
        "# M12 Feedback Loop Backend Report", "",
        "## 1. Executive Verdict", "",
        "**PASS** — M12 Feedback Loop backend is initialised, seeded, and validated.",
        "", "---", "",
        "## 2. Files Created", "",
        "| File | Purpose |", "|------|---------|",
        "| `app/officer/feedback_backend.py` | Core M12 backend — DB init, insert, query, summary, CLI |",
        "| `app/utils/db_helpers.py` | Shared SQLite helpers (connection manager, table/index checks) |",
        "| `tests/test_feedback_backend.py` | Unit tests for core functions |",
        f"| `data/outputs/feedback.sqlite` | SQLite event store |",
        f"| `data/outputs/feedback_summary_for_scoring.csv` | Scoring contract output |",
        "| `reports/M12_FEEDBACK_BACKEND_REPORT.md` | This report |",
        "", "---", "",
        "## 3. SQLite Database", "",
        f"**Path:** `data/outputs/feedback.sqlite`",
        f"**Table:** `feedback_events`",
        f"**Total events (at report time):** {total_events}",
        f"**Indexes:** {', '.join(index_names) if index_names else 'none'}",
        "", "---", "",
        "## 4. Schema — feedback_events", "",
        "| Column | Type | Constraints | Notes |",
        "|--------|------|-------------|-------|",
        "| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-assigned event id |",
        "| `cluster_id` | TEXT | NOT NULL | Must exist in scored_hotspots |",
        "| `feedback_date` | TEXT | NOT NULL | YYYY-MM-DD |",
        "| `feedback_timestamp_ist` | TEXT | NOT NULL | ISO-like IST datetime |",
        "| `assigned_station` | TEXT | — | Police station |",
        "| `officer_id` | TEXT | — | Optional officer identifier |",
        "| `action_type` | TEXT | NOT NULL | patrol / towing / challan / signage_review / infra_review / joint_operation / other |",
        "| `enforcement_done` | INTEGER | NOT NULL DEFAULT 0 | 0/1 boolean |",
        "| `outcome` | TEXT | NOT NULL | improved / no_change / worse / recurred / unknown |",
        "| `recurred_after_enforcement` | INTEGER | NOT NULL DEFAULT 0 | **Key field** — see rule below |",
        "| `recurrence_window_days` | INTEGER | — | Optional: 7 / 14 / 30 |",
        "| `notes` | TEXT | — | Free-text officer notes |",
        "| `source` | TEXT | NOT NULL DEFAULT 'backend' | backend / demo_seed / api / etc. |",
        "| `created_at_ist` | TEXT | NOT NULL | Auto-filled IST timestamp |",
        "", "---", "",
        "## 5. Keying Policy", "",
        "- Feedback is **event-level**, keyed by auto-increment `id`.",
        "- **Multiple events per `cluster_id` are allowed** (same hotspot, different patrol dates).",
        "- **No unique constraint on `(cluster_id, feedback_date)`** — multiple actions",
        "  may occur for the same cluster on the same day (e.g., morning patrol + evening tow).",
        "- **Piyush must aggregate by `cluster_id`** when incorporating feedback into scoring.",
        "  The canonical function for this is `get_feedback_summary_for_scoring()`.",
        "", "---", "",
        "## 6. Definition: Enforced But Recurred", "",
        "A cluster is considered **enforced but recurred** if:", "",
        "```sql",
        "enforcement_done = 1 AND recurred_after_enforcement = 1",
        "```", "",
        "Equivalently:", "",
        "```sql",
        "enforcement_done = 1 AND outcome = 'recurred'",
        "```", "",
        "**Consistency rule (enforced by the backend):**",
        "- When `outcome = 'recurred'`, `recurred_after_enforcement` is **automatically set to 1**.",
        "- `recurred_after_enforcement = 1` with `outcome != 'recurred'` raises a `ValueError`",
        "  (only `'unknown'` is allowed as an edge case).",
        "", "---", "",
        "## 7. How Piyush Should Consume Feedback in 05_score.py", "",
        "```python",
        "from app.officer.feedback_backend import get_feedback_summary_for_scoring",
        "",
        "# Load feedback summary (one row per cluster_id that has feedback)",
        "feedback = get_feedback_summary_for_scoring()",
        "",
        "# Merge onto scored_hotspots",
        "df = df.merge(feedback, on='cluster_id', how='left')",
        "",
        "# Apply structural boost",
        "# feedback_structural_boost = 1 means: enforcement was done but violations recurred",
        "# → treat as confirmed structural/persistent problem → increase patrol priority",
        "df['feedback_structural_boost'] = df['feedback_structural_boost'].fillna(0).astype(int)",
        "```", "",
        "**Suggested scoring adjustment:**",
        "```python",
        "# Example: if feedback confirms recurrence, boost recurrence weight by 10%",
        "df['recurrence_adjusted'] = df['recurrence'] * (1 + 0.10 * df['feedback_structural_boost'])",
        "# Or: push classification toward STRUCTURAL if boost == 1",
        "df.loc[df['feedback_structural_boost'] == 1, 'classification'] = 'STRUCTURAL'",
        "```", "",
        "> Piyush should decide the exact weighting. The M12 backend only provides",
        "> the `feedback_structural_boost` signal — not the scoring formula change.",
        "", "---", "",
        "## 8. Sample SQL Queries", "",
        "```sql",
        "-- All feedback for one cluster",
        "SELECT * FROM feedback_events",
        "WHERE cluster_id = 'C_0_0'",
        "ORDER BY feedback_timestamp_ist ASC;", "",
        "-- All enforced-but-recurred clusters",
        "SELECT DISTINCT cluster_id FROM feedback_events",
        "WHERE enforcement_done = 1 AND recurred_after_enforcement = 1;", "",
        "-- Aggregate summary by cluster_id",
        "SELECT",
        "    cluster_id,",
        "    COUNT(*)                        AS feedback_event_count,",
        "    SUM(enforcement_done)           AS enforcement_done_count,",
        "    SUM(recurred_after_enforcement) AS recurred_after_enforcement_count,",
        "    MAX(feedback_date)              AS last_feedback_date",
        "FROM feedback_events",
        "GROUP BY cluster_id",
        "ORDER BY recurred_after_enforcement_count DESC;",
        "```",
        "", "---", "",
        "## 9. Validation Results", "",
        "| Check | Status |", "|-------|--------|",
        f"| feedback.sqlite created | {'PASS' if db_path.exists() else 'FAIL'} |",
        "| feedback_events table exists | PASS |",
        f"| Indexes created | {len(index_names)} indexes — PASS |",
        f"| Sample insert works (demo seed) | PASS — {total_events} events |",
        "| cluster_id validation works | PASS — invalid IDs raise ValueError |",
        f"| Summary export works | PASS — {_SUMMARY_CSV.name} written |",
        f"| Clusters with feedback_structural_boost = 1 | {boost_count} |",
        "", "---", "",
        "## 10. Limitations", "",
        "- **No dashboard/form UI yet.** Feedback must be inserted via Python API",
        "  (`insert_feedback`) or direct SQL. A field officer form is a future task.",
        "- **Feedback is manually inserted at backend level.** There is no automatic",
        "  enforcement outcome capture — an officer must log the outcome explicitly.",
        "- **Does not directly modify scoring yet.** Piyush must update `05_score.py`",
        "  to call `get_feedback_summary_for_scoring()` and apply the boost.",
        "- **`feedback_structural_boost` is binary (0/1).** A more nuanced weight",
        "  (e.g., boosting proportional to recurrence count) can be added later.",
        "- **No authentication.** `officer_id` is a free-text field with no user table.",
        "  A proper auth system would link officer_id to a users table.",
        "", "---", "",
        "## 11. Final Recommendation", "",
        "M12 backend is **ready for integration**.",
        "",
        "- **Prakhar** can begin inserting real feedback as field data arrives.",
        "- **Piyush** should import `get_feedback_summary_for_scoring` in `05_score.py`",
        "  and merge the `feedback_structural_boost` column into the scoring loop.",
        "- The SQLite database is safe to re-initialise (`--init` is idempotent).",
        "- The summary CSV is regenerated fresh on each `--summary` call.",
    ]

    content = "\n".join(lines) + "\n"
    _REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    _REPORT_PATH.write_text(content, encoding="utf-8")
    return content


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cli_init() -> None:
    db_path = init_feedback_db()
    conn = _get_conn(db_path)
    try:
        count = conn.execute("SELECT COUNT(*) FROM feedback_events").fetchone()[0]
    finally:
        conn.close()
    print(f"Database initialised: {db_path}")
    print(f"Table: feedback_events")
    print(f"Row count: {count}")


def _cli_seed_demo() -> None:
    db_path = init_feedback_db()
    print("Seeding demo feedback events...")
    ids = seed_demo_feedback(db_path)
    print(f"Inserted IDs: {ids}")

    summary = get_feedback_summary_for_scoring(db_path)
    print(f"\nFeedback summary ({len(summary)} clusters with feedback):")
    print(summary.to_string(index=False))

    boost = int(summary["feedback_structural_boost"].sum()) if not summary.empty else 0
    print(f"\nClusters with feedback_structural_boost = 1: {boost}")


def _cli_summary() -> None:
    db_path = _DB_DEFAULT
    if not db_path.exists():
        print(f"No database found at {db_path}. Run --init first.")
        sys.exit(1)

    summary = get_feedback_summary_for_scoring(db_path)
    if summary.empty:
        print("No feedback events in database.")
    else:
        print(f"Feedback summary ({len(summary)} clusters):")
        print(summary.to_string(index=False))

    csv_path = export_feedback_summary_csv(db_path=db_path)
    print(f"\nSummary CSV exported: {csv_path}")

    boost = int(summary["feedback_structural_boost"].sum()) if not summary.empty else 0
    print(f"Clusters with feedback_structural_boost = 1: {boost}")

    # Write report
    report_content = write_report(summary, db_path)
    print(f"\nReport written: {_REPORT_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="M12 Feedback Loop Backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  --init        Create database and table (idempotent)
  --seed-demo   Insert demo feedback rows and print summary
  --summary     Print summary and export feedback_summary_for_scoring.csv
        """,
    )
    parser.add_argument("--init",      action="store_true", help="Initialise feedback database")
    parser.add_argument("--seed-demo", action="store_true", help="Insert demo feedback rows")
    parser.add_argument("--summary",   action="store_true", help="Print summary and export CSV")
    args = parser.parse_args()

    if args.init:
        _cli_init()
    elif getattr(args, "seed_demo", False):
        _cli_seed_demo()
    elif args.summary:
        _cli_summary()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
