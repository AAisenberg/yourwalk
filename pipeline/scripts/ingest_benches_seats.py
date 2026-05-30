#!/usr/bin/env python3
"""Ingest Casey Benches and Seats (T1EAM) — Day Index comfort input.

Quantity/capacity asset fields are unreliable — score on presence/location only
(methodology v1.1).

Usage:
    python scripts/ingest_benches_seats.py
    python scripts/ingest_benches_seats.py --force-download
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
from yourwalk_pipeline.qa_benches import CAPACITY_QA_SQL, FURNCAP_QA_SQL, QUANTITY_QA_SQL

DATASET_ID = "benches_seats_pt_t1eam"
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
        CREATE OR REPLACE TABLE benches_seats AS
        SELECT
            gisfid,
            t1key,
            amenitytype AS amenity_type,
            facility,
            funcuse AS function_use,
            reserve_name,
            propertyaddress AS property_address,
            TRY_CAST(length_m AS DOUBLE) AS length_m,
            TRY_CAST(width_m AS DOUBLE) AS width_m,
            TRY_CAST(height_m AS DOUBLE) AS height_m,
            quantity,
            capacity,
            furncap AS furniture_capacity,
            suburb,
            ward,
            postcode,
            melwayref AS melway_ref,
            ownership,
            geom,
            {QUANTITY_QA_SQL} AS quantity_qa_flag,
            {CAPACITY_QA_SQL} AS capacity_qa_flag,
            {FURNCAP_QA_SQL} AS furncap_qa_flag,
            'ok' AS qa_flag
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )


def qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM benches_seats").fetchone()[0]
    quantity_flags = dict(
        con.execute(
            "SELECT quantity_qa_flag, COUNT(*) FROM benches_seats GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    capacity_flags = dict(
        con.execute(
            "SELECT capacity_qa_flag, COUNT(*) FROM benches_seats GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    amenity_types = dict(
        con.execute(
            """
            SELECT amenity_type, COUNT(*) FROM benches_seats
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """
        ).fetchall()
    )
    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {"ok": int(total)},
        "quantity_qa_flags": {k: int(v) for k, v in quantity_flags.items()},
        "capacity_qa_flags": {k: int(v) for k, v in capacity_flags.items()},
        "amenity_types_top": {str(k): int(v) for k, v in amenity_types.items()},
        "methodology_version": "1.1",
        "scoring_role": "day_index_comfort",
        "scoring_note": "Use presence/location only; ignore quantity and capacity fields.",
        "notes": (
            "Day Index rest/comfort input. quantity/capacity/furncap are asset-system "
            "placeholders for most records — documented in QA flags, not used in scoring."
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
    print(f"  → Quantity QA: {qa_report['quantity_qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "benches_seats", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
