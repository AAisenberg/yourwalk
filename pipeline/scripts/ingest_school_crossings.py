#!/usr/bin/env python3
"""Ingest Casey School Crossings (T1EAM) — Accessibility enrichment.

School crossings only — does not replace general pedestrian crossing data
(Council request pending).

Usage:
    python scripts/ingest_school_crossings.py
    python scripts/ingest_school_crossings.py --force-download
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
from yourwalk_pipeline.qa_school_crossings import SCHOOL_QA_SQL, STREET_QA_SQL

DATASET_ID = "school_crossings_pt_t1eam"
RAW_GEOJSON = RAW_DIR / f"{DATASET_ID}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_ID}.parquet"
QA_REPORT_JSON = QA_DIR / f"{DATASET_ID}_qa.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force-download", action="store_true")
    return parser.parse_args()


def install_extensions(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL spatial; LOAD spatial;")


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    raw = RAW_GEOJSON.as_posix()
    con.execute(
        f"""
        CREATE OR REPLACE TABLE school_crossings AS
        SELECT
            gisfid,
            t1key,
            name_of_school AS school_name,
            streetname AS street_name,
            addressno AS address_number,
            property_address,
            feature_type,
            suburb,
            ward,
            postcode,
            melwayref AS melway_ref,
            geom,
            {SCHOOL_QA_SQL} AS school_qa_flag,
            {STREET_QA_SQL} AS street_qa_flag,
            CASE
                WHEN {SCHOOL_QA_SQL} != 'ok' THEN {SCHOOL_QA_SQL}
                WHEN {STREET_QA_SQL} != 'ok' THEN {STREET_QA_SQL}
                ELSE 'ok'
            END AS qa_flag
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )


def qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM school_crossings").fetchone()[0]
    flag_counts = dict(
        con.execute(
            "SELECT qa_flag, COUNT(*) FROM school_crossings GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    suburbs = dict(
        con.execute(
            """
            SELECT suburb, COUNT(*) FROM school_crossings
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """
        ).fetchall()
    )
    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "suburbs_top": {str(k): int(v) for k, v in suburbs.items()},
        "methodology_version": "1.1",
        "scoring_role": "accessibility_enrichment",
        "notes": (
            "School crossing locations only. General pedestrian crossings remain a "
            "coverage gap until Council provides data."
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

    qa_report = qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "school_crossings", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
