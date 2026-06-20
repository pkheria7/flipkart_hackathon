"""
Database helpers — shared SQLite utilities for M12 (feedback) and M15 (infra intel).

Key functions:
    get_sqlite_connection(path)   — context manager, row_factory enabled, auto-commit/rollback
    table_exists(conn, name)      — bool
    index_exists(conn, name)      — bool
    execute_script(conn, sql)     — run multi-statement DDL
    rows_to_dicts(rows)           — sqlite3.Row list → list[dict]
    row_count(conn, table)        — fast COUNT(*)
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator


@contextmanager
def get_sqlite_connection(path: Path) -> Generator[sqlite3.Connection, None, None]:
    """
    Yield a WAL-mode, row_factory-enabled SQLite connection.
    Commits on clean exit, rolls back on exception.
    """
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return bool(row[0])


def index_exists(conn: sqlite3.Connection, index_name: str) -> bool:
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?",
        (index_name,),
    ).fetchone()
    return bool(row[0])


def execute_script(conn: sqlite3.Connection, sql_script: str) -> None:
    conn.executescript(sql_script)


def rows_to_dicts(rows: list) -> list[dict]:
    return [dict(row) for row in rows]


def row_count(conn: sqlite3.Connection, table_name: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
