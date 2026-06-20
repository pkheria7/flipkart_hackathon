"""
M12 — Feedback Loop (backend half)

Purpose:
    Persist officer enforcement outcomes and expose read/write functions so the
    pipeline can learn which hotspots were enforced but recurred.

Outputs:
    data/outputs/feedback.sqlite

Schema (tentative):
    feedback(
        feedback_id    INTEGER PRIMARY KEY,
        cluster_id     TEXT NOT NULL,
        officer_id     TEXT,
        action_taken   TEXT,        -- TOW / WARNING / BARRIER / COULDNT / NEEDS_TOW
        outcome        TEXT,        -- ENFORCED / RECURRED / NO_SHOW / etc.
        timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP
    )

Key functions:
    - init_feedback_db() -> create schema
    - insert_feedback(cluster_id, officer_id, action_taken, outcome)
    - get_feedback_for_cluster(cluster_id) -> list of rows
    - get_enforced_but_recurred() -> list of cluster_ids

Owner:
    Prakhar — Classification, Geography & Ops Layer.
"""

# TODO: implement M12 feedback backend logic
