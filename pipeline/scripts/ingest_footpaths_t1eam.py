#!/usr/bin/env python3
"""Ingest City of Casey Footpaths (T1EAM) — segment network source for ADR-008.

Downloads from Casey Open Data, loads into DuckDB, runs width QA, exports GeoParquet.

Usage:
    python scripts/ingest_footpaths_t1eam.py
    python scripts/ingest_footpaths_t1eam.py --force-download
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
from yourwalk_pipeline.qa_width import WIDTH_QA_SQL

DATASET_ID = "footpaths_ply_t1eam"
RAW_GEOJSON = RAW_DIR / f"{DATASET_ID}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_ID}.parquet"
QA_REPORT_JSON = QA_DIR / f"{DATASET_ID}_width_qa.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download GeoJSON even if cached in data/raw/",
    )
    return parser.parse_args()


def install_extensions(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL spatial; LOAD spatial;")


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(
        f"""
        CREATE OR REPLACE TABLE footpaths AS
        SELECT
            gisfid AS segment_id,
            t1key,
            feature_type,
            pathsfmat AS surface_material,
            width_m,
            length_m,
            funcuse AS function_use,
            ownership,
            pathuse,
            suburb,
            ward,
            postcode,
            gismoddate AS gis_modified_date,
            geom,
            {WIDTH_QA_SQL} AS width_qa_flag
        FROM ST_Read('{RAW_GEOJSON.as_posix()}')
        WHERE geom IS NOT NULL
        """
    )


def width_qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM footpaths").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT width_qa_flag, COUNT(*) AS n
            FROM footpaths
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    outlier_rows = con.execute(
        """
        SELECT
            segment_id,
            width_m,
            width_qa_flag,
            suburb,
            length_m,
            surface_material
        FROM footpaths
        WHERE width_qa_flag != 'ok'
        ORDER BY
            CASE width_qa_flag
                WHEN 'too_wide' THEN 1
                WHEN 'zero' THEN 2
                WHEN 'too_narrow' THEN 3
                WHEN 'missing' THEN 4
                ELSE 5
            END,
            width_m DESC NULLS LAST
        LIMIT 50
        """
    ).fetchall()

    columns = [
        "segment_id",
        "width_m",
        "width_qa_flag",
        "suburb",
        "length_m",
        "surface_material",
    ]
    outliers = [dict(zip(columns, row, strict=True)) for row in outlier_rows]

    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "width_qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "width_qa_sample_outliers": outliers,
        "methodology_version": "1.1",
        "notes": (
            "Segments with width_qa_flag != 'ok' are retained for scoring with reduced "
            "confidence. Do not drop outliers without manual review."
        ),
    }


def main() -> int:
    args = parse_args()
    ensure_data_dirs()

    print(f"Downloading {DATASET_ID} …")
    download_geojson_export(DATASET_ID, RAW_GEOJSON, force=args.force_download)
    print(f"  → {RAW_GEOJSON}")

    con = duckdb.connect()
    install_extensions(con)

    print("Loading into DuckDB and running width QA …")
    build_intermediate(con)

    qa_report = width_qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → Width QA flags: {qa_report['width_qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "footpaths", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
