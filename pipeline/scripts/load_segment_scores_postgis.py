#!/usr/bin/env python3
"""Load segment_scores.parquet into Supabase PostGIS (truncate-and-load).

Requires DATABASE_URL (Postgres connection string from Supabase → Project Settings → Database).
Use the URI with the database password; prefer the session/transaction pooler or direct
connection. Do not commit credentials.

Usage:
    export DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
    python scripts/load_segment_scores_postgis.py
    python scripts/load_segment_scores_postgis.py --dry-run
    python scripts/load_segment_scores_postgis.py --input path/to/segment_scores.parquet

Schema: supabase/migrations/20260715000000_segment_scores.sql
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text

from yourwalk_pipeline.paths import INTERMEDIATE_DIR

DEFAULT_INPUT = INTERMEDIATE_DIR / "segment_scores.parquet"
MIGRATION_SQL = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260715000000_segment_scores.sql"
)

TABLE = "segment_scores"

COLUMNS = [
    "segment_id",
    "geometry",
    "walk_path_class",
    "score_eligible",
    "suburb",
    "ward",
    "length_m",
    "score_width",
    "score_surface",
    "score_speed",
    "score_graffiti",
    "score_school_crossing_bonus",
    "accessibility_score",
    "score_heat",
    "score_canopy",
    "score_comfort",
    "heat_shade_score",
    "day_index_score",
    "score_lighting",
    "score_crash",
    "lighting_after_dark_score",
    "night_index_score",
    "day_index_display",
    "night_index_display",
    "confidence_day",
    "confidence_night",
    "data_vintage",
    "scored_at",
    "methodology_version",
    "scoring_spec_version",
    "loaded_at",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help="Path to segment_scores.parquet",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL"),
        help="Postgres URL (default: DATABASE_URL or SUPABASE_DB_URL env)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate parquet and print summary without writing",
    )
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip applying migration SQL (table must already exist)",
    )
    return parser.parse_args()


def prepare_gdf(path: Path) -> gpd.GeoDataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run: python scripts/score_segments.py"
        )

    gdf = gpd.read_parquet(path)
    missing = [c for c in COLUMNS if c != "loaded_at" and c not in gdf.columns]
    if missing:
        raise ValueError(f"Parquet missing columns: {missing}")

    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    out = gdf[COLUMNS[:-1]].copy()
    out["segment_id"] = out["segment_id"].astype("int64")
    out["score_eligible"] = out["score_eligible"].fillna(False).astype(bool)

    # Keep vintage as JSON text (scoring already dumps DATA_VINTAGE)
    def _as_text(val: object) -> str | None:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return None
        if isinstance(val, dict):
            return json.dumps(val)
        return str(val)

    out["data_vintage"] = out["data_vintage"].map(_as_text)
    out["scored_at"] = pd.to_datetime(out["scored_at"], utc=True)
    out["loaded_at"] = datetime.now(UTC)

    # Ensure polygonal geometry (explode MultiPolygon if ever present)
    out = out.explode(index_parts=False, ignore_index=True)
    out["geometry"] = out.geometry
    invalid = ~out.geometry.is_valid
    if invalid.any():
        out.loc[invalid, "geometry"] = out.loc[invalid, "geometry"].buffer(0)

    return out


def apply_schema(engine) -> None:
    if not MIGRATION_SQL.exists():
        raise FileNotFoundError(f"Migration not found: {MIGRATION_SQL}")
    sql = MIGRATION_SQL.read_text(encoding="utf-8")
    # Strip comment-only lines; run statement-by-statement for psycopg
    statements: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            statements.append("\n".join(buf).strip())
            buf = []
    if buf:
        leftover = "\n".join(buf).strip()
        if leftover:
            statements.append(leftover)

    with engine.begin() as conn:
        for statement in statements:
            if statement:
                conn.execute(text(statement))


def load(engine, gdf: gpd.GeoDataFrame) -> dict:
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE public.{TABLE}"))

    # Chunked append avoids oversized single transaction
    chunk_size = 2000
    total = len(gdf)
    for start in range(0, total, chunk_size):
        chunk = gdf.iloc[start : start + chunk_size]
        chunk.to_postgis(
            TABLE,
            engine,
            if_exists="append",
            index=False,
            chunksize=500,
        )
        print(f"  loaded {min(start + chunk_size, total):,} / {total:,}")

    with engine.connect() as conn:
        row = conn.execute(
            text(
                f"""
                SELECT
                  count(*) AS n,
                  count(*) FILTER (WHERE score_eligible) AS eligible,
                  min(scoring_spec_version) AS spec_min,
                  max(scoring_spec_version) AS spec_max,
                  max(scored_at) AS scored_at
                FROM public.{TABLE}
                """
            )
        ).one()

    return {
        "row_count": int(row.n),
        "score_eligible_count": int(row.eligible),
        "scoring_spec_version_min": row.spec_min,
        "scoring_spec_version_max": row.spec_max,
        "scored_at": str(row.scored_at),
        "loaded_at": datetime.now(UTC).isoformat(),
    }


def main() -> int:
    args = parse_args()
    gdf = prepare_gdf(args.input)

    print(f"Input: {args.input}")
    print(f"Rows: {len(gdf):,}")
    print(f"CRS: {gdf.crs}")
    print(f"scoring_spec_version: {gdf['scoring_spec_version'].dropna().unique().tolist()}")
    print(f"score_eligible: {int(gdf['score_eligible'].sum()):,}")

    if args.dry_run:
        print("Dry run — no database write.")
        return 0

    if not args.database_url:
        print(
            "ERROR: Set DATABASE_URL or SUPABASE_DB_URL.\n"
            "Supabase → Project Settings → Database → Connection string (URI).\n"
            "Example:\n"
            "  export DATABASE_URL='postgresql://postgres.muxatxlmpbkrsygmxcje:[PASSWORD]@...pooler.supabase.com:5432/postgres'",
            file=sys.stderr,
        )
        return 1

    # SQLAlchemy wants postgresql+psycopg:// for psycopg3
    url = args.database_url
    if url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)

    engine = create_engine(url, pool_pre_ping=True)

    if not args.skip_schema:
        print("Applying schema / RLS…")
        apply_schema(engine)

    print(f"Truncate-and-load public.{TABLE}…")
    summary = load(engine, gdf)
    print(json.dumps(summary, indent=2))
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
