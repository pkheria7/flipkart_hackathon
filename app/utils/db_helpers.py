"""
Database helpers

Purpose:
    Small, reusable SQLite utilities used by M12 (feedback) and M15
    (infra intel): connection context manager, table-existence checks,
    safe migrations, and row serialization.

Key functions:
    - get_sqlite_connection(path) -> sqlite3.Connection with row_factory
    - table_exists(conn, table_name) -> bool
    - execute_script(conn, sql_script)
    - rows_to_dicts(rows) -> list[dict]

Owner:
    Shared backend utility.
"""

# TODO: implement SQLite helper functions
