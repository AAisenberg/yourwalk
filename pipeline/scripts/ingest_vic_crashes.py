#!/usr/bin/env python3
"""Ingest Victoria Road Crash Data — Casey pedestrian crashes for Night Index.

Downloads Transport Victoria CSV, filters to City of Casey with pedestrian
involvement, tags light condition for day/night scoring, exports GeoParquet.

Segment snapping and crash density scoring are deferred to the scoring stage.

Field mapping reference: CrashDash etl/vic/VIC_FIELD_MAPPING_VERIFICATION.md

Usage:
    python scripts/ingest_vic_crashes.py
    python scripts/ingest_vic_crashes.py --force-download
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

import duckdb

from yourwalk_pipeline.crash_light import LIGHT_CATEGORY_SQL, NIGHT_INDEX_LIGHT_CATEGORIES
from yourwalk_pipeline.download import download_file
from yourwalk_pipeline.export import export_geoparquet
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, RAW_DIR, ensure_data_dirs
from yourwalk_pipeline.qa_crash import COORD_QA_SQL, DATE_QA_SQL, LIGHT_QA_SQL

VIC_CRASH_CSV_URL = (
    "https://opendata.transport.vic.gov.au/dataset/bb77800e-1857-4edc-bf9e-e188437a1c8e"
    "/resource/5df1f373-0c90-48f5-80e1-7b2a35507134/download/victorian_road_crash_data.csv"
)
CASEY_LGA = "CASEY"
RAW_CSV = RAW_DIR / "victorian_road_crash_data.csv"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / "vic_crashes_casey_pedestrian.parquet"
QA_REPORT_JSON = QA_DIR / "vic_crashes_casey_pedestrian_qa.json"

NIGHT_INDEX_CATEGORIES_SQL = ", ".join(f"'{c}'" for c in NIGHT_INDEX_LIGHT_CATEGORIES)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download CSV even if cached in data/raw/",
    )
    return parser.parse_args()


def install_extensions(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL spatial; LOAD spatial;")


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    csv_path = RAW_CSV.as_posix()
    light_cat = LIGHT_CATEGORY_SQL.replace("light_condition", "LIGHT_CONDITION")

    con.execute(
        f"""
        CREATE OR REPLACE TABLE vic_crashes_casey_raw AS
        SELECT
            ACCIDENT_NO AS crash_id,
            TRY_CAST(ACCIDENT_DATE AS DATE) AS crash_date,
            ACCIDENT_TIME AS crash_time,
            ACCIDENT_TYPE AS crash_type,
            LIGHT_CONDITION AS light_condition,
            {light_cat} AS light_category,
            SEVERITY AS severity_raw,
            CASE upper(trim(SEVERITY))
                WHEN 'FATAL ACCIDENT' THEN 'fatal'
                WHEN 'SERIOUS INJURY ACCIDENT' THEN 'serious'
                WHEN 'OTHER INJURY ACCIDENT' THEN 'minor'
                WHEN 'NON INJURY ACCIDENT' THEN 'no_injury'
                ELSE lower(trim(SEVERITY))
            END AS injury_severity,
            SPEED_ZONE AS speed_zone_raw,
            TRY_CAST(
                NULLIF(regexp_replace(SPEED_ZONE, '[^0-9]', '', 'g'), '')
                AS INTEGER
            ) AS road_speed_limit_kmh,
            ROAD_NAME AS road_name,
            ROAD_TYPE AS road_type,
            ROAD_GEOMETRY AS road_geometry,
            LGA_NAME AS lga_name,
            DTP_REGION AS dtp_region,
            TRY_CAST(LATITUDE AS DOUBLE) AS latitude,
            TRY_CAST(LONGITUDE AS DOUBLE) AS longitude,
            COALESCE(TRY_CAST(PEDESTRIAN AS INTEGER), 0) AS pedestrian_count,
            COALESCE(TRY_CAST(FATALITY AS INTEGER), 0) AS fatality_count,
            COALESCE(TRY_CAST(SERIOUSINJURY AS INTEGER), 0) AS serious_injury_count,
            COALESCE(TRY_CAST(OTHERINJURY AS INTEGER), 0) AS other_injury_count,
            COALESCE(TRY_CAST(TOTAL_PERSONS AS INTEGER), 0) AS total_persons,
            COALESCE(TRY_CAST(NO_OF_VEHICLES AS INTEGER), 0) AS vehicle_count,
            DCA_CODE AS dca_code,
            DCA_CODE_DESCRIPTION AS dca_description,
            RMA AS road_management_authority,
            ST_Point(
                TRY_CAST(LONGITUDE AS DOUBLE),
                TRY_CAST(LATITUDE AS DOUBLE)
            ) AS geom
        FROM read_csv(
            '{csv_path}',
            header = true,
            ignore_errors = true
        )
        WHERE upper(trim(LGA_NAME)) = '{CASEY_LGA}'
          AND COALESCE(TRY_CAST(PEDESTRIAN AS INTEGER), 0) > 0
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE vic_crashes_casey AS
        SELECT
            *,
            {COORD_QA_SQL} AS coord_qa_flag,
            {LIGHT_QA_SQL} AS light_qa_flag,
            {DATE_QA_SQL} AS date_qa_flag,
            light_category IN ({NIGHT_INDEX_CATEGORIES_SQL}) AS night_index_eligible,
            CASE
                WHEN {COORD_QA_SQL} != 'ok' THEN {COORD_QA_SQL}
                WHEN {DATE_QA_SQL} != 'ok' THEN {DATE_QA_SQL}
                WHEN {LIGHT_QA_SQL} != 'ok' THEN {LIGHT_QA_SQL}
                ELSE 'ok'
            END AS qa_flag
        FROM vic_crashes_casey_raw
        """
    )


def crash_qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM vic_crashes_casey").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n
            FROM vic_crashes_casey
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    light_categories = dict(
        con.execute(
            """
            SELECT light_category, COUNT(*) AS n
            FROM vic_crashes_casey
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    severity_counts = dict(
        con.execute(
            """
            SELECT injury_severity, COUNT(*) AS n
            FROM vic_crashes_casey
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    night_eligible = con.execute(
        "SELECT COUNT(*) FROM vic_crashes_casey WHERE night_index_eligible"
    ).fetchone()[0]

    date_range = con.execute(
        """
        SELECT MIN(crash_date), MAX(crash_date)
        FROM vic_crashes_casey
        WHERE crash_date IS NOT NULL
        """
    ).fetchone()

    year_counts = dict(
        con.execute(
            """
            SELECT EXTRACT(YEAR FROM crash_date)::INTEGER AS yr, COUNT(*) AS n
            FROM vic_crashes_casey
            WHERE crash_date IS NOT NULL
            GROUP BY 1
            ORDER BY 1
            """
        ).fetchall()
    )

    raw_light_values = dict(
        con.execute(
            """
            SELECT light_condition, COUNT(*) AS n
            FROM vic_crashes_casey
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 20
            """
        ).fetchall()
    )

    outlier_rows = con.execute(
        """
        SELECT
            crash_id,
            crash_date,
            crash_time,
            light_condition,
            light_category,
            injury_severity,
            qa_flag,
            road_name
        FROM vic_crashes_casey
        WHERE qa_flag != 'ok'
        ORDER BY crash_date DESC NULLS LAST
        LIMIT 50
        """
    ).fetchall()

    outliers = [
        {
            "crash_id": row[0],
            "crash_date": str(row[1]) if row[1] is not None else None,
            "crash_time": str(row[2]) if row[2] is not None else None,
            "light_condition": row[3],
            "light_category": row[4],
            "injury_severity": row[5],
            "qa_flag": row[6],
            "road_name": row[7],
        }
        for row in outlier_rows
    ]

    return {
        "dataset_id": "victoria-road-crash-data",
        "source_url": VIC_CRASH_CSV_URL,
        "data_vic_page": "https://discover.data.vic.gov.au/dataset/victoria-road-crash-data",
        "ingested_at": datetime.now(UTC).isoformat(),
        "filter": {
            "lga_name": CASEY_LGA,
            "pedestrian_count_gt": 0,
        },
        "record_count": int(total),
        "night_index_eligible_count": int(night_eligible),
        "crash_date_range": {
            "min": str(date_range[0]) if date_range[0] else None,
            "max": str(date_range[1]) if date_range[1] else None,
        },
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "light_categories": {str(k): int(v) for k, v in light_categories.items()},
        "injury_severity": {str(k): int(v) for k, v in severity_counts.items()},
        "records_by_year": {str(k): int(v) for k, v in year_counts.items()},
        "raw_light_condition_top": {str(k): int(v) for k, v in raw_light_values.items()},
        "qa_sample_outliers": outliers,
        "methodology_version": "1.1",
        "notes": (
            "Pedestrian-involved crashes in City of Casey only. Night Index scoring "
            f"uses records where light_category is {list(NIGHT_INDEX_LIGHT_CATEGORIES)} "
            "(night_index_eligible=true). Daylight and dawn_dusk retained for context "
            "and future methodology review. Segment snapping deferred to scoring stage. "
            "Casualty counts from main crash CSV (PEDESTRIAN field), not person.csv."
        ),
    }


def main() -> int:
    args = parse_args()
    ensure_data_dirs()

    print("Downloading Victoria Road Crash Data CSV …")
    print(f"  Source: {VIC_CRASH_CSV_URL}")
    download_file(VIC_CRASH_CSV_URL, RAW_CSV, force=args.force_download)
    print(f"  → {RAW_CSV}")

    con = duckdb.connect()
    install_extensions(con)

    print("Filtering to Casey pedestrian crashes and running QA …")
    build_intermediate(con)

    qa_report = crash_qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → Night Index eligible: {qa_report['night_index_eligible_count']:,}")
    print(f"  → Light categories: {qa_report['light_categories']}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "vic_crashes_casey", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
