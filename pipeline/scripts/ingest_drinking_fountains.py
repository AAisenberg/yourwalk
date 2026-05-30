#!/usr/bin/env python3
"""Ingest Casey Drinking Fountains (T1EAM) — Day Index comfort input.

Usage:
    python scripts/ingest_drinking_fountains.py
    python scripts/ingest_drinking_fountains.py --force-download
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
from yourwalk_pipeline.qa_fountains import CONDITION_QA_SQL, TYPE_QA_SQL

DATASET_ID = "drinkingfountains_pt_t1eam"
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
        CREATE OR REPLACE TABLE drinking_fountains AS
        SELECT
            gisfid,
            featuretype AS feature_type,
            dftype AS fountain_type,
            dfmaterial AS material,
            facilitytype AS facility_type,
            condition,
            funcuse AS function_use,
            parkreservename AS park_reserve_name,
            address,
            suburb,
            ward,
            postcode,
            melwayref AS melway_ref,
            ownership,
            geom,
            {CONDITION_QA_SQL} AS condition_qa_flag,
            {TYPE_QA_SQL} AS type_qa_flag,
            CASE
                WHEN {CONDITION_QA_SQL} = 'placeholder_condition' THEN 'placeholder_condition'
                WHEN {TYPE_QA_SQL} != 'ok' THEN {TYPE_QA_SQL}
                ELSE 'ok'
            END AS qa_flag
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )


def qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM drinking_fountains").fetchone()[0]
    flag_counts = dict(
        con.execute(
            "SELECT qa_flag, COUNT(*) FROM drinking_fountains GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    condition_counts = dict(
        con.execute(
            "SELECT condition, COUNT(*) FROM drinking_fountains GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    type_counts = dict(
        con.execute(
            "SELECT fountain_type, COUNT(*) FROM drinking_fountains GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
        ).fetchall()
    )
    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "condition_values": {str(k): int(v) for k, v in condition_counts.items()},
        "fountain_types_top": {str(k): int(v) for k, v in type_counts.items()},
        "methodology_version": "1.1",
        "scoring_role": "day_index_comfort",
        "notes": "Day Index Heat & Shade comfort input — proximity to footpath segments at scoring time.",
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
    export_geoparquet(con, "drinking_fountains", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
