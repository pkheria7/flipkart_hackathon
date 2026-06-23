"""
Cross-platform smoke test for GridLock Command local setup.

Run from the repo root:
    python scripts/check_local_setup.py
"""

from __future__ import annotations

import sys
import os
from pathlib import Path

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
WARN = "\033[33mWARN\033[0m"

_failures = 0


def ok(label: str, detail: str = "") -> None:
    print(f"  {PASS}  {label}" + (f" — {detail}" if detail else ""))


def fail(label: str, detail: str = "") -> None:
    global _failures
    _failures += 1
    print(f"  {FAIL}  {label}" + (f" — {detail}" if detail else ""))


def warn(label: str, detail: str = "") -> None:
    print(f"  {WARN}  {label}" + (f" — {detail}" if detail else ""))


def section(title: str) -> None:
    print(f"\n{'─' * 55}")
    print(f"  {title}")
    print(f"{'─' * 55}")


# ── 1. Environment ─────────────────────────────────────────────────────────────

section("1. Environment")
print(f"  CWD          : {os.getcwd()}")
print(f"  Python       : {sys.version}")
print(f"  Platform     : {sys.platform}")


# ── 2. Repo root detection ─────────────────────────────────────────────────────

section("2. Repo root detection")


def find_repo_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (
            (candidate / "data").exists()
            and (candidate / "frontend").exists()
            and (candidate / "app").exists()
        ):
            return candidate
    return here.parents[1]


REPO_ROOT = find_repo_root()
print(f"  Detected root: {REPO_ROOT}")

markers = ["data", "frontend", "app", "pipeline"]
for m in markers:
    p = REPO_ROOT / m
    if p.exists():
        ok(f"{m}/ exists")
    else:
        fail(f"{m}/ NOT found", str(p))

# Add repo root to sys.path so we can import app.*
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


# ── 3. Required output files ───────────────────────────────────────────────────

section("3. Required output files")

REQUIRED = [
    "data/outputs/scored_hotspots.parquet",
    "data/outputs/scored_hotspots.csv",
    "data/outputs/patrol_routes.json",
]
OPTIONAL = [
    "data/outputs/approved_master_plan.json",
    "data/outputs/daily_master_plan.json",
    "data/outputs/pending_master_plan.json",
]

for rel in REQUIRED:
    p = REPO_ROOT / rel
    if p.exists():
        ok(rel, f"{p.stat().st_size:,} bytes")
    else:
        fail(rel, "NOT FOUND")

for rel in OPTIONAL:
    p = REPO_ROOT / rel
    if p.exists():
        ok(rel)
    else:
        warn(rel, "missing — run demo_flow.py to regenerate")


# ── 4. pandas / pyarrow / fastparquet ─────────────────────────────────────────

section("4. Python dependencies")

try:
    import pandas as pd
    ok("pandas", pd.__version__)
except ImportError as e:
    fail("pandas", str(e))
    sys.exit(f"\n  Cannot continue without pandas. Run: pip install pandas")

try:
    import pyarrow  # noqa: F401
    ok("pyarrow (parquet engine)", pyarrow.__version__)
    _has_pyarrow = True
except ImportError:
    warn("pyarrow NOT installed — parquet reads will fail; CSV fallback will be used")
    warn("  Fix: pip install pyarrow")
    _has_pyarrow = False

try:
    import fastparquet  # noqa: F401
    ok("fastparquet (alternative engine)")
except ImportError:
    if not _has_pyarrow:
        fail("Neither pyarrow nor fastparquet installed — parquet unreadable!")
    # else fine


# ── 5. Parquet / CSV read ─────────────────────────────────────────────────────

section("5. Hotspot data read")

PARQUET = REPO_ROOT / "data/outputs/scored_hotspots.parquet"
CSV     = REPO_ROOT / "data/outputs/scored_hotspots.csv"

df = None

if PARQUET.exists():
    try:
        df = pd.read_parquet(PARQUET)
        ok("parquet read", f"{len(df)} rows × {len(df.columns)} cols")
    except Exception as exc:
        fail("parquet read", str(exc))
        if CSV.exists():
            warn("Falling back to CSV...")

if df is None and CSV.exists():
    try:
        df = pd.read_csv(CSV)
        ok("CSV fallback read", f"{len(df)} rows × {len(df.columns)} cols")
    except Exception as exc:
        fail("CSV fallback read", str(exc))

if df is None:
    fail("No hotspot data readable — check data/outputs/")
    sys.exit("\n  Cannot continue without hotspot data.")


# ── 6. Row count + classification counts ─────────────────────────────────────

section("6. Hotspot counts")

total = len(df)
print(f"  Total rows   : {total}")

if total == 1084:
    ok("total_hotspots == 1084")
elif total > 0:
    warn(f"total_hotspots = {total} (expected 1084 — different pipeline run?)")
else:
    fail("total_hotspots = 0")

if "classification" in df.columns:
    counts = df["classification"].str.upper().value_counts().to_dict()
    print(f"  Classifications: {counts}")
    for cls, expected in [("STRUCTURAL", 243), ("RESPONSIVE", 631), ("SEASONAL", 210)]:
        actual = counts.get(cls, 0)
        if actual == expected:
            ok(f"{cls} == {expected}")
        else:
            warn(f"{cls} = {actual} (expected {expected})")
else:
    fail("'classification' column missing from hotspot data")


# ── 7. readers module smoke tests ─────────────────────────────────────────────

section("7. readers module")

try:
    from app.api.readers import read_hotspots, read_hotspots_summary, PROJECT_ROOT as RROOT
    ok("import app.api.readers")
    print(f"  readers.PROJECT_ROOT: {RROOT}")
    if RROOT == REPO_ROOT:
        ok("PROJECT_ROOT matches detected repo root")
    else:
        warn(f"PROJECT_ROOT mismatch — readers uses {RROOT}, script found {REPO_ROOT}")
except ImportError as exc:
    fail("import app.api.readers", str(exc))
    sys.exit("\n  Fix sys.path or run from repo root.")

try:
    rows5 = read_hotspots(limit=5)
    if len(rows5) == 5:
        ok("read_hotspots(limit=5) returns 5 rows")
    elif len(rows5) > 0:
        warn(f"read_hotspots(limit=5) returned {len(rows5)} rows (expected 5)")
    else:
        fail("read_hotspots(limit=5) returned [] — see diagnostic above")
except Exception as exc:
    fail("read_hotspots(limit=5) raised exception", str(exc))

try:
    summary = read_hotspots_summary()
    t = summary.get("total_hotspots", 0)
    if t == 1084:
        ok("read_hotspots_summary() total_hotspots == 1084")
    elif t > 0:
        warn(f"read_hotspots_summary() total_hotspots = {t} (expected 1084)")
    else:
        fail(f"read_hotspots_summary() total_hotspots = {t}")
    print(f"  summary keys: {list(summary.keys())}")
except Exception as exc:
    fail("read_hotspots_summary() raised exception", str(exc))


# ── Final result ───────────────────────────────────────────────────────────────

section("Result")
if _failures == 0:
    print(f"\n  {PASS}  All checks passed — system is ready.\n")
else:
    print(f"\n  {FAIL}  {_failures} check(s) failed — see above for details.\n")
    sys.exit(1)
