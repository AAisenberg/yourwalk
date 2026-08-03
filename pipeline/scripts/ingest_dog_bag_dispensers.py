#!/usr/bin/env python3
"""Ingest Casey Dog Dispenser Bags (T1EAM) — overlay only (not index maths).

Usage:
    python scripts/ingest_dog_bag_dispensers.py
    python scripts/ingest_dog_bag_dispensers.py --force-download
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

DATASET_ID = "dog-dispenser-bags-pt-t1eam"
RAW_GEOJSON = RAW_DIR / f"{DATASET_ID}.geojson"
# Hyphen-free parquet name for filesystem convenience
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / "dog_dispenser_bags_pt_t1eam.parquet"
QA_REPORT_JSON = QA_DIR / "dog_dispenser_bags_pt_t1eam_qa.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force-download", action="store_true")
    return parser.parse_args()


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    raw = RAW_GEOJSON.as_posix()
    con.execute(
        f"""
        CREATE OR REPLACE TABLE dog_bag_dispensers AS
        SELECT
            CAST(gisfid AS VARCHAR) AS gisfid,
            CAST(t1key AS VARCHAR) AS t1key,
            description,
            facility_feature,
            wcptype AS wcp_type,
            funcuse AS function_use,
            parkresname AS park_reserve_name,
            property_address AS address,
            suburb,
            ward,
            postcode,
            melwayref AS melway_ref,
            ownership,
            geom,
            CASE
                WHEN description IS NULL AND wcptype IS NULL THEN 'missing_type'
                ELSE 'ok'
            END AS qa_flag
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )


def qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM dog_bag_dispensers").fetchone()[0]
    flag_counts = dict(
        con.execute(
            "SELECT qa_flag, COUNT(*) FROM dog_bag_dispensers GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    type_counts = dict(
        con.execute(
            "SELECT wcp_type, COUNT(*) FROM dog_bag_dispensers GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "wcp_types": {str(k): int(v) for k, v in type_counts.items()},
        "methodology_version": "1.1",
        "scoring_role": "overlay_only",
        "notes": (
            "Resident along-the-way overlay and QA viewer. Not in Day/Night index. "
            "Portal export currently sparse vs older register estimate (~164)."
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
    export_geoparquet(con, "dog_bag_dispensers", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
