#!/usr/bin/env python3
"""Apply a SQL migration file via DATABASE_URL (Supabase Postgres).

Usage (from pipeline/ with venv):

  export DATABASE_URL='postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres'
  python scripts/apply_migration_sql.py ../supabase/migrations/20260716000000_score_route_corridor.sql
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg
except ImportError:
    print("Install psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
    sys.exit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sql_path", type=Path, help="Path to .sql migration")
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL"),
    )
    args = parser.parse_args()

    if not args.database_url:
        print(
            "ERROR: Set DATABASE_URL or SUPABASE_DB_URL "
            "(Supabase → Project Settings → Database).",
            file=sys.stderr,
        )
        return 1

    sql = args.sql_path.read_text(encoding="utf-8")
    print(f"Applying {args.sql_path} …")
    with psycopg.connect(args.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
