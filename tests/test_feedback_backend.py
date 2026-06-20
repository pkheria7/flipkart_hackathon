"""
Unit tests for M12 Feedback Loop Backend.

Run with:
    pytest tests/test_feedback_backend.py -v

All tests use a temporary SQLite database and a temporary scored_hotspots CSV,
so they never touch the real database or scored output files.
"""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

import pytest

from app.officer.feedback_backend import (
    ALLOWED_ACTION_TYPES,
    ALLOWED_OUTCOMES,
    export_feedback_summary_csv,
    get_feedback_for_cluster,
    get_feedback_summary_for_scoring,
    init_feedback_db,
    insert_feedback,
    validate_cluster_id,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_db(tmp_path: Path) -> Path:
    """Initialised feedback.sqlite in a temp directory."""
    db = tmp_path / "feedback.sqlite"
    init_feedback_db(db)
    return db


@pytest.fixture()
def scored_csv(tmp_path: Path) -> Path:
    """Minimal scored_hotspots.csv with known cluster_ids for validation."""
    p = tmp_path / "scored_hotspots.csv"
    rows = [
        {"cluster_id": "C_TEST_1"},
        {"cluster_id": "C_TEST_2"},
        {"cluster_id": "C_TEST_3"},
    ]
    with p.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["cluster_id"])
        writer.writeheader()
        writer.writerows(rows)
    return p


# ---------------------------------------------------------------------------
# A. init
# ---------------------------------------------------------------------------

class TestInitFeedbackDb:
    def test_creates_db_file(self, tmp_path: Path) -> None:
        db = tmp_path / "fb.sqlite"
        result = init_feedback_db(db)
        assert db.exists()
        assert result == db

    def test_idempotent(self, tmp_path: Path) -> None:
        db = tmp_path / "fb.sqlite"
        init_feedback_db(db)
        init_feedback_db(db)  # second call must not raise or corrupt
        conn = sqlite3.connect(str(db))
        count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='feedback_events'"
        ).fetchone()[0]
        conn.close()
        assert count == 1

    def test_table_has_correct_columns(self, tmp_db: Path) -> None:
        conn = sqlite3.connect(str(tmp_db))
        info = conn.execute("PRAGMA table_info(feedback_events)").fetchall()
        conn.close()
        col_names = {row[1] for row in info}
        required = {
            "id", "cluster_id", "feedback_date", "feedback_timestamp_ist",
            "assigned_station", "officer_id", "action_type",
            "enforcement_done", "outcome", "recurred_after_enforcement",
            "recurrence_window_days", "notes", "source", "created_at_ist",
        }
        assert required.issubset(col_names)

    def test_indexes_created(self, tmp_db: Path) -> None:
        conn = sqlite3.connect(str(tmp_db))
        indexes = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='feedback_events'"
            ).fetchall()
        }
        conn.close()
        assert "idx_fe_cluster_id" in indexes
        assert "idx_fe_feedback_date" in indexes
        assert "idx_fe_cluster_date" in indexes
        assert "idx_fe_recurred" in indexes


# ---------------------------------------------------------------------------
# B. validate_cluster_id
# ---------------------------------------------------------------------------

class TestValidateClusterId:
    def test_valid_cluster_id(self, scored_csv: Path) -> None:
        assert validate_cluster_id("C_TEST_1", scored_csv) is True

    def test_invalid_cluster_id(self, scored_csv: Path) -> None:
        assert validate_cluster_id("DOES_NOT_EXIST", scored_csv) is False

    def test_missing_scored_file_returns_false(self, tmp_path: Path) -> None:
        missing = tmp_path / "nonexistent.csv"
        assert validate_cluster_id("C_TEST_1", missing) is False


# ---------------------------------------------------------------------------
# C. insert_feedback
# ---------------------------------------------------------------------------

class TestInsertFeedback:
    def test_basic_insert_returns_id(self, tmp_db: Path, scored_csv: Path) -> None:
        row_id = insert_feedback(
            cluster_id="C_TEST_1",
            action_type="patrol",
            enforcement_done=1,
            outcome="improved",
            db_path=tmp_db,
            scored_path=scored_csv,
        )
        assert isinstance(row_id, int)
        assert row_id >= 1

    def test_multiple_inserts_increment_id(self, tmp_db: Path, scored_csv: Path) -> None:
        id1 = insert_feedback("C_TEST_1", "patrol", 1, "improved",
                               db_path=tmp_db, scored_path=scored_csv)
        id2 = insert_feedback("C_TEST_2", "towing", 1, "recurred",
                               db_path=tmp_db, scored_path=scored_csv)
        assert id2 > id1

    def test_recurred_forces_recurred_after_enforcement_1(
        self, tmp_db: Path, scored_csv: Path
    ) -> None:
        insert_feedback(
            "C_TEST_1", "towing", 1, "recurred",
            recurred_after_enforcement=0,  # should be overridden to 1
            db_path=tmp_db, scored_path=scored_csv,
        )
        rows = get_feedback_for_cluster("C_TEST_1", tmp_db)
        assert rows[0]["recurred_after_enforcement"] == 1

    def test_invalid_action_type_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="Invalid action_type"):
            insert_feedback("C_TEST_1", "INVALID_ACTION", 1, "improved",
                            db_path=tmp_db, scored_path=scored_csv)

    def test_invalid_outcome_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="Invalid outcome"):
            insert_feedback("C_TEST_1", "patrol", 1, "GOOD",
                            db_path=tmp_db, scored_path=scored_csv)

    def test_unknown_cluster_id_raises(self, tmp_db: Path, scored_csv: Path) -> None:
        with pytest.raises(ValueError, match="not found in scored_hotspots"):
            insert_feedback("FAKE_CLUSTER", "patrol", 1, "improved",
                            db_path=tmp_db, scored_path=scored_csv)

    def test_bool_enforcement_normalised(self, tmp_db: Path, scored_csv: Path) -> None:
        insert_feedback("C_TEST_1", "patrol", True, "improved",
                        db_path=tmp_db, scored_path=scored_csv)
        rows = get_feedback_for_cluster("C_TEST_1", tmp_db)
        assert rows[0]["enforcement_done"] == 1

    def test_recurred_flag_with_non_recurred_outcome_raises(
        self, tmp_db: Path, scored_csv: Path
    ) -> None:
        with pytest.raises(ValueError):
            insert_feedback("C_TEST_1", "patrol", 1, "improved",
                            recurred_after_enforcement=1,
                            db_path=tmp_db, scored_path=scored_csv)

    def test_optional_fields_null_ok(self, tmp_db: Path, scored_csv: Path) -> None:
        row_id = insert_feedback(
            "C_TEST_3", "other", 0, "unknown",
            db_path=tmp_db, scored_path=scored_csv,
        )
        rows = get_feedback_for_cluster("C_TEST_3", tmp_db)
        assert rows[0]["officer_id"] is None
        assert rows[0]["notes"] is None
        assert rows[0]["recurrence_window_days"] is None


# ---------------------------------------------------------------------------
# D. get_feedback_for_cluster
# ---------------------------------------------------------------------------

class TestGetFeedbackForCluster:
    def test_returns_empty_list_when_no_db(self, tmp_path: Path) -> None:
        missing_db = tmp_path / "no_db.sqlite"
        result = get_feedback_for_cluster("C_TEST_1", missing_db)
        assert result == []

    def test_returns_correct_rows(self, tmp_db: Path, scored_csv: Path) -> None:
        insert_feedback("C_TEST_1", "patrol", 1, "improved",
                        notes="first", db_path=tmp_db, scored_path=scored_csv)
        insert_feedback("C_TEST_1", "towing", 1, "recurred",
                        notes="second", db_path=tmp_db, scored_path=scored_csv)
        rows = get_feedback_for_cluster("C_TEST_1", tmp_db)
        assert len(rows) == 2
        assert rows[0]["notes"] == "first"
        assert rows[1]["notes"] == "second"

    def test_only_returns_rows_for_requested_cluster(
        self, tmp_db: Path, scored_csv: Path
    ) -> None:
        insert_feedback("C_TEST_1", "patrol", 1, "improved",
                        db_path=tmp_db, scored_path=scored_csv)
        insert_feedback("C_TEST_2", "challan", 0, "unknown",
                        db_path=tmp_db, scored_path=scored_csv)
        rows = get_feedback_for_cluster("C_TEST_1", tmp_db)
        assert all(r["cluster_id"] == "C_TEST_1" for r in rows)
        assert len(rows) == 1


# ---------------------------------------------------------------------------
# E. get_feedback_summary_for_scoring
# ---------------------------------------------------------------------------

class TestGetFeedbackSummaryForScoring:
    def test_returns_empty_df_when_no_db(self, tmp_path: Path) -> None:
        missing_db = tmp_path / "no_db.sqlite"
        df = get_feedback_summary_for_scoring(missing_db)
        assert len(df) == 0
        assert "cluster_id" in df.columns

    def test_one_row_per_cluster(self, tmp_db: Path, scored_csv: Path) -> None:
        insert_feedback("C_TEST_1", "patrol", 1, "improved",
                        db_path=tmp_db, scored_path=scored_csv)
        insert_feedback("C_TEST_1", "towing", 1, "recurred",
                        db_path=tmp_db, scored_path=scored_csv)
        insert_feedback("C_TEST_2", "patrol", 0, "unknown",
                        db_path=tmp_db, scored_path=scored_csv)
        df = get_feedback_summary_for_scoring(tmp_db)
        assert len(df) == 2
        assert df["cluster_id"].nunique() == 2

    def test_enforcement_counts_correct(self, tmp_db: Path, scored_csv: Path) -> None:
        insert_feedback("C_TEST_1", "patrol", 1, "improved",
                        db_path=tmp_db, scored_path=scored_csv)
        insert_feedback("C_TEST_1", "towing", 1, "recurred",
                        db_path=tmp_db, scored_path=scored_csv)
        insert_feedback("C_TEST_1", "patrol", 0, "unknown",
                        db_path=tmp_db, scored_path=scored_csv)
        df = get_feedback_summary_for_scoring(tmp_db)
        row = df[df["cluster_id"] == "C_TEST_1"].iloc[0]
        assert row["feedback_event_count"] == 3
        assert row["enforcement_done_count"] == 2
        assert row["recurred_after_enforcement_count"] == 1

    def test_structural_boost_set_when_recurred(
        self, tmp_db: Path, scored_csv: Path
    ) -> None:
        insert_feedback("C_TEST_1", "towing", 1, "recurred",
                        db_path=tmp_db, scored_path=scored_csv)
        df = get_feedback_summary_for_scoring(tmp_db)
        row = df[df["cluster_id"] == "C_TEST_1"].iloc[0]
        assert row["feedback_structural_boost"] == 1

    def test_structural_boost_zero_when_no_recurrence(
        self, tmp_db: Path, scored_csv: Path
    ) -> None:
        insert_feedback("C_TEST_2", "patrol", 1, "improved",
                        db_path=tmp_db, scored_path=scored_csv)
        df = get_feedback_summary_for_scoring(tmp_db)
        row = df[df["cluster_id"] == "C_TEST_2"].iloc[0]
        assert row["feedback_structural_boost"] == 0


# ---------------------------------------------------------------------------
# F. export_feedback_summary_csv
# ---------------------------------------------------------------------------

class TestExportFeedbackSummaryCsv:
    def test_csv_created(self, tmp_db: Path, tmp_path: Path, scored_csv: Path) -> None:
        insert_feedback("C_TEST_1", "patrol", 1, "improved",
                        db_path=tmp_db, scored_path=scored_csv)
        out = tmp_path / "summary.csv"
        result = export_feedback_summary_csv(out, db_path=tmp_db)
        assert result == out
        assert out.exists()

    def test_csv_has_structural_boost_column(
        self, tmp_db: Path, tmp_path: Path, scored_csv: Path
    ) -> None:
        insert_feedback("C_TEST_1", "towing", 1, "recurred",
                        db_path=tmp_db, scored_path=scored_csv)
        out = tmp_path / "summary.csv"
        export_feedback_summary_csv(out, db_path=tmp_db)
        import pandas as pd
        df = pd.read_csv(out)
        assert "feedback_structural_boost" in df.columns
        assert df.loc[df["cluster_id"] == "C_TEST_1", "feedback_structural_boost"].iloc[0] == 1
