#!/usr/bin/env python3
"""Ingest City of Casey Shared Use Paths (T1EAM) — validation layer for walk network.

Council publishes this as a view extracted from Footpaths (T1EAM). It is not merged
into the scoring master by row union; use footpaths_ply_t1eam as master and this
ingest for provenance and crosswalk QA.

Usage:
    python scripts/ingest_sharedusepaths_t1eam.py
    python scripts/ingest_sharedusepaths_t1eam.py --force-download
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
from yourwalk_pipeline.walk_network import (
    FOOTPATHS_DATASET_ID,
    SHARED_USE_DATASET_ID,
    WALK_PATH_CLASS_SQL,
    crosswalk_shareduse_qa,
)

DATASET_ID = SHARED_USE_DATASET_ID
RAW_GEOJSON = RAW_DIR / f"{DATASET_ID}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_ID}.parquet"
FOOTPATHS_PARQUET = INTERMEDIATE_DIR / f"{FOOTPATHS_DATASET_ID}.parquet"
QA_CROSSWALK_JSON = QA_DIR / f"{DATASET_ID}_crosswalk.json"
QA_REPORT_JSON = QA_DIR / f"{DATASET_ID}_ingest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download GeoJSON even if cached in data/raw/",
    )
    parser.add_argument(
        "--skip-crosswalk",
        action="store_true",
        help="Skip crosswalk QA (requires footpaths parquet)",
    )
    return parser.parse_args()


def install_extensions(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL spatial; LOAD spatial;")


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(
        f"""
        CREATE OR REPLACE TABLE shared_use_paths AS
        SELECT
            gisfid AS segment_id,
            t1key,
            feature_type,
            {WALK_PATH_CLASS_SQL} AS walk_path_class,
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


def ingest_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM shared_use_paths").fetchone()[0]
    by_class = dict(
        con.execute(
            """
            SELECT walk_path_class, COUNT(*) AS n
            FROM shared_use_paths
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )
    length_km = con.execute(
        "SELECT ROUND(SUM(COALESCE(length_m, 0)) / 1000.0, 1) FROM shared_use_paths"
    ).fetchone()[0]
    median_width = con.execute(
        "SELECT median(width_m) FROM shared_use_paths WHERE width_m IS NOT NULL"
    ).fetchone()[0]

    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "walk_path_class_counts": {k: int(v) for k, v in by_class.items()},
        "total_length_km": float(length_km) if length_km is not None else None,
        "median_width_m": float(median_width) if median_width is not None else None,
        "methodology_version": "1.1",
        "notes": (
            "Validation export only. Scoring master remains footpaths_ply_t1eam.parquet "
            "with walk_path_class derived from feature_type."
        ),
    }


def load_footpaths_for_crosswalk(con: duckdb.DuckDBPyConnection) -> None:
    if not FOOTPATHS_PARQUET.exists():
        raise FileNotFoundError(
            f"Footpaths parquet required for crosswalk: {FOOTPATHS_PARQUET}. "
            "Run ingest_footpaths_t1eam.py first."
        )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE footpaths AS
        SELECT
            segment_id,
            t1key,
            feature_type,
            surface_material,
            width_m,
            length_m,
            function_use,
            ownership,
            suburb,
            ward,
            postcode,
            gis_modified_date,
            width_qa_flag,
            geometry,
            {WALK_PATH_CLASS_SQL} AS walk_path_class
        FROM read_parquet('{FOOTPATHS_PARQUET.as_posix()}')
        """
    )


def main() -> int:
    args = parse_args()
    ensure_data_dirs()

    print(f"Downloading {DATASET_ID} …")
    download_geojson_export(DATASET_ID, RAW_GEOJSON, force=args.force_download)
    print(f"  → {RAW_GEOJSON}")

    con = duckdb.connect()
    install_extensions(con)

    print("Loading shared use paths …")
    build_intermediate(con)

    ingest_report = ingest_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(ingest_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {ingest_report['record_count']:,}")
    print(f"  → Length: {ingest_report['total_length_km']} km")

    if not args.skip_crosswalk:
        print("Crosswalk against footpaths master …")
        load_footpaths_for_crosswalk(con)
        crosswalk = crosswalk_shareduse_qa(con)
        QA_CROSSWALK_JSON.write_text(json.dumps(crosswalk, indent=2), encoding="utf-8")
        print(f"  → Crosswalk: {QA_CROSSWALK_JSON}")
        print(
            f"  → t1key in both: {crosswalk['distinct_t1key_in_both_layers']:,}; "
            f"gisfid-only in export: {crosswalk['gisfid_only_in_shared_use_export']}"
        )

    print("Exporting GeoParquet …")
    export_geoparquet(con, "shared_use_paths", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
