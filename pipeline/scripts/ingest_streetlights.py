#!/usr/bin/env python3
"""Ingest AusNet / United Energy street lights — primary Night Index lighting source.

Downloads from Casey Open Data, loads into DuckDB, runs wattage/duplicate QA,
exports GeoParquet.

Usage:
    python scripts/ingest_streetlights.py
    python scripts/ingest_streetlights.py --force-download
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
from yourwalk_pipeline.qa_lights import WATTAGE_QA_SQL

DATASET_ID = "ausnet_unitedenergy_mvp4_streetlights"
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
        CREATE OR REPLACE TABLE streetlights_raw AS
        SELECT
            lightid AS light_id,
            gisfid,
            type AS globe_type,
            usage AS globe_usage,
            rating AS wattage_w,
            electricity_provider AS provider,
            extracted AS source_extracted_date,
            suburb,
            ward,
            postcode,
            address,
            strname AS street_name,
            geom,
            {WATTAGE_QA_SQL} AS wattage_qa_flag
        FROM ST_Read('{RAW_GEOJSON.as_posix()}')
        WHERE geom IS NOT NULL
        """
    )

    con.execute(
        """
        CREATE OR REPLACE TABLE streetlights AS
        SELECT
            *,
            CASE
                WHEN COUNT(*) OVER (PARTITION BY light_id) > 1 THEN 'duplicate_light_id'
                ELSE wattage_qa_flag
            END AS qa_flag
        FROM streetlights_raw
        """
    )


def lights_qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM streetlights").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n
            FROM streetlights
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    provider_counts = dict(
        con.execute(
            """
            SELECT provider, COUNT(*) AS n
            FROM streetlights
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    globe_counts = dict(
        con.execute(
            """
            SELECT globe_type, COUNT(*) AS n
            FROM streetlights
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 15
            """
        ).fetchall()
    )

    outlier_rows = con.execute(
        """
        SELECT
            light_id,
            wattage_w,
            qa_flag,
            globe_type,
            provider,
            suburb,
            street_name
        FROM streetlights
        WHERE qa_flag != 'ok'
        ORDER BY
            CASE qa_flag
                WHEN 'duplicate_light_id' THEN 1
                WHEN 'high_wattage' THEN 2
                WHEN 'zero_wattage' THEN 3
                WHEN 'missing_wattage' THEN 4
                ELSE 5
            END,
            wattage_w DESC NULLS LAST
        LIMIT 50
        """
    ).fetchall()

    columns = [
        "light_id",
        "wattage_w",
        "qa_flag",
        "globe_type",
        "provider",
        "suburb",
        "street_name",
    ]
    outliers = [dict(zip(columns, row, strict=True)) for row in outlier_rows]

    extract_dates = con.execute(
        """
        SELECT source_extracted_date, COUNT(*) AS n
        FROM streetlights
        GROUP BY 1
        ORDER BY 1
        """
    ).fetchall()

    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "providers": {k: int(v) for k, v in provider_counts.items()},
        "globe_types_top": {k: int(v) for k, v in globe_counts.items()},
        "source_extracted_dates": {str(k): int(v) for k, v in extract_dates},
        "qa_sample_outliers": outliers,
        "methodology_version": "1.1",
        "notes": (
            "Point assets for Night Index lighting coverage. No lux measurements in "
            "source data — wattage and globe type are proxies only. Assets with "
            "qa_flag != 'ok' are retained with reduced confidence."
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

    qa_report = lights_qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "streetlights", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
