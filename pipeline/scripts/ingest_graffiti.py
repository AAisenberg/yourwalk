#!/usr/bin/env python3
"""Ingest Casey Graffiti Locations — Accessibility stream environmental order proxy.

Downloads from Casey Open Data, loads into DuckDB, runs type/area/date QA,
exports GeoParquet. Not crime data — density and recency for maintenance proxy.

Usage:
    python scripts/ingest_graffiti.py
    python scripts/ingest_graffiti.py --force-download
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
from yourwalk_pipeline.qa_graffiti import AREA_QA_SQL, DATE_QA_SQL, GRAFFITI_TYPE_QA_SQL

DATASET_ID = "graffiti-locations"
RAW_GEOJSON = RAW_DIR / f"{DATASET_ID}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_ID}.parquet"
QA_REPORT_JSON = QA_DIR / f"{DATASET_ID}_qa.json"


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
        CREATE OR REPLACE TABLE graffiti AS
        SELECT
            OGC_FID AS record_id,
            response_times AS graffiti_type,
            created_date,
            completed_date,
            completedyear AS completed_year,
            daystaken_2_remove AS days_to_remove,
            area_removed_m2,
            suburb,
            ward,
            postcode,
            month AS created_month,
            day_of_week AS created_day_of_week,
            geom,
            {GRAFFITI_TYPE_QA_SQL} AS type_qa_flag,
            {AREA_QA_SQL} AS area_qa_flag,
            {DATE_QA_SQL} AS date_qa_flag,
            CASE
                WHEN {GRAFFITI_TYPE_QA_SQL} != 'ok' THEN {GRAFFITI_TYPE_QA_SQL}
                WHEN {DATE_QA_SQL} != 'ok' THEN {DATE_QA_SQL}
                WHEN {AREA_QA_SQL} != 'ok' THEN {AREA_QA_SQL}
                ELSE 'ok'
            END AS qa_flag
        FROM ST_Read('{RAW_GEOJSON.as_posix()}')
        WHERE geom IS NOT NULL
        """
    )


def graffiti_qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM graffiti").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n
            FROM graffiti
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    type_counts = dict(
        con.execute(
            """
            SELECT graffiti_type, COUNT(*) AS n
            FROM graffiti
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    year_counts = dict(
        con.execute(
            """
            SELECT EXTRACT(YEAR FROM created_date)::INTEGER AS yr, COUNT(*) AS n
            FROM graffiti
            WHERE created_date IS NOT NULL
            GROUP BY 1
            ORDER BY 1
            """
        ).fetchall()
    )

    date_range = con.execute(
        """
        SELECT MIN(created_date), MAX(created_date)
        FROM graffiti
        WHERE created_date IS NOT NULL
        """
    ).fetchone()

    outlier_rows = con.execute(
        """
        SELECT
            record_id,
            graffiti_type,
            created_date,
            area_removed_m2,
            days_to_remove,
            qa_flag,
            suburb
        FROM graffiti
        WHERE qa_flag != 'ok'
        ORDER BY
            CASE qa_flag
                WHEN 'high_area' THEN 1
                WHEN 'completed_before_created' THEN 2
                WHEN 'unknown_type' THEN 3
                WHEN 'missing_created_date' THEN 4
                ELSE 5
            END,
            area_removed_m2 DESC NULLS LAST
        LIMIT 50
        """
    ).fetchall()

    columns = [
        "record_id",
        "graffiti_type",
        "created_date",
        "area_removed_m2",
        "days_to_remove",
        "qa_flag",
        "suburb",
    ]
    outliers = [
        {
            **dict(zip(columns, row, strict=True)),
            "created_date": str(row[2]) if row[2] is not None else None,
        }
        for row in outlier_rows
    ]

    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "created_date_range": {
            "min": str(date_range[0]) if date_range[0] else None,
            "max": str(date_range[1]) if date_range[1] else None,
        },
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "graffiti_types": {str(k): int(v) for k, v in type_counts.items()},
        "records_by_created_year": {str(k): int(v) for k, v in year_counts.items()},
        "qa_sample_outliers": outliers,
        "methodology_version": "1.1",
        "notes": (
            "Point records for shared Accessibility environmental order proxy (day and "
            "night). Use location density and recency — not crime or antisocial-behaviour "
            "data. graffiti_type maps from portal field response_times (Offensive / "
            "Non-Offensive). Records with qa_flag != 'ok' retained with reduced confidence."
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

    print("Loading into DuckDB and running QA …")
    build_intermediate(con)

    qa_report = graffiti_qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → QA flags: {qa_report['qa_flags']}")
    print(f"  → Types: {qa_report['graffiti_types']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "graffiti", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
