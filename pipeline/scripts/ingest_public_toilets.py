#!/usr/bin/env python3
"""Ingest Casey Public Toilet Blocks (T1EAM) — overlay only (not index maths).

Usage:
    python scripts/ingest_public_toilets.py
    python scripts/ingest_public_toilets.py --force-download
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

import duckdb

from yourwalk_pipeline.download import download_geojson_export
from yourwalk_pipeline.export import export_geoparquet
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, RAW_DIR, ensure_data_dirs

DATASET_ID = "public_toilet_block_pt_t1eam"
RAW_GEOJSON = RAW_DIR / f"{DATASET_ID}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_ID}.parquet"
QA_REPORT_JSON = QA_DIR / f"{DATASET_ID}_qa.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force-download", action="store_true")
    return parser.parse_args()


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    raw = RAW_GEOJSON.as_posix()
    con.execute(
        f"""
        CREATE OR REPLACE TABLE public_toilets AS
        SELECT
            CAST(gisfid AS VARCHAR) AS gisfid,
            name,
            facility_feature,
            funcuse AS function_use,
            property_address AS address,
            suburb,
            ward,
            postcode,
            geom,
            CASE
                WHEN name IS NULL OR TRIM(CAST(name AS VARCHAR)) = '' THEN 'missing_name'
                WHEN lower(CAST(name AS VARCHAR)) LIKE '%not a public toilet%'
                    THEN 'not_public_toilet'
                ELSE 'ok'
            END AS qa_flag
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )


def qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM public_toilets").fetchone()[0]
    flag_counts = dict(
        con.execute(
            "SELECT qa_flag, COUNT(*) FROM public_toilets GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    suburb_n = con.execute(
        "SELECT COUNT(DISTINCT suburb) FROM public_toilets"
    ).fetchone()[0]
    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "suburb_count": int(suburb_n),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "methodology_version": "1.1",
        "scoring_role": "overlay_only",
        "notes": (
            "Resident along-the-way overlay and QA viewer. Not in Day/Night index. "
            "Names flagged not_public_toilet retained for transparency."
        ),
    }


def main() -> int:
    args = parse_args()
    ensure_data_dirs()
    print(f"Downloading {DATASET_ID} …")
    download_geojson_export(DATASET_ID, RAW_GEOJSON, force=args.force_download)
    print(f"  → {RAW_GEOJSON}")

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    print("Loading into DuckDB and running QA …")
    build_intermediate(con)

    qa_report = qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "public_toilets", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
