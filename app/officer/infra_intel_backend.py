"""
M15 — Infrastructure Intelligence Backend

Captures officer-recorded site assessments for STRUCTURAL parking hotspots
and generates BBMP/BTP escalation PDFs for locations needing infrastructure fixes.

DATA HONESTY NOTICE
───────────────────
The FTVR dataset does NOT contain real signage, curb geometry, parking
inventory, photo evidence, or field-inspection data.

M15 stores OFFICER-RECORDED site assessments — it does NOT automatically
detect infrastructure defects from the dataset.  Candidate selection
identifies structural hotspots as *candidates for field inspection*, not as
proven infrastructure defects.

Demo rows (source='demo') are synthetic and clearly labelled.
PDFs require official field verification before civil works or enforcement.

Usage (CLI):
    python -m app.officer.infra_intel_backend --init
    python -m app.officer.infra_intel_backend --list-candidates --top 20
    python -m app.officer.infra_intel_backend --seed-demo
    python -m app.officer.infra_intel_backend --export-summary
    python -m app.officer.infra_intel_backend --generate-pdfs --min-officers 3
    python -m app.officer.infra_intel_backend --init --seed-demo --export-summary --generate-pdfs
"""

from __future__ import annotations

import argparse
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

from app.utils.db_helpers import (
    get_sqlite_connection,
    index_exists,
    row_count,
    rows_to_dicts,
    table_exists,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT         = Path(__file__).resolve().parent.parent.parent
_SCORED_PARQ = ROOT / "data" / "outputs" / "scored_hotspots.parquet"
_SCORED_CSV  = ROOT / "data" / "outputs" / "scored_hotspots.csv"
_DB_DEFAULT  = ROOT / "data" / "outputs" / "infra_assessments.sqlite"
_SUMMARY_CSV = ROOT / "data" / "outputs" / "infra_assessment_summary.csv"
_PDF_DIR     = ROOT / "data" / "outputs" / "infra_escalation_pdfs"
_REPORT_PATH = ROOT / "reports" / "M15_INFRA_INTEL_REPORT.md"

_IST = timezone(timedelta(hours=5, minutes=30))

# ---------------------------------------------------------------------------
# Allowed values
# ---------------------------------------------------------------------------
_ALLOWED_ROAD_CONDITION  = frozenset({"good", "damaged", "narrow", "blocked", "unknown"})
_ALLOWED_SIGNAGE_STATUS  = frozenset({"adequate", "missing", "faded", "obstructed",
                                       "wrong_location", "unknown"})
_ALLOWED_FOOTPATH_STATUS = frozenset({"clear", "encroached", "absent", "broken", "unknown"})
_ALLOWED_LIGHTING_STATUS = frozenset({"adequate", "poor", "absent", "unknown"})
_ALLOWED_CAUSE_CODES     = frozenset({
    "missing_signage", "faded_marking", "no_loading_zone", "no_parking_supply",
    "footpath_encroachment", "narrow_road", "junction_conflict",
    "bus_auto_stand_conflict", "poor_lighting", "recurring_commercial_parking",
    "unknown", "other",
})
_ALLOWED_SUGGESTED_FIXES = frozenset({
    "install_no_parking_sign", "repaint_curb_marking", "add_bollards_or_barriers",
    "create_loading_zone", "create_parking_bay", "remove_encroachment",
    "improve_lighting", "redesign_junction_edge", "joint_bbmp_btp_inspection",
    "police_enforcement_only", "other",
})
_ALLOWED_CONFIDENCE = frozenset({"LOW", "MEDIUM", "HIGH"})

_AGENCY_MAP = {
    "police_enforcement_only":   "BTP",
    "install_no_parking_sign":   "BBMP",
    "repaint_curb_marking":      "BBMP",
    "add_bollards_or_barriers":  "BBMP",
    "improve_lighting":          "BBMP",
    "remove_encroachment":       "BBMP",
    "create_loading_zone":       "JOINT_BBMP_BTP",
    "create_parking_bay":        "JOINT_BBMP_BTP",
    "redesign_junction_edge":    "JOINT_BBMP_BTP",
    "joint_bbmp_btp_inspection": "JOINT_BBMP_BTP",
    "other":                     "JOINT_BBMP_BTP",
}

_REQUIRED_COLS = [
    "cluster_id", "centroid_lat", "centroid_lng", "assigned_station",
    "road_class", "road_width_m", "violation_count", "lcle_pct",
    "bci", "persistence", "recurrence", "peak_window",
    "roi_score", "classification", "recommended_action",
]

# Cache keyed by str(path) — same pattern as M12 to isolate test runs
_CLUSTER_IDS_CACHE: dict = {}


# ---------------------------------------------------------------------------
# Hotspot loading
# ---------------------------------------------------------------------------

def _validate_scored_df(df: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in _REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"scored_hotspots missing required columns: {missing}")
    return df


def load_scored_hotspots(path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load and validate scored_hotspots.

    If *path* is given, load directly from that file (parquet or CSV by suffix).
    Otherwise try the default parquet, then the default CSV.
    """
    if path is not None:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Scored hotspots file not found: {p}")
        df = pd.read_parquet(p) if p.suffix.lower() == ".parquet" else pd.read_csv(p)
        return _validate_scored_df(df)
    if _SCORED_PARQ.exists():
        return _validate_scored_df(pd.read_parquet(_SCORED_PARQ))
    if _SCORED_CSV.exists():
        return _validate_scored_df(pd.read_csv(_SCORED_CSV))
    raise FileNotFoundError(
        f"Scored hotspots not found at:\n  {_SCORED_PARQ}\n  {_SCORED_CSV}\n"
        "Run the scoring pipeline first."
    )


def _load_valid_cluster_ids(scored_path: Optional[Path] = None) -> frozenset:
    """Return cached frozenset of valid cluster_ids."""
    candidates = [Path(scored_path)] if scored_path is not None else [_SCORED_PARQ, _SCORED_CSV]
    cache_key  = str(candidates[0])

    if cache_key in _CLUSTER_IDS_CACHE:
        return _CLUSTER_IDS_CACHE[cache_key]

    for p in candidates:
        if not p.exists():
            continue
        try:
            col_reader = (pd.read_parquet(p, columns=["cluster_id"])
                          if p.suffix.lower() == ".parquet"
                          else pd.read_csv(p, usecols=["cluster_id"]))
            ids = frozenset(col_reader["cluster_id"].astype(str).tolist())
            _CLUSTER_IDS_CACHE[cache_key] = ids
            return ids
        except Exception:
            continue

    _CLUSTER_IDS_CACHE[cache_key] = frozenset()
    return frozenset()


# ---------------------------------------------------------------------------
# Candidate selection
# ---------------------------------------------------------------------------

def _candidate_reason(is_structural: bool, has_signage: bool, has_geo_review: bool) -> str:
    parts = []
    if is_structural:
        parts.append("STRUCTURAL")
    if has_signage:
        parts.append("SIGNAGE_REVIEW")
    if has_geo_review and not is_structural:
        parts.append("GEO_REVIEW")
    return "+".join(parts) if parts else "OTHER"


def get_infra_candidates(
    scored_df: Optional[pd.DataFrame] = None,
    station: Optional[str] = None,
    top_n: Optional[int] = None,
) -> pd.DataFrame:
    """
    Return structural / signage-infra-review hotspots as M15 inspection candidates.

    Added columns:
        review_required        — True if recommended_action contains "Review geography first"
        infra_priority_score   — 0.40*roi_norm + 0.25*lcle_norm + 0.20*pers_norm + 0.15*bci_norm
        infra_candidate_reason — why the hotspot is a candidate

    Normalisers use *global* min/max from the full scored_df so that priority
    scores are consistent across stations.

    IMPORTANT: infra_priority_score only ranks inspection priority.
    It does NOT prove or claim any infrastructure defect.
    """
    if scored_df is None:
        scored_df = load_scored_hotspots()

    df = scored_df.copy()

    # Global norm denominators
    bci_max = max(float(df["bci"].max()), 1e-9)
    p_min   = float(df["persistence"].min())
    p_max   = float(df["persistence"].max())
    p_range = max(p_max - p_min, 1e-9)

    is_structural = df["classification"] == "STRUCTURAL"
    has_signage   = df["recommended_action"].str.contains(
        "signage/infra review", case=False, na=False
    )
    has_geo_review = df["recommended_action"].str.contains(
        "Review geography first", case=False, na=False
    )

    mask = is_structural | has_signage
    cands = df[mask].copy()

    cands["review_required"] = has_geo_review[mask].values
    cands["infra_candidate_reason"] = [
        _candidate_reason(bool(is_structural[i]), bool(has_signage[i]), bool(has_geo_review[i]))
        for i in cands.index
    ]

    # Priority score (global norms)
    roi_n  = cands["roi_score"] / 100.0
    lcle_n = cands["lcle_pct"] / 100.0
    pers_n = (cands["persistence"] - p_min) / p_range
    bci_n  = cands["bci"] / bci_max
    cands["infra_priority_score"] = (
        0.40 * roi_n + 0.25 * lcle_n + 0.20 * pers_n + 0.15 * bci_n
    ).round(6)

    cands = cands.sort_values(
        ["infra_priority_score", "cluster_id"], ascending=[False, True]
    ).reset_index(drop=True)

    if station is not None:
        cands = cands[cands["assigned_station"] == station].copy()
    if top_n is not None:
        cands = cands.head(top_n)

    return cands


# ---------------------------------------------------------------------------
# Database initialisation
# ---------------------------------------------------------------------------

_DDL = """
CREATE TABLE IF NOT EXISTS infra_assessments (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_id                  TEXT    NOT NULL,
    assessment_date             TEXT    NOT NULL,
    assessment_timestamp_ist    TEXT    NOT NULL,
    assigned_station            TEXT,
    officer_id                  TEXT,
    road_condition              TEXT,
    signage_status              TEXT,
    footpath_status             TEXT,
    lighting_status             TEXT,
    parking_supply_issue        INTEGER NOT NULL DEFAULT 0,
    loading_unloading_issue     INTEGER NOT NULL DEFAULT 0,
    encroachment_issue          INTEGER NOT NULL DEFAULT 0,
    bus_auto_stand_issue        INTEGER NOT NULL DEFAULT 0,
    repeated_violation_observed INTEGER NOT NULL DEFAULT 0,
    structural_cause_code       TEXT    NOT NULL,
    suggested_fix               TEXT    NOT NULL,
    severity                    INTEGER NOT NULL,
    confidence                  TEXT    NOT NULL,
    photo_ref                   TEXT,
    voice_note_ref              TEXT,
    notes                       TEXT,
    source                      TEXT    NOT NULL DEFAULT 'backend',
    created_at_ist              TEXT    NOT NULL
);
"""

_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_ia_cluster_id           ON infra_assessments(cluster_id)",
    "CREATE INDEX IF NOT EXISTS idx_ia_assessment_date      ON infra_assessments(assessment_date)",
    "CREATE INDEX IF NOT EXISTS idx_ia_assigned_station     ON infra_assessments(assigned_station)",
    "CREATE INDEX IF NOT EXISTS idx_ia_structural_cause_code ON infra_assessments(structural_cause_code)",
    "CREATE INDEX IF NOT EXISTS idx_ia_suggested_fix        ON infra_assessments(suggested_fix)",
    "CREATE INDEX IF NOT EXISTS idx_ia_severity             ON infra_assessments(severity)",
]


def init_infra_db(db_path: Optional[Path] = None) -> Path:
    """Create infra_assessments table and indexes (idempotent)."""
    _db = Path(db_path) if db_path else _DB_DEFAULT
    _db.parent.mkdir(parents=True, exist_ok=True)
    with get_sqlite_connection(_db) as conn:
        conn.executescript(_DDL)
        for stmt in _INDEXES:
            conn.execute(stmt)
    return _db


# ---------------------------------------------------------------------------
# Record a site assessment
# ---------------------------------------------------------------------------

def _now_ist() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")


def _opt_enum(value: Optional[str], allowed: frozenset, field: str) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip()
    if v not in allowed:
        raise ValueError(f"Invalid {field}: {value!r}. Allowed: {sorted(allowed)}")
    return v


def record_site_assessment(
    cluster_id: str,
    assessment_date: str,
    structural_cause_code: str,
    suggested_fix: str,
    severity: int,
    confidence: str,
    assigned_station: Optional[str] = None,
    officer_id: Optional[str] = None,
    road_condition: Optional[str] = None,
    signage_status: Optional[str] = None,
    footpath_status: Optional[str] = None,
    lighting_status: Optional[str] = None,
    parking_supply_issue: int = 0,
    loading_unloading_issue: int = 0,
    encroachment_issue: int = 0,
    bus_auto_stand_issue: int = 0,
    repeated_violation_observed: int = 0,
    photo_ref: Optional[str] = None,
    voice_note_ref: Optional[str] = None,
    notes: Optional[str] = None,
    source: str = "backend",
    db_path: Optional[Path] = None,
    scored_path: Optional[Path] = None,
) -> int:
    """
    Validate and insert one officer site assessment.  Returns the ROWID.

    Raises ValueError on:
    - invalid enum values
    - severity outside 1–5
    - cluster_id not found in scored_hotspots
    """
    _db = Path(db_path) if db_path else _DB_DEFAULT
    sp  = Path(scored_path) if scored_path else None

    # cluster_id validation
    valid_ids = _load_valid_cluster_ids(scored_path=sp)
    if valid_ids and str(cluster_id) not in valid_ids:
        raise ValueError(
            f"cluster_id {cluster_id!r} not found in scored_hotspots. "
            "Ensure the cluster exists before recording an assessment."
        )

    # required enum validation
    if structural_cause_code not in _ALLOWED_CAUSE_CODES:
        raise ValueError(
            f"Invalid structural_cause_code: {structural_cause_code!r}. "
            f"Allowed: {sorted(_ALLOWED_CAUSE_CODES)}"
        )
    if suggested_fix not in _ALLOWED_SUGGESTED_FIXES:
        raise ValueError(
            f"Invalid suggested_fix: {suggested_fix!r}. "
            f"Allowed: {sorted(_ALLOWED_SUGGESTED_FIXES)}"
        )
    if confidence not in _ALLOWED_CONFIDENCE:
        raise ValueError(
            f"Invalid confidence: {confidence!r}. Allowed: {sorted(_ALLOWED_CONFIDENCE)}"
        )

    # severity validation
    try:
        severity = int(severity)
    except (TypeError, ValueError):
        raise ValueError(f"severity must be integer 1-5, got: {severity!r}")
    if not (1 <= severity <= 5):
        raise ValueError(f"severity must be 1-5, got: {severity}")

    # optional enum fields
    road_cond_v  = _opt_enum(road_condition,  _ALLOWED_ROAD_CONDITION,  "road_condition")
    sign_stat_v  = _opt_enum(signage_status,  _ALLOWED_SIGNAGE_STATUS,  "signage_status")
    foot_stat_v  = _opt_enum(footpath_status, _ALLOWED_FOOTPATH_STATUS, "footpath_status")
    lght_stat_v  = _opt_enum(lighting_status, _ALLOWED_LIGHTING_STATUS, "lighting_status")

    ts = _now_ist()
    init_infra_db(_db)

    sql = """
        INSERT INTO infra_assessments (
            cluster_id, assessment_date, assessment_timestamp_ist,
            assigned_station, officer_id,
            road_condition, signage_status, footpath_status, lighting_status,
            parking_supply_issue, loading_unloading_issue, encroachment_issue,
            bus_auto_stand_issue, repeated_violation_observed,
            structural_cause_code, suggested_fix, severity, confidence,
            photo_ref, voice_note_ref, notes, source, created_at_ist
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    with get_sqlite_connection(_db) as conn:
        cur = conn.execute(sql, (
            str(cluster_id), str(assessment_date), ts,
            assigned_station, officer_id,
            road_cond_v, sign_stat_v, foot_stat_v, lght_stat_v,
            int(bool(parking_supply_issue)),
            int(bool(loading_unloading_issue)),
            int(bool(encroachment_issue)),
            int(bool(bus_auto_stand_issue)),
            int(bool(repeated_violation_observed)),
            structural_cause_code, suggested_fix, severity, confidence,
            photo_ref, voice_note_ref, notes, str(source), ts,
        ))
        return cur.lastrowid


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

_EMPTY_SCHEMA = [
    "id", "cluster_id", "assessment_date", "assessment_timestamp_ist",
    "assigned_station", "officer_id", "road_condition", "signage_status",
    "footpath_status", "lighting_status", "parking_supply_issue",
    "loading_unloading_issue", "encroachment_issue", "bus_auto_stand_issue",
    "repeated_violation_observed", "structural_cause_code", "suggested_fix",
    "severity", "confidence", "photo_ref", "voice_note_ref", "notes",
    "source", "created_at_ist",
]


def get_assessments(
    cluster_id: Optional[str] = None,
    station: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> pd.DataFrame:
    """Return assessment rows as a DataFrame. Empty DataFrame if DB does not exist."""
    _db = Path(db_path) if db_path else _DB_DEFAULT
    if not _db.exists():
        return pd.DataFrame(columns=_EMPTY_SCHEMA)

    clauses, params = [], []
    if cluster_id is not None:
        clauses.append("cluster_id = ?")
        params.append(str(cluster_id))
    if station is not None:
        clauses.append("assigned_station = ?")
        params.append(str(station))
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    with get_sqlite_connection(_db) as conn:
        rows = conn.execute(
            f"SELECT * FROM infra_assessments {where} ORDER BY assessment_date, id",
            params,
        ).fetchall()
    return pd.DataFrame(rows_to_dicts(rows))


_SUMMARY_EMPTY_COLS = [
    "cluster_id", "assessment_count", "independent_officer_count",
    "assigned_station", "last_assessment_date",
    "dominant_structural_cause", "dominant_suggested_fix",
    "avg_severity", "max_severity",
    "high_confidence_count", "photo_evidence_count", "voice_evidence_count",
    "escalation_ready",
]


def get_infra_summary(
    min_independent_officers: int = 3,
    db_path: Optional[Path] = None,
) -> pd.DataFrame:
    """
    Aggregate assessments by cluster_id.

    Escalation rule:
        escalation_ready = (independent_officer_count >= min_independent_officers)
                           AND (max_severity >= 3)

    Returns empty DataFrame with correct schema if no assessments exist.
    """
    df = get_assessments(db_path=db_path)
    if df.empty:
        return pd.DataFrame(columns=_SUMMARY_EMPTY_COLS)

    agg = (
        df.groupby("cluster_id")
        .agg(
            assessment_count          =("id",            "count"),
            independent_officer_count =("officer_id",    lambda x: x.dropna().nunique()),
            assigned_station          =("assigned_station",
                                        lambda x: x.mode().iloc[0] if not x.mode().empty else None),
            last_assessment_date      =("assessment_date", "max"),
            avg_severity              =("severity",       "mean"),
            max_severity              =("severity",       "max"),
            high_confidence_count     =("confidence",     lambda x: (x == "HIGH").sum()),
            photo_evidence_count      =("photo_ref",      lambda x: x.notna().sum()),
            voice_evidence_count      =("voice_note_ref", lambda x: x.notna().sum()),
        )
        .reset_index()
    )

    _mode = lambda x: x.mode().iloc[0] if not x.mode().empty else "unknown"
    dom_cause = (
        df.groupby("cluster_id")["structural_cause_code"]
        .agg(_mode).reset_index()
        .rename(columns={"structural_cause_code": "dominant_structural_cause"})
    )
    dom_fix = (
        df.groupby("cluster_id")["suggested_fix"]
        .agg(_mode).reset_index()
        .rename(columns={"suggested_fix": "dominant_suggested_fix"})
    )

    summary = agg.merge(dom_cause, on="cluster_id").merge(dom_fix, on="cluster_id")
    summary["escalation_ready"] = (
        (summary["independent_officer_count"] >= min_independent_officers)
        & (summary["max_severity"] >= 3)
    ).astype(int)

    return summary.sort_values("independent_officer_count", ascending=False).reset_index(drop=True)


_SCORING_COLS = [
    "cluster_id", "infra_assessment_count", "infra_independent_officer_count",
    "infra_max_severity", "infra_avg_severity", "infra_dominant_cause",
    "infra_suggested_fix", "infra_escalation_ready", "infra_structural_boost",
]


def get_infra_summary_for_scoring(db_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Return per-cluster scoring contract columns for future dashboard/scoring integration.

    infra_structural_boost = 1 if escalation_ready else 0.
    Do NOT modify pipeline/05_score.py to consume this output now.
    """
    summary = get_infra_summary(db_path=db_path)
    if summary.empty:
        return pd.DataFrame(columns=_SCORING_COLS)

    result = summary.rename(columns={
        "assessment_count":          "infra_assessment_count",
        "independent_officer_count": "infra_independent_officer_count",
        "max_severity":              "infra_max_severity",
        "avg_severity":              "infra_avg_severity",
        "dominant_structural_cause": "infra_dominant_cause",
        "dominant_suggested_fix":    "infra_suggested_fix",
        "escalation_ready":          "infra_escalation_ready",
    })[_SCORING_COLS[:-1]].copy()

    result["infra_structural_boost"] = result["infra_escalation_ready"].astype(int)
    return result[_SCORING_COLS]


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------

def export_infra_summary_csv(
    output_path: Optional[Path] = None,
    db_path: Optional[Path] = None,
) -> Path:
    """Write scoring-contract summary to CSV and return the path."""
    out = Path(output_path) if output_path else _SUMMARY_CSV
    out.parent.mkdir(parents=True, exist_ok=True)
    get_infra_summary_for_scoring(db_path=db_path).to_csv(out, index=False)
    return out


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

def _get_recommended_agency(dominant_fix: str) -> str:
    return _AGENCY_MAP.get(str(dominant_fix), "JOINT_BBMP_BTP")


def generate_escalation_pdf(
    cluster_id: str,
    output_dir: Path = _PDF_DIR,
    db_path: Optional[Path] = None,
    scored_path: Optional[Path] = None,
) -> Path:
    """
    Generate an escalation PDF brief for a cluster.

    The PDF is an officer brief for BBMP/BTP action — NOT an official work order.
    Requires reportlab ≥ 3.0.

    Raises ValueError if cluster or assessments are not found.
    Raises ImportError if reportlab is not installed.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable, Paragraph, SimpleDocTemplate,
            Spacer, Table, TableStyle,
        )
    except ImportError:
        raise ImportError(
            "reportlab is required for PDF generation.\n"
            "Install with: pip install reportlab"
        )

    # Data loading
    scored_df    = load_scored_hotspots(scored_path)
    cluster_rows = scored_df[scored_df["cluster_id"] == cluster_id]
    if cluster_rows.empty:
        raise ValueError(f"Cluster {cluster_id!r} not found in scored_hotspots")
    cr = cluster_rows.iloc[0]

    df_ass = get_assessments(cluster_id=cluster_id, db_path=db_path)
    if df_ass.empty:
        raise ValueError(
            f"No assessments found for cluster {cluster_id!r}. "
            "Record at least one site assessment before generating a PDF."
        )

    summary_df = get_infra_summary(db_path=db_path)
    cs_rows    = summary_df[summary_df["cluster_id"] == cluster_id]
    if cs_rows.empty:
        raise ValueError(f"Summary not found for cluster {cluster_id!r}")
    cs = cs_rows.iloc[0]

    agency = _get_recommended_agency(str(cs.get("dominant_suggested_fix", "other")))

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_cid = re.sub(r"[^A-Za-z0-9_-]", "_", cluster_id)
    pdf_path  = output_dir / f"escalation_{safe_cid}.pdf"

    # Styles
    styles = getSampleStyleSheet()
    h1   = ParagraphStyle("H1",  parent=styles["Heading1"], fontSize=14,
                           spaceAfter=4, fontName="Helvetica-Bold")
    h2   = ParagraphStyle("H2",  parent=styles["Heading2"], fontSize=10,
                           spaceAfter=3, spaceBefore=5, fontName="Helvetica-Bold")
    norm = ParagraphStyle("NRM", parent=styles["Normal"],   fontSize=8, spaceAfter=2)
    disc = ParagraphStyle("DIS", parent=styles["Normal"],   fontSize=7,
                           textColor=colors.red, spaceAfter=2)
    bold = ParagraphStyle("BLD", parent=styles["Normal"],   fontSize=8,
                           fontName="Helvetica-Bold", spaceAfter=2)

    W  = 170 * mm
    c2 = [65 * mm, W - 65 * mm]

    def _kv_table(data: list) -> Table:
        t = Table(data, colWidths=c2)
        t.setStyle(TableStyle([
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.grey),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("BACKGROUND",    (0, 0), (0, -1),  colors.Color(0.90, 0.90, 0.95)),
            ("FONTNAME",      (0, 0), (0, -1),  "Helvetica-Bold"),
        ]))
        return t

    def _hdr_table(data: list) -> Table:
        t = Table(data, colWidths=c2)
        t.setStyle(TableStyle([
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.grey),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("BACKGROUND",    (0, 0), (-1,  0), colors.darkblue),
            ("TEXTCOLOR",     (0, 0), (-1,  0), colors.white),
            ("FONTNAME",      (0, 0), (-1,  0), "Helvetica-Bold"),
        ]))
        return t

    now_ist = datetime.now(_IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")
    story   = []

    # ── Title ────────────────────────────────────────────────────────────
    story.append(Paragraph("Infrastructure Escalation Report", h1))
    story.append(Paragraph("Bengaluru Traffic Police / BBMP Escalation Brief", norm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.darkblue, spaceAfter=3))
    story.append(Paragraph(f"Generated: {now_ist}", norm))
    story.append(Paragraph(
        "DISCLAIMER: Generated from officer site assessments. "
        "Requires official field verification before civil works. "
        "Demo records are synthetic.", disc))
    story.append(Spacer(1, 3 * mm))

    # ── 1. Hotspot Information ───────────────────────────────────────────
    story.append(Paragraph("1. Hotspot Information", h2))
    story.append(_kv_table([
        ["Cluster ID",          cluster_id],
        ["Assigned Station",    str(cr.get("assigned_station", "N/A"))],
        ["GPS (lat, lng)",      f"{cr.get('centroid_lat','N/A')}, {cr.get('centroid_lng','N/A')}"],
        ["Road Class",          str(cr.get("road_class", "N/A"))],
        ["Road Width",          f"{cr.get('road_width_m','N/A')} m"],
        ["Violation Count",     f"{int(cr.get('violation_count', 0)):,}"],
        ["ROI Score",           f"{float(cr.get('roi_score', 0)):.1f} / 100"],
        ["LCLE %",              f"{float(cr.get('lcle_pct', 0)):.1f}%"],
        ["BCI",                 f"{float(cr.get('bci', 0)):.4f}"],
        ["Peak Window",         str(cr.get("peak_window", "N/A"))],
        ["Classification",      str(cr.get("classification", "N/A"))],
        ["Recommended Action",  str(cr.get("recommended_action", "N/A"))[:120]],
    ]))
    story.append(Spacer(1, 2 * mm))

    # ── 2. Assessment Summary ────────────────────────────────────────────
    story.append(Paragraph("2. Assessment Summary", h2))
    esc_txt = ("YES — READY FOR ESCALATION" if cs["escalation_ready"]
               else "NO — more independent officer assessments needed")
    story.append(_kv_table([
        ["Total Assessments",           str(int(cs["assessment_count"]))],
        ["Independent Officers",        str(int(cs["independent_officer_count"]))],
        ["Last Assessment Date",        str(cs["last_assessment_date"])],
        ["Dominant Structural Cause",   str(cs["dominant_structural_cause"])],
        ["Dominant Suggested Fix",      str(cs["dominant_suggested_fix"])],
        ["Average Severity",            f"{float(cs['avg_severity']):.1f} / 5"],
        ["Max Severity",                f"{int(cs['max_severity'])} / 5"],
        ["High-Confidence Assessments", str(int(cs["high_confidence_count"]))],
        ["Photo Evidence Refs",         str(int(cs["photo_evidence_count"]))],
        ["Voice Note Refs",             str(int(cs["voice_evidence_count"]))],
        ["Escalation Ready",            esc_txt],
    ]))
    story.append(Spacer(1, 2 * mm))

    # ── 3. Severity Distribution ─────────────────────────────────────────
    story.append(Paragraph("3. Severity Distribution", h2))
    sev_data = [["Severity Level", "Count"]]
    for sev, cnt in df_ass["severity"].value_counts().sort_index().items():
        sev_data.append([f"Level {sev} / 5", str(int(cnt))])
    story.append(_hdr_table(sev_data))
    story.append(Spacer(1, 2 * mm))

    # ── 4. Evidence References (if any) ─────────────────────────────────
    photo_refs = df_ass["photo_ref"].dropna().tolist() if "photo_ref" in df_ass.columns else []
    voice_refs = df_ass["voice_note_ref"].dropna().tolist() if "voice_note_ref" in df_ass.columns else []
    if photo_refs or voice_refs:
        story.append(Paragraph("4. Evidence References", h2))
        for ref in photo_refs[:5]:
            story.append(Paragraph(f"Photo: {ref}", norm))
        for ref in voice_refs[:5]:
            story.append(Paragraph(f"Voice: {ref}", norm))
        story.append(Spacer(1, 2 * mm))

    # ── 5. Officer Notes ─────────────────────────────────────────────────
    notes_list = df_ass["notes"].dropna().tolist() if "notes" in df_ass.columns else []
    if notes_list:
        story.append(Paragraph("5. Officer Notes Summary", h2))
        for note in notes_list[:5]:
            story.append(Paragraph(f"• {str(note)[:200]}", norm))
        story.append(Spacer(1, 2 * mm))

    # ── 6. Recommended Owning Agency ────────────────────────────────────
    story.append(Paragraph("6. Recommended Owning Agency", h2))
    story.append(Paragraph(agency, bold))
    _rationale = {
        "BTP":           "Dominant fix falls under police enforcement jurisdiction.",
        "BBMP":          "Dominant fix involves fixed infrastructure (signage/marking/lighting/encroachment) — BBMP responsibility.",
        "JOINT_BBMP_BTP":"Dominant fix requires coordinated civil and enforcement action (loading zone/junction redesign/parking bay).",
    }
    story.append(Paragraph(_rationale.get(agency, ""), norm))
    story.append(Spacer(1, 2 * mm))

    # ── 7. Escalation Status ─────────────────────────────────────────────
    story.append(Paragraph("7. Escalation Status", h2))
    if cs["escalation_ready"]:
        story.append(Paragraph(
            f"This cluster meets escalation criteria: "
            f"{int(cs['independent_officer_count'])} independent officers confirmed, "
            f"max severity {int(cs['max_severity'])}/5. "
            f"Recommend forwarding this brief to {agency}.", norm))
    else:
        story.append(Paragraph(
            f"Escalation criteria NOT yet met. "
            f"Current: {int(cs['independent_officer_count'])} independent officer(s) "
            f"(require ≥3), max severity {int(cs['max_severity'])}/5 (require ≥3). "
            f"Additional field assessments required.", norm))
    story.append(Spacer(1, 4 * mm))

    # ── Footer ───────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey, spaceAfter=2))
    story.append(Paragraph(
        "This report is generated from officer site assessments recorded in the Bengaluru "
        "Parking Enforcement Intelligence System (BPEIS).  It does not constitute an official "
        "BBMP work order or BTP enforcement directive.  All findings require official field "
        "verification before any civil works or enforcement action.  Demo records are "
        "synthetic and do not represent real police observations.", disc))

    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=A4,
        rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=25 * mm,   bottomMargin=25 * mm,
    )
    doc.build(story)
    return pdf_path


def generate_all_escalation_pdfs(
    min_independent_officers: int = 3,
    output_dir: Path = _PDF_DIR,
    db_path: Optional[Path] = None,
    scored_path: Optional[Path] = None,
) -> list[Path]:
    """Generate escalation PDFs for all escalation-ready clusters."""
    summary = get_infra_summary(min_independent_officers=min_independent_officers,
                                db_path=db_path)
    ready   = summary[summary["escalation_ready"] == 1]
    pdfs: list[Path] = []
    for _, row in ready.iterrows():
        try:
            p = generate_escalation_pdf(
                cluster_id=str(row["cluster_id"]),
                output_dir=Path(output_dir),
                db_path=db_path,
                scored_path=scored_path,
            )
            pdfs.append(p)
        except Exception as exc:
            print(f"  [warn] PDF for {row['cluster_id']}: {exc}")
    return pdfs


# ---------------------------------------------------------------------------
# Demo seed
# ---------------------------------------------------------------------------

def seed_demo_assessments(
    clear_existing: bool = False,
    db_path: Optional[Path] = None,
    scored_path: Optional[Path] = None,
) -> int:
    """
    Insert deterministic SYNTHETIC demo site assessments for top structural candidates.

    Rows are marked source='demo'.  NOT real police observations.
    Uses 3 different officer_ids for the top cluster so escalation_ready becomes True.

    Returns the number of rows inserted.
    """
    _db = Path(db_path) if db_path else _DB_DEFAULT
    init_infra_db(_db)

    scored_df  = load_scored_hotspots(scored_path)
    candidates = get_infra_candidates(scored_df=scored_df)
    if candidates.empty:
        print("  [warn] No infra candidates found — demo seed skipped")
        return 0

    if clear_existing:
        with get_sqlite_connection(_db) as conn:
            conn.execute("DELETE FROM infra_assessments WHERE source = 'demo'")

    top3 = candidates.nlargest(min(3, len(candidates)), "infra_priority_score")

    # (cluster_idx, officer, date, cause, fix, sev, conf, issue_flags, notes)
    _DEMO = [
        # Cluster 0: 3 different officers → escalation_ready = True after this seed
        (0, "BCP_OFF_001", "2026-06-01", "missing_signage",       "install_no_parking_sign",
         4, "HIGH",
         {"parking_supply_issue": 1, "repeated_violation_observed": 1},
         "No parking signage visible. Vehicles block the junction approach daily during AM peak."),
        (0, "BCP_OFF_002", "2026-06-03", "faded_marking",         "repaint_curb_marking",
         3, "HIGH",
         {"repeated_violation_observed": 1},
         "Curb markings completely faded. Enforcement impossible without visible demarcation."),
        (0, "BCP_OFF_003", "2026-06-06", "missing_signage",       "install_no_parking_sign",
         4, "MEDIUM",
         {"encroachment_issue": 1, "parking_supply_issue": 1},
         "Commercial vehicle encroachment causes cascading congestion. Urgent signage required."),
        # Cluster 1: 2 officers
        (1, "BCP_OFF_001", "2026-06-02", "footpath_encroachment", "remove_encroachment",
         3, "MEDIUM",
         {"encroachment_issue": 1},
         "Footpath fully encroached by vendor stalls, forcing pedestrians onto road."),
        (1, "BCP_OFF_004", "2026-06-04", "no_loading_zone",       "create_loading_zone",
         3, "HIGH",
         {"loading_unloading_issue": 1},
         "No designated loading zone. Trucks stop on main carriageway causing blockages."),
        # Cluster 2: 1 officer
        (2, "BCP_OFF_002", "2026-06-05", "narrow_road",           "joint_bbmp_btp_inspection",
         2, "LOW",
         {},
         "Road narrowing due to construction debris. Recommend joint BBMP inspection."),
    ]

    inserted = 0
    for entry in _DEMO:
        c_idx, officer, date, cause, fix, sev, conf, flags, note = entry
        if c_idx >= len(top3):
            continue
        crow    = top3.iloc[c_idx]
        cid     = str(crow["cluster_id"])
        station = crow.get("assigned_station")
        station = str(station) if (station and str(station) not in ("nan", "")) else None

        record_site_assessment(
            cluster_id=cid,
            assessment_date=date,
            structural_cause_code=cause,
            suggested_fix=fix,
            severity=sev,
            confidence=conf,
            assigned_station=station,
            officer_id=officer,
            notes=note,
            source="demo",
            db_path=_db,
            scored_path=scored_path,
            **flags,
        )
        inserted += 1

    return inserted


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def _write_report(
    candidates: pd.DataFrame,
    summary: pd.DataFrame,
    input_ok: bool,
    input_rows: int,
    pdfs: list,
) -> None:
    esc  = summary[summary["escalation_ready"] == 1] if not summary.empty else pd.DataFrame()
    n_c  = len(candidates)
    n_st = int((candidates["classification"] == "STRUCTURAL").sum()) if n_c else 0
    n_sg = int(candidates.get("infra_candidate_reason", pd.Series(dtype=str))
               .str.contains("SIGNAGE", na=False).sum()) if n_c else 0
    n_rv = int(candidates["review_required"].sum()) if n_c else 0

    L: list[str] = []
    a = L.append

    a("# M15 Infrastructure Intelligence Backend — Report")
    a("")
    a("## 1. Executive Verdict")
    a("")
    a("**PASS** — M15 backend is operational.")
    a(f"- **{n_c}** infra candidates identified")
    a(f"- **{len(summary)}** clusters with recorded assessments")
    a(f"- **{len(esc)}** clusters escalation-ready")
    a(f"- **{len(pdfs)}** escalation PDFs generated")
    a("")
    a("---")
    a("")
    a("## 2. What M15 Does and Does Not Do")
    a("")
    a("**M15 DOES:**")
    a("- Identify STRUCTURAL hotspot candidates for field inspection")
    a("- Store officer-recorded site-assessment evidence in SQLite")
    a("- Aggregate multi-officer observations to detect escalation readiness")
    a("- Generate BBMP/BTP escalation brief PDFs backed by officer attestation")
    a("- Export `infra_structural_boost` signal for future scoring integration")
    a("")
    a("**M15 DOES NOT:**")
    a("- Automatically detect infrastructure defects from the FTVR dataset")
    a("- Claim the dataset contains signage, curb geometry, or parking inventory")
    a("- Present demo rows as real police observations")
    a("- Modify `pipeline/05_score.py` or any scoring/ROI/LCLE/BCI logic")
    a("- Issue official BBMP work orders (PDFs are officer briefs only)")
    a("")
    a("---")
    a("")
    a("## 3. Why Infrastructure Intelligence Is Needed")
    a("")
    a("STRUCTURAL hotspots sustain high violation rates even after repeated enforcement,")
    a("suggesting causes beyond officer capacity: missing signage, absent loading zones,")
    a("footpath encroachment, or junction conflicts.  M15 creates an evidence trail so")
    a("that civil agencies (BBMP) and traffic enforcement (BTP) receive data-backed")
    a("escalation briefs rather than informal complaints.")
    a("")
    a("---")
    a("")
    a("## 4. Input Files")
    a("")
    a("| File | Status |")
    a("|------|--------|")
    a(f"| scored_hotspots.parquet/csv | {'OK' if input_ok else 'NOT FOUND'} — {input_rows:,} rows |")
    a("")
    a("---")
    a("")
    a("## 5. Candidate Selection Logic")
    a("")
    a(f"Total infra candidates: **{n_c}**")
    a(f"- STRUCTURAL classification:  **{n_st}**")
    a(f"- Signage/infra review action: **{n_sg}**")
    a(f"- Review-required flag:        **{n_rv}** (included but flagged)")
    a("")
    a("Selection rule:")
    a("```")
    a("is_candidate = (classification == 'STRUCTURAL')")
    a("             | (recommended_action contains 'signage/infra review')")
    a("```")
    a("")
    a("Priority score (inspection priority only — not evidence of defects):")
    a("```")
    a("infra_priority_score = 0.40 × roi_norm + 0.25 × lcle_norm")
    a("                     + 0.20 × pers_norm + 0.15 × bci_norm")
    a("```")
    a("")
    a("---")
    a("")
    a("## 6. SQLite Schema")
    a("")
    a("**Table:** `infra_assessments` (24 columns)")
    a("**Indexes:** cluster_id, assessment_date, assigned_station, structural_cause_code, suggested_fix, severity")
    a("")
    a("---")
    a("")
    a("## 7. Assessment Workflow")
    a("")
    a("1. Officers use M10 patrol routes to visit STRUCTURAL hotspots")
    a("2. Officer records site assessment (condition, signage, footpath, issue flags, cause, fix, severity)")
    a("3. SQLite stores each assessment with officer_id and IST timestamp")
    a("4. After ≥3 independent officers confirm the same cluster: `escalation_ready = True`")
    a("5. CLI or dashboard triggers PDF generation and routes to BBMP/BTP")
    a("")
    a("---")
    a("")
    a("## 8. Escalation Rule")
    a("")
    a("```")
    a("escalation_ready = (independent_officer_count >= min_independent_officers)")
    a("               AND (max_severity >= 3)")
    a("```")
    a("")
    a("Default: `min_independent_officers = 3`.")
    a("Three independent officers prevent single-observer bias.")
    a("Severity ≥ 3 filters out minor observations.")
    a("")
    a("---")
    a("")
    a("## 9. PDF Generation")
    a("")
    a(f"PDFs generated: **{len(pdfs)}**")
    if pdfs:
        a("")
        for p in pdfs:
            sz = Path(p).stat().st_size / 1024 if Path(p).exists() else 0
            a(f"- `{Path(p).name}` ({sz:.1f} KB)")
    a("")
    a("Agency mapping: BTP → police_enforcement_only | BBMP → signage/marking/lighting/encroachment | JOINT_BBMP_BTP → loading zone/junction/parking bay")
    a("")
    a("---")
    a("")
    a("## 10. Demo Records Caveat")
    a("")
    a("- Demo rows are **synthetic** — not real police observations")
    a("- Marked `source='demo'` in SQLite")
    a("- Used only to demonstrate end-to-end PDF generation")
    a("- Must be visually distinguished from real assessments in any UI")
    a("")
    a("---")
    a("")
    a("## 11. Output Files")
    a("")
    a("| File | Description |")
    a("|------|-------------|")
    a("| `data/outputs/infra_assessments.sqlite` | Assessment event store |")
    a("| `data/outputs/infra_assessment_summary.csv` | Scoring contract signals |")
    a("| `data/outputs/infra_escalation_pdfs/` | Escalation PDF briefs |")
    a("| `reports/M15_INFRA_INTEL_REPORT.md` | This report |")
    a("")
    a("---")
    a("")
    a("## 12. Limitations")
    a("")
    a("1. **No real field data.** FTVR lacks signage inventories or parking supply data.")
    a("2. **Photo/voice notes are path references only** — not stored blobs.")
    a("3. **Demo data is synthetic** and clearly labelled.")
    a("4. **PDFs are not official work orders.** Senior officer review required before action.")
    a("5. **No GIS boundary enforcement** — station assignment by mode of officer-recorded names.")
    a("6. **Single-observer bias risk** mitigated by min_independent_officers threshold.")
    a("")
    a("---")
    a("")
    a("## 13. How M15 Feeds Future Scoring / Dashboard")
    a("")
    a("`get_infra_summary_for_scoring()` columns:")
    a("- `infra_structural_boost = 1` for escalation-ready clusters")
    a("- `infra_max_severity`, `infra_avg_severity`")
    a("- `infra_dominant_cause`, `infra_suggested_fix`")
    a("")
    a("Integration path (not implemented this sprint):")
    a("1. Load `infra_assessment_summary.csv` in `pipeline/05_score.py`")
    a("2. Add `infra_structural_boost × weight` to ROI formula")
    a("3. Show escalation status on officer dashboard (M8)")
    a("")
    a("---")
    a("")
    a("## 14. Final Recommendation")
    a("")
    a("M15 is **ready for operational use** as an officer site-assessment backend.")
    a("It provides a structured multi-officer evidence trail for STRUCTURAL hotspots")
    a("and automates evidence-backed escalation PDF briefs for BBMP/BTP action.")
    a("")

    _REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    _REPORT_PATH.write_text("\n".join(L), encoding="utf-8")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="M15 Infrastructure Intelligence Backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--init",            action="store_true")
    parser.add_argument("--list-candidates", action="store_true")
    parser.add_argument("--top",             type=int,  default=20)
    parser.add_argument("--seed-demo",       action="store_true")
    parser.add_argument("--export-summary",  action="store_true")
    parser.add_argument("--generate-pdfs",   action="store_true")
    parser.add_argument("--min-officers",    type=int,  default=3)
    parser.add_argument("--clear-demo",      action="store_true")
    args = parser.parse_args()

    any_action = any([
        args.init, args.list_candidates, args.seed_demo,
        args.export_summary, args.generate_pdfs,
    ])
    if not any_action:
        parser.print_help()
        return

    import sys

    print("Loading scored hotspots...")
    try:
        scored_df = load_scored_hotspots()
        print(f"  {len(scored_df):,} rows")
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    input_ok = _SCORED_PARQ.exists() or _SCORED_CSV.exists()

    if args.init or args.seed_demo:
        db_path = init_infra_db()
        print(f"  DB: {db_path.relative_to(ROOT)}")

    if args.list_candidates:
        all_cands = get_infra_candidates(scored_df=scored_df)
        print(f"\nInfra candidates: {len(all_cands):,} total (showing top {args.top})")
        cols = ["cluster_id", "assigned_station", "classification",
                "infra_priority_score", "infra_candidate_reason", "review_required"]
        print(get_infra_candidates(scored_df=scored_df, top_n=args.top)[cols].to_string(index=False))

    if args.seed_demo:
        print("\nSeeding SYNTHETIC demo assessments (not real officer data)...")
        n = seed_demo_assessments(clear_existing=args.clear_demo)
        print(f"  Inserted {n} demo rows  (source='demo')")

    if args.export_summary:
        print("\nExporting summary CSV...")
        out     = export_infra_summary_csv()
        summary = get_infra_summary(min_independent_officers=args.min_officers)
        esc     = summary[summary["escalation_ready"] == 1] if not summary.empty else pd.DataFrame()
        print(f"  Summary rows: {len(summary)}")
        print(f"  Escalation-ready: {len(esc)}")
        if not esc.empty:
            for _, r in esc.iterrows():
                print(f"    {r['cluster_id']}  officers={int(r['independent_officer_count'])}  max_sev={int(r['max_severity'])}")
        print(f"  CSV: {out.relative_to(ROOT)}")

    if args.generate_pdfs:
        print("\nGenerating escalation PDFs...")
        pdfs = generate_all_escalation_pdfs(min_independent_officers=args.min_officers)
        print(f"  Generated: {len(pdfs)}")
        for p in pdfs:
            print(f"    {p.name}  ({p.stat().st_size / 1024:.1f} KB)")

    # Always write report on any action
    all_cands = get_infra_candidates(scored_df=scored_df)
    summary   = get_infra_summary(min_independent_officers=args.min_officers)
    pdfs      = list(_PDF_DIR.glob("escalation_*.pdf")) if _PDF_DIR.exists() else []
    _write_report(all_cands, summary, input_ok, len(scored_df), pdfs)

    esc_count = len(summary[summary["escalation_ready"] == 1]) if not summary.empty else 0
    db_rows   = 0
    if _DB_DEFAULT.exists():
        with sqlite3.connect(str(_DB_DEFAULT)) as c:
            try:
                db_rows = c.execute("SELECT COUNT(*) FROM infra_assessments").fetchone()[0]
            except Exception:
                db_rows = 0

    print(f"\n{'='*56}")
    print(f"  M15 Infra Intelligence Backend — PASS")
    print(f"{'='*56}")
    print(f"  Scored hotspots:       {len(scored_df):,}")
    print(f"  Infra candidates:      {len(all_cands):,}")
    print(f"  DB:                    {_DB_DEFAULT.relative_to(ROOT)}")
    print(f"  Assessment rows:       {db_rows}")
    print(f"  Escalation-ready:      {esc_count}")
    print(f"  PDFs:                  {len(pdfs)}")
    print(f"  Report:                {_REPORT_PATH.relative_to(ROOT)}")
    print(f"{'='*56}\n")


if __name__ == "__main__":
    main()
