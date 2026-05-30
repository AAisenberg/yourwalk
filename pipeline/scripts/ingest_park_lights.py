#!/usr/bin/env python3
"""Ingest Casey Asset Lights (parks/reserves) — Night Index lighting enrichment.

Supplements AusNet/UE street lights for off-road paths, parks, and reserves.

Usage:
    python scripts/ingest_park_lights.py
    python scripts/ingest_park_lights.py --force-download
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
from yourwalk_pipeline.qa_park_lights import WATTAGE_QA_SQL

DATASET_ID = "parkreserve_light_pt_t1eam"
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
        CREATE OR REPLACE TABLE park_lights AS
        SELECT
            gisfid,
            t1key,
            feature_type,
            facility_feature,
            lumintype AS luminaire_type,
            lttype AS light_type,
            TRY_CAST(luminwatt AS DOUBLE) AS wattage_w,
            TRY_CAST(lampcount AS INTEGER) AS lamp_count,
            TRY_CAST(height_m AS DOUBLE) AS pole_height_m,
            efloctype AS location_type,
            polemat AS pole_material,
            property_address,
            suburb,
            ward,
            postcode,
            melwayref AS melway_ref,
            ownership,
            geom,
            {WATTAGE_QA_SQL} AS qa_flag
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )


def qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM park_lights").fetchone()[0]
    flag_counts = dict(
        con.execute(
            "SELECT qa_flag, COUNT(*) FROM park_lights GROUP BY 1 ORDER BY 2 DESC"
        ).fetchall()
    )
    location_types = dict(
        con.execute(
            """
            SELECT COALESCE(location_type, '(null)') AS location_type, COUNT(*) AS n
            FROM park_lights GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """
        ).fetchall()
    )
    luminaire_types = dict(
        con.execute(
            """
            SELECT COALESCE(luminaire_type, '(null)') AS luminaire_type, COUNT(*) AS n
            FROM park_lights GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """
        ).fetchall()
    )
    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "location_types_top": {str(k): int(v) for k, v in location_types.items()},
        "luminaire_types_top": {str(k): int(v) for k, v in luminaire_types.items()},
        "methodology_version": "1.1",
        "scoring_role": "night_index_enrichment",
        "notes": (
            "Park/reserve lighting enrichment for Night Index. Not a substitute for "
            "street light coverage — combine with ausnet_unitedenergy_mvp4_streetlights."
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
    export_geoparquet(con, "park_lights", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
