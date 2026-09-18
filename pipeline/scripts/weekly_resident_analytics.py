#!/usr/bin/env python3
"""Print the last-7-day resident analytics readout.

Usage (from pipeline/ with venv):

  export DATABASE_URL='postgresql://…'
  python scripts/weekly_resident_analytics.py

Or pass --sql-only to print the query for the Supabase SQL editor.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SQL_PATH = ROOT / "supabase" / "queries" / "weekly_resident_analytics.sql"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL"),
    )
    parser.add_argument(
        "--sql-only",
        action="store_true",
        help="Print the SQL and exit (no database connection).",
    )
    args = parser.parse_args()
    sql = SQL_PATH.read_text(encoding="utf-8")

    if args.sql_only:
        print(sql)
        return 0

    if not args.database_url:
        print(
            "ERROR: Set DATABASE_URL or SUPABASE_DB_URL, or pass --sql-only.",
            file=sys.stderr,
        )
        return 1

    try:
        import psycopg
    except ImportError:
        print("Install psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
        return 1

    print("YourWalk resident analytics — last 7 days (Australia/Melbourne)")
    print(f"Query: {SQL_PATH.relative_to(ROOT)}")
    print()
    with psycopg.connect(args.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            width = max((len(str(r[0])) for r in rows), default=8)
            for metric, value in rows:
                print(f"{str(metric):<{width}}  {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
