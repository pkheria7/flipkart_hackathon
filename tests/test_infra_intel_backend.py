"""
Unit tests for M15 Infrastructure Intelligence Backend.

Run with:
    pytest tests/test_infra_intel_backend.py -v

All tests use tmp_path isolation — never touch the real DB, CSV, or PDFs.
Demo rows are SYNTHETIC and clearly labelled source='demo'.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd
import pytest

from app.officer.infra_intel_backend import (
    _ALLOWED_CAUSE_CODES,
    _ALLOWED_CONFIDENCE,
    _ALLOWED_SUGGESTED_FIXES,
    _CLUSTER_IDS_CACHE,
    export_infra_summary_csv,
    generate_all_escalation_pdfs,
    generate_escalation_pdf,
    get_assessments,
    get_infra_candidates,
    get_infra_summary,
    get_infra_summary_for_scoring,
    init_infra_db,
    load_scored_hotspots,
    record_site_assessment,
    seed_demo_assessments,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_scored_csv(tmp_path: Path, rows: list[dict] | None = None) -> Path:
    """Write a minimal scored_hotspots CSV with all required columns."""
    p = tmp_path / "scored_hotspots.csv"
    defaults = {
        "cluster_id": "C_TEST_0",
        "centroid_lat": 12.97,
        "centroid_lng": 77.58,
        "assigned_station": "UPPARPET",
        "road_class": "tertiary",
        "road_width_m": 6.0,
        "violation_count": 500,
        "lcle_pct": 60.0,
        "bci": 0.5,
        "persistence": 80.0,
        "recurrence": 0.7,
        "peak_window": "09:00-11:00",
        "roi_score": 75.0,
        "classification": "STRUCTURAL",
        "recommended_action": "Targeted patrol during peak window",
    }
    if rows is None:
        rows = [defaults]

    # Pad any missing keys with defaults
    padded = []
    for row in rows:
        r = dict(defaults)
        r.update(row)
        padded.append(r)

    df = pd.DataFrame(padded)
    df.to_csv(p, index=False)
    return p


def _minimal_scored_csv(tmp_path: Path) -> Path:
    """Four rows that cover all candidate selection cases."""
    return _make_scored_csv(tmp_path, rows=[
        # C_STRUCT_1: STRUCTURAL, no geo review → candidate
        {
            "cluster_id": "C_STRUCT_1",
            "classification": "STRUCTURAL",
            "recommended_action": "Targeted patrol during peak window",
            "roi_score": 80.0, "lcle_pct": 70.0, "bci": 0.6,
            "persistence": 90.0,
        },
        # C_STRUCT_2: STRUCTURAL + Review geography first → candidate + review_required
        {
            "cluster_id": "C_STRUCT_2",
            "classification": "STRUCTURAL",
            "recommended_action": "Review geography first; apply patrol",
            "roi_score": 60.0, "lcle_pct": 55.0, "bci": 0.4,
            "persistence": 70.0,
        },
        # C_SIGNAGE_1: RESPONSIVE + signage/infra review → candidate
        {
            "cluster_id": "C_SIGNAGE_1",
            "classification": "RESPONSIVE",
            "recommended_action": "Consider signage/infra review",
            "roi_score": 50.0, "lcle_pct": 40.0, "bci": 0.3,
            "persistence": 50.0,
        },
        # C_RESP_1: RESPONSIVE, no review → NOT a candidate
        {
            "cluster_id": "C_RESP_1",
            "classification": "RESPONSIVE",
            "recommended_action": "Targeted patrol during peak window",
            "roi_score": 40.0, "lcle_pct": 30.0, "bci": 0.2,
            "persistence": 30.0,
        },
    ])


def _insert_assessment(db, cid, officer, severity=3, cause="missing_signage",
                        fix="install_no_parking_sign", conf="MEDIUM",
                        scored_path=None, date="2026-06-01"):
    return record_site_assessment(
        cluster_id=cid,
        assessment_date=date,
        structural_cause_code=cause,
        suggested_fix=fix,
        severity=severity,
        confidence=conf,
        officer_id=officer,
        source="backend",
        db_path=db,
        scored_path=scored_path,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def scored_csv(tmp_path: Path) -> Path:
    return _minimal_scored_csv(tmp_path)


@pytest.fixture()
def tmp_db(tmp_path: Path, scored_csv: Path) -> Path:
    db = tmp_path / "infra.sqlite"
    init_infra_db(db)
    return db


# ---------------------------------------------------------------------------
# A. init_infra_db
# ---------------------------------------------------------------------------

class TestInitInfraDb:
    def test_creates_db_and_table(self, tmp_path: Path) -> None:
        db = tmp_path / "test.sqlite"
        init_infra_db(db)
        assert db.exists()
        with sqlite3.connect(str(db)) as c:
            tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        assert "infra_assessments" in tables

    def test_creates_all_indexes(self, tmp_path: Path) -> None:
        db = tmp_path / "test.sqlite"
        init_infra_db(db)
        with sqlite3.connect(str(db)) as c:
            indexes = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
        assert "idx_ia_cluster_id"            in indexes
        assert "idx_ia_assessment_date"       in indexes
        assert "idx_ia_assigned_station"      in indexes
        assert "idx_ia_structural_cause_code" in indexes
        assert "idx_ia_suggested_fix"         in indexes
        assert "idx_ia_severity"              in indexes

    def test_idempotent(self, tmp_path: Path) -> None:
        db = tmp_path / "test.sqlite"
        init_infra_db(db)
        init_infra_db(db)  # must not raise

    def test_returns_path(self, tmp_path: Path) -> None:
        db = tmp_path / "test.sqlite"
        result = init_infra_db(db)
        assert result == db


# ---------------------------------------------------------------------------
# B. load_scored_hotspots
# ---------------------------------------------------------------------------

class TestLoadScoredHotspots:
    def test_loads_csv(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        assert len(df) == 4

    def test_missing_file_raises(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError):
            load_scored_hotspots(tmp_path / "nonexistent.csv")

    def test_missing_required_column_raises(self, tmp_path: Path) -> None:
        p = tmp_path / "bad.csv"
        pd.DataFrame({"cluster_id": ["C1"]}).to_csv(p, index=False)
        with pytest.raises(ValueError, match="missing required columns"):
            load_scored_hotspots(p)


# ---------------------------------------------------------------------------
# C. get_infra_candidates
# ---------------------------------------------------------------------------

class TestGetInfraCandidates:
    def test_correct_candidate_count(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        # STRUCTURAL + signage = 3; RESPONSIVE without signage = excluded
        assert len(cands) == 3

    def test_responsive_only_excluded(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        assert "C_RESP_1" not in cands["cluster_id"].values

    def test_review_required_flag(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        c2 = cands[cands["cluster_id"] == "C_STRUCT_2"]
        assert c2.iloc[0]["review_required"] is True or c2.iloc[0]["review_required"] == True

    def test_review_not_required_for_clean_structural(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        c1 = cands[cands["cluster_id"] == "C_STRUCT_1"]
        assert c1.iloc[0]["review_required"] is False or c1.iloc[0]["review_required"] == False

    def test_priority_score_in_range(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        assert (cands["infra_priority_score"] >= 0.0).all()
        assert (cands["infra_priority_score"] <= 1.0).all()

    def test_sorted_by_priority_descending(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        scores = cands["infra_priority_score"].tolist()
        assert scores == sorted(scores, reverse=True)

    def test_top_n_limits_results(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df, top_n=2)
        assert len(cands) == 2

    def test_station_filter(self, tmp_path: Path) -> None:
        p = _make_scored_csv(tmp_path, rows=[
            {"cluster_id": "C_A1", "classification": "STRUCTURAL",
             "assigned_station": "STA_A", "recommended_action": "Patrol",
             "roi_score": 70.0, "lcle_pct": 50.0, "bci": 0.4, "persistence": 60.0},
            {"cluster_id": "C_B1", "classification": "STRUCTURAL",
             "assigned_station": "STA_B", "recommended_action": "Patrol",
             "roi_score": 65.0, "lcle_pct": 45.0, "bci": 0.3, "persistence": 55.0},
        ])
        df = load_scored_hotspots(p)
        cands = get_infra_candidates(scored_df=df, station="STA_A")
        assert len(cands) == 1
        assert cands.iloc[0]["cluster_id"] == "C_A1"

    def test_candidate_reason_contains_structural(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        c1 = cands[cands["cluster_id"] == "C_STRUCT_1"]
        assert "STRUCTURAL" in c1.iloc[0]["infra_candidate_reason"]

    def test_candidate_reason_contains_signage(self, scored_csv: Path) -> None:
        df = load_scored_hotspots(scored_csv)
        cands = get_infra_candidates(scored_df=df)
        cs = cands[cands["cluster_id"] == "C_SIGNAGE_1"]
        assert "SIGNAGE" in cs.iloc[0]["infra_candidate_reason"]


# ---------------------------------------------------------------------------
# D. record_site_assessment
# ---------------------------------------------------------------------------

class TestRecordSiteAssessment:
    def test_valid_insert_returns_int(self, tmp_db: Path, scored_csv: Path) -> None:
        rowid = _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001", scored_path=scored_csv)
        assert isinstance(rowid, int)
        assert rowid >= 1

    def test_invalid_cause_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="structural_cause_code"):
            _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001",
                               cause="NOT_A_CAUSE", scored_path=scored_csv)

    def test_invalid_fix_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="suggested_fix"):
            _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001",
                               fix="MAGIC_FIX", scored_path=scored_csv)

    def test_invalid_severity_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="severity"):
            _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001",
                               severity=10, scored_path=scored_csv)

    def test_severity_zero_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="severity"):
            _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001",
                               severity=0, scored_path=scored_csv)

    def test_invalid_confidence_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="confidence"):
            _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001",
                               conf="VERY_SURE", scored_path=scored_csv)

    def test_unknown_cluster_id_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="not found in scored_hotspots"):
            _insert_assessment(tmp_db, "C_DOES_NOT_EXIST", "OFF_001",
                               scored_path=scored_csv)

    def test_invalid_road_condition_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="road_condition"):
            record_site_assessment(
                cluster_id="C_STRUCT_1",
                assessment_date="2026-06-01",
                structural_cause_code="missing_signage",
                suggested_fix="install_no_parking_sign",
                severity=3,
                confidence="MEDIUM",
                road_condition="excellent",  # not in allowed set
                db_path=tmp_db,
                scored_path=scored_csv,
            )

    def test_all_severity_levels_accepted(self, tmp_db: Path, scored_csv: Path) -> None:
        for sev in [1, 2, 3, 4, 5]:
            _insert_assessment(tmp_db, "C_STRUCT_1", f"OFF_{sev}", severity=sev,
                               scored_path=scored_csv)
        df = get_assessments(cluster_id="C_STRUCT_1", db_path=tmp_db)
        assert set(df["severity"].tolist()) == {1, 2, 3, 4, 5}


# ---------------------------------------------------------------------------
# E. get_assessments
# ---------------------------------------------------------------------------

class TestGetAssessments:
    def test_empty_db_returns_empty_df(self, tmp_path: Path) -> None:
        db = tmp_path / "new.sqlite"
        # DB does not exist yet
        df = get_assessments(db_path=db)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0

    def test_filter_by_cluster_id(self, tmp_db: Path, scored_csv: Path) -> None:
        _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001", scored_path=scored_csv)
        _insert_assessment(tmp_db, "C_STRUCT_2", "OFF_002", scored_path=scored_csv)
        df = get_assessments(cluster_id="C_STRUCT_1", db_path=tmp_db)
        assert len(df) == 1
        assert df.iloc[0]["cluster_id"] == "C_STRUCT_1"

    def test_filter_by_station(self, tmp_db: Path, scored_csv: Path) -> None:
        record_site_assessment(
            cluster_id="C_STRUCT_1",
            assessment_date="2026-06-01",
            structural_cause_code="missing_signage",
            suggested_fix="install_no_parking_sign",
            severity=3, confidence="MEDIUM",
            assigned_station="UPPARPET",
            db_path=tmp_db, scored_path=scored_csv,
        )
        record_site_assessment(
            cluster_id="C_STRUCT_2",
            assessment_date="2026-06-01",
            structural_cause_code="faded_marking",
            suggested_fix="repaint_curb_marking",
            severity=2, confidence="LOW",
            assigned_station="SHIVAJINAGAR",
            db_path=tmp_db, scored_path=scored_csv,
        )
        df = get_assessments(station="UPPARPET", db_path=tmp_db)
        assert len(df) == 1
        assert df.iloc[0]["assigned_station"] == "UPPARPET"


# ---------------------------------------------------------------------------
# F. get_infra_summary
# ---------------------------------------------------------------------------

class TestGetInfraSummary:
    def test_empty_db_returns_empty_df(self, tmp_path: Path) -> None:
        db = tmp_path / "new.sqlite"
        df = get_infra_summary(db_path=db)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0

    def test_escalation_ready_true(self, tmp_db: Path, scored_csv: Path) -> None:
        # 3 different officers, max severity 4 → should be escalation_ready
        for i, officer in enumerate(["OFF_A", "OFF_B", "OFF_C"]):
            _insert_assessment(tmp_db, "C_STRUCT_1", officer, severity=4,
                               scored_path=scored_csv, date=f"2026-06-0{i+1}")
        summary = get_infra_summary(min_independent_officers=3, db_path=tmp_db)
        row = summary[summary["cluster_id"] == "C_STRUCT_1"].iloc[0]
        assert row["escalation_ready"] == 1

    def test_escalation_not_ready_too_few_officers(self, tmp_db: Path, scored_csv: Path) -> None:
        # Only 2 independent officers — should NOT be escalation_ready
        for officer in ["OFF_A", "OFF_B"]:
            _insert_assessment(tmp_db, "C_STRUCT_1", officer, severity=4,
                               scored_path=scored_csv)
        summary = get_infra_summary(min_independent_officers=3, db_path=tmp_db)
        row = summary[summary["cluster_id"] == "C_STRUCT_1"].iloc[0]
        assert row["escalation_ready"] == 0

    def test_escalation_not_ready_low_severity(self, tmp_db: Path, scored_csv: Path) -> None:
        # 3 officers but severity only 2 → NOT escalation_ready
        for officer in ["OFF_A", "OFF_B", "OFF_C"]:
            _insert_assessment(tmp_db, "C_STRUCT_1", officer, severity=2,
                               scored_path=scored_csv)
        summary = get_infra_summary(min_independent_officers=3, db_path=tmp_db)
        row = summary[summary["cluster_id"] == "C_STRUCT_1"].iloc[0]
        assert row["escalation_ready"] == 0

    def test_summary_has_required_columns(self, tmp_db: Path, scored_csv: Path) -> None:
        _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001", scored_path=scored_csv)
        summary = get_infra_summary(db_path=tmp_db)
        required = {"cluster_id", "assessment_count", "independent_officer_count",
                    "last_assessment_date", "dominant_structural_cause",
                    "dominant_suggested_fix", "avg_severity", "max_severity",
                    "high_confidence_count", "escalation_ready"}
        assert required.issubset(set(summary.columns))

    def test_same_officer_not_double_counted(self, tmp_db: Path, scored_csv: Path) -> None:
        # Same officer ID records 3 times → independent_officer_count should be 1
        for _ in range(3):
            _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_SAME", severity=4,
                               scored_path=scored_csv)
        summary = get_infra_summary(min_independent_officers=3, db_path=tmp_db)
        row = summary[summary["cluster_id"] == "C_STRUCT_1"].iloc[0]
        assert row["independent_officer_count"] == 1
        assert row["escalation_ready"] == 0


# ---------------------------------------------------------------------------
# G. get_infra_summary_for_scoring
# ---------------------------------------------------------------------------

class TestGetInfraSummaryForScoring:
    def test_empty_has_correct_columns(self, tmp_path: Path) -> None:
        db = tmp_path / "new.sqlite"
        df = get_infra_summary_for_scoring(db_path=db)
        expected = {"cluster_id", "infra_assessment_count", "infra_independent_officer_count",
                    "infra_max_severity", "infra_avg_severity", "infra_dominant_cause",
                    "infra_suggested_fix", "infra_escalation_ready", "infra_structural_boost"}
        assert expected.issubset(set(df.columns))

    def test_structural_boost_matches_escalation_ready(self, tmp_db: Path, scored_csv: Path) -> None:
        for officer in ["OFF_A", "OFF_B", "OFF_C"]:
            _insert_assessment(tmp_db, "C_STRUCT_1", officer, severity=4,
                               scored_path=scored_csv)
        df = get_infra_summary_for_scoring(db_path=tmp_db)
        row = df[df["cluster_id"] == "C_STRUCT_1"].iloc[0]
        assert row["infra_escalation_ready"] == 1
        assert row["infra_structural_boost"] == 1


# ---------------------------------------------------------------------------
# H. export_infra_summary_csv
# ---------------------------------------------------------------------------

class TestExportInfraSummaryCsv:
    def test_creates_csv(self, tmp_db: Path, scored_csv: Path, tmp_path: Path) -> None:
        _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001", scored_path=scored_csv)
        out = tmp_path / "summary.csv"
        result = export_infra_summary_csv(output_path=out, db_path=tmp_db)
        assert result == out
        assert out.exists()

    def test_csv_has_scoring_columns(self, tmp_db: Path, scored_csv: Path, tmp_path: Path) -> None:
        _insert_assessment(tmp_db, "C_STRUCT_1", "OFF_001", scored_path=scored_csv)
        out = tmp_path / "summary.csv"
        export_infra_summary_csv(output_path=out, db_path=tmp_db)
        df = pd.read_csv(out)
        assert "infra_structural_boost" in df.columns
        assert "infra_escalation_ready" in df.columns


# ---------------------------------------------------------------------------
# I. seed_demo_assessments
# ---------------------------------------------------------------------------

class TestSeedDemoAssessments:
    def test_inserts_rows(self, tmp_db: Path, scored_csv: Path) -> None:
        n = seed_demo_assessments(db_path=tmp_db, scored_path=scored_csv)
        assert n > 0

    def test_rows_marked_as_demo(self, tmp_db: Path, scored_csv: Path) -> None:
        seed_demo_assessments(db_path=tmp_db, scored_path=scored_csv)
        df = get_assessments(db_path=tmp_db)
        assert (df["source"] == "demo").all()

    def test_clear_existing_replaces_demo(self, tmp_db: Path, scored_csv: Path) -> None:
        seed_demo_assessments(db_path=tmp_db, scored_path=scored_csv)
        n1 = len(get_assessments(db_path=tmp_db))
        seed_demo_assessments(clear_existing=True, db_path=tmp_db, scored_path=scored_csv)
        n2 = len(get_assessments(db_path=tmp_db))
        assert n2 == n1  # same count — old cleared and re-inserted


# ---------------------------------------------------------------------------
# J. generate_escalation_pdf
# ---------------------------------------------------------------------------

class TestGenerateEscalationPdf:
    def _make_escalation_ready(self, tmp_db, scored_csv, cluster_id="C_STRUCT_1"):
        for i, officer in enumerate(["OFF_A", "OFF_B", "OFF_C"]):
            record_site_assessment(
                cluster_id=cluster_id,
                assessment_date=f"2026-06-0{i+1}",
                structural_cause_code="missing_signage",
                suggested_fix="install_no_parking_sign",
                severity=4, confidence="HIGH",
                officer_id=officer,
                source="test",
                db_path=tmp_db,
                scored_path=scored_csv,
            )

    def test_pdf_created(self, tmp_db: Path, scored_csv: Path, tmp_path: Path) -> None:
        self._make_escalation_ready(tmp_db, scored_csv)
        pdf = generate_escalation_pdf(
            cluster_id="C_STRUCT_1",
            output_dir=tmp_path / "pdfs",
            db_path=tmp_db,
            scored_path=scored_csv,
        )
        assert pdf.exists()
        assert pdf.suffix == ".pdf"
        assert pdf.stat().st_size > 0

    def test_pdf_name_contains_cluster_id(self, tmp_db: Path, scored_csv: Path,
                                           tmp_path: Path) -> None:
        self._make_escalation_ready(tmp_db, scored_csv)
        pdf = generate_escalation_pdf(
            cluster_id="C_STRUCT_1",
            output_dir=tmp_path / "pdfs",
            db_path=tmp_db,
            scored_path=scored_csv,
        )
        assert "C_STRUCT_1" in pdf.name

    def test_no_assessments_raises(self, tmp_db: Path, scored_csv: Path, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="No assessments found"):
            generate_escalation_pdf(
                cluster_id="C_STRUCT_1",
                output_dir=tmp_path / "pdfs",
                db_path=tmp_db,
                scored_path=scored_csv,
            )

    def test_unknown_cluster_raises(self, tmp_db: Path, scored_csv: Path, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="not found in scored_hotspots"):
            generate_escalation_pdf(
                cluster_id="C_DOES_NOT_EXIST",
                output_dir=tmp_path / "pdfs",
                db_path=tmp_db,
                scored_path=scored_csv,
            )


# ---------------------------------------------------------------------------
# K. generate_all_escalation_pdfs
# ---------------------------------------------------------------------------

class TestGenerateAllEscalationPdfs:
    def test_generates_pdf_for_escalation_ready_cluster(self, tmp_db: Path,
                                                          scored_csv: Path,
                                                          tmp_path: Path) -> None:
        # Make C_STRUCT_1 escalation-ready
        for i, officer in enumerate(["OFF_A", "OFF_B", "OFF_C"]):
            record_site_assessment(
                cluster_id="C_STRUCT_1",
                assessment_date=f"2026-06-0{i+1}",
                structural_cause_code="missing_signage",
                suggested_fix="install_no_parking_sign",
                severity=4, confidence="HIGH",
                officer_id=officer, source="test",
                db_path=tmp_db, scored_path=scored_csv,
            )
        # C_STRUCT_2: only 1 officer → not escalation-ready
        _insert_assessment(tmp_db, "C_STRUCT_2", "OFF_SOLO", severity=4,
                           scored_path=scored_csv)

        pdfs = generate_all_escalation_pdfs(
            min_independent_officers=3,
            output_dir=tmp_path / "pdfs",
            db_path=tmp_db,
            scored_path=scored_csv,
        )
        assert len(pdfs) == 1
        assert all(p.exists() for p in pdfs)

    def test_no_escalation_ready_returns_empty(self, tmp_db: Path, scored_csv: Path,
                                                tmp_path: Path) -> None:
        # Only 2 officers — not escalation_ready
        for officer in ["OFF_A", "OFF_B"]:
            _insert_assessment(tmp_db, "C_STRUCT_1", officer, severity=4,
                               scored_path=scored_csv)
        pdfs = generate_all_escalation_pdfs(
            min_independent_officers=3,
            output_dir=tmp_path / "pdfs",
            db_path=tmp_db,
            scored_path=scored_csv,
        )
        assert len(pdfs) == 0


# ---------------------------------------------------------------------------
# L. Allowed constants sanity check
# ---------------------------------------------------------------------------

class TestAllowedConstants:
    def test_cause_codes_not_empty(self) -> None:
        assert len(_ALLOWED_CAUSE_CODES) > 0

    def test_suggested_fixes_not_empty(self) -> None:
        assert len(_ALLOWED_SUGGESTED_FIXES) > 0

    def test_confidence_levels(self) -> None:
        assert _ALLOWED_CONFIDENCE == {"LOW", "MEDIUM", "HIGH"}

    def test_known_cause_codes_present(self) -> None:
        for code in ("missing_signage", "faded_marking", "no_loading_zone", "other"):
            assert code in _ALLOWED_CAUSE_CODES, f"{code!r} not in allowed cause codes"

    def test_known_fixes_present(self) -> None:
        for fix in ("install_no_parking_sign", "create_loading_zone",
                    "police_enforcement_only", "other"):
            assert fix in _ALLOWED_SUGGESTED_FIXES, f"{fix!r} not in allowed fixes"
