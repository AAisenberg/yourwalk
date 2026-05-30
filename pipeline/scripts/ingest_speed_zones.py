#!/usr/bin/env python3
"""Ingest Transport Victoria Speed Zones — Accessibility stream (shared 60%).

Downloads Victoria-wide GeoJSON, clips to City of Casey, runs speed/limit QA,
exports GeoParquet.

Requires footpaths raw GeoJSON for pilot boundary envelope (run ingest_footpaths
first, or ensure data/raw/footpaths_ply_t1eam.geojson exists).

Usage:
    python scripts/ingest_speed_zones.py
    python scripts/ingest_speed_zones.py --force-download
    python scripts/ingest_speed_zones.py --vintage 2026-02
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

import duckdb

from yourwalk_pipeline.download import download_file
from yourwalk_pipeline.export import export_geoparquet
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, RAW_DIR, ensure_data_dirs
from yourwalk_pipeline.qa_speed import SPEED_LIMIT_QA_SQL, ZONE_LENGTH_QA_SQL

FOOTPATHS_RAW = RAW_DIR / "footpaths_ply_t1eam.geojson"

# CKAN resource URLs (monthly Victoria-wide extracts, CC-BY 4.0)
VINTAGE_URLS: dict[str, str] = {
    "2026-04": (
        "https://opendata.transport.vic.gov.au/dataset/975b80b9-e530-46e2-80a5-54002765e81a"
        "/resource/a91ebf54-80e1-462f-a4e9-c320e61c34af/download/speed_zones_april_2026.geojson"
    ),
    "2026-02": (
        "https://opendata.transport.vic.gov.au/dataset/975b80b9-e530-46e2-80a5-54002765e81a"
        "/resource/631bc6ee-099e-4309-9d62-83014999dbb3/download/speed_zones_february_2026.geojson"
    ),
}
DEFAULT_VINTAGE = "2026-04"


def paths_for_vintage(vintage: str) -> tuple[Path, Path, Path]:
    raw = RAW_DIR / f"speed_zones_victoria_{vintage}.geojson"
    parquet = INTERMEDIATE_DIR / f"speed_zones_casey_{vintage}.parquet"
    qa = QA_DIR / f"speed_zones_casey_{vintage}_qa.json"
    return raw, parquet, qa


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download Victoria GeoJSON even if cached",
    )
    parser.add_argument(
        "--vintage",
        choices=sorted(VINTAGE_URLS),
        default=DEFAULT_VINTAGE,
        help=f"Dataset vintage month (default: {DEFAULT_VINTAGE})",
    )
    return parser.parse_args()


def install_extensions(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL spatial; LOAD spatial;")


def require_footpaths() -> None:
    if not FOOTPATHS_RAW.exists():
        raise SystemExit(
            f"Footpaths raw file required for Casey clip envelope: {FOOTPATHS_RAW}\n"
            "Run: python scripts/ingest_footpaths_t1eam.py"
        )


def build_intermediate(con: duckdb.DuckDBPyConnection, raw_vic: Path) -> None:
    footpaths = FOOTPATHS_RAW.as_posix()
    raw = raw_vic.as_posix()

    con.execute(
        f"""
        CREATE OR REPLACE TABLE casey_envelope AS
        SELECT ST_Envelope(ST_Union_Agg(geom)) AS bounds
        FROM ST_Read('{footpaths}')
        WHERE geom IS NOT NULL
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE speed_zones_raw AS
        SELECT
            id AS zone_id,
            TRY_CAST(speed_limit AS INTEGER) AS speed_limit_kmh,
            zone_length AS zone_length_m,
            zone_conditions,
            zone_conditions_other,
            direction AS travel_direction,
            road_name,
            road_type,
            suburbs,
            array_to_string(lgas, ', ') AS lga,
            regions,
            postcodes,
            state_electorates,
            speed_zone_change_request_id,
            speed_zone_change_request_status,
            geom
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        AND ST_Intersects(
            geom,
            (SELECT ST_Expand(bounds, 0.004) FROM casey_envelope)
        )
        AND (
            lgas IS NULL
            OR len(list_filter(lgas, x -> x ILIKE '%Casey%')) > 0
        )
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE speed_zones AS
        SELECT
            *,
            {SPEED_LIMIT_QA_SQL} AS speed_qa_flag,
            {ZONE_LENGTH_QA_SQL} AS length_qa_flag,
            CASE
                WHEN {SPEED_LIMIT_QA_SQL} != 'ok' THEN {SPEED_LIMIT_QA_SQL}
                WHEN {ZONE_LENGTH_QA_SQL} != 'ok' THEN {ZONE_LENGTH_QA_SQL}
                ELSE 'ok'
            END AS qa_flag
        FROM speed_zones_raw
        """
    )


def speed_qa_summary(
    con: duckdb.DuckDBPyConnection,
    *,
    vintage: str,
    raw_vic: Path,
) -> dict:
    total = con.execute("SELECT COUNT(*) FROM speed_zones").fetchone()[0]
    vic_total = con.execute(
        f"SELECT COUNT(*) FROM ST_Read('{raw_vic.as_posix()}')"
    ).fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n
            FROM speed_zones
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    speed_limit_counts = dict(
        con.execute(
            """
            SELECT speed_limit_kmh, COUNT(*) AS n
            FROM speed_zones
            GROUP BY 1
            ORDER BY 1
            """
        ).fetchall()
    )

    lga_counts = dict(
        con.execute(
            """
            SELECT COALESCE(lga, '(null)') AS lga, COUNT(*) AS n
            FROM speed_zones
            GROUP BY 1
            ORDER BY 2 DESC
            """
        ).fetchall()
    )

    outlier_rows = con.execute(
        """
        SELECT
            zone_id,
            speed_limit_kmh,
            zone_length_m,
            qa_flag,
            road_name,
            road_type,
            lga,
            travel_direction
        FROM speed_zones
        WHERE qa_flag != 'ok'
        ORDER BY speed_limit_kmh DESC NULLS LAST
        LIMIT 50
        """
    ).fetchall()

    columns = [
        "zone_id",
        "speed_limit_kmh",
        "zone_length_m",
        "qa_flag",
        "road_name",
        "road_type",
        "lga",
        "travel_direction",
    ]
    outliers = [dict(zip(columns, row, strict=True)) for row in outlier_rows]

    return {
        "dataset_id": "speed-zones",
        "vintage": vintage,
        "source_url": VINTAGE_URLS[vintage],
        "data_vic_page": "https://discover.data.vic.gov.au/dataset/speed-zones",
        "ingested_at": datetime.now(UTC).isoformat(),
        "victoria_record_count": int(vic_total),
        "casey_record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "speed_limit_distribution": {str(k): int(v) for k, v in speed_limit_counts.items()},
        "lga_values": {str(k): int(v) for k, v in lga_counts.items()},
        "qa_sample_outliers": outliers,
        "methodology_version": "1.1",
        "notes": (
            "Clipped to City of Casey pilot area: footpaths envelope + ~400 m buffer, "
            "including segments tagged Casey (C) or with null LGA. Segments with a "
            "non-Casey LGA tag are excluded. Speed limit is the lowest value for the "
            "24-hour period per DTP documentation. Used for traffic stress in the "
            "shared Accessibility stream."
        ),
    }


def main() -> int:
    args = parse_args()
    ensure_data_dirs()
    require_footpaths()

    raw_vic, intermediate_parquet, qa_report_json = paths_for_vintage(args.vintage)
    url = VINTAGE_URLS[args.vintage]

    print(f"Downloading speed zones Victoria ({args.vintage}) …")
    print(f"  Source: {url}")
    print("  (Victoria-wide file ~500–670 MB; may take several minutes)")
    download_file(url, raw_vic, force=args.force_download)
    print(f"  → {raw_vic}")

    con = duckdb.connect()
    install_extensions(con)

    print("Clipping to City of Casey and running QA …")
    build_intermediate(con, raw_vic)

    qa_report = speed_qa_summary(con, vintage=args.vintage, raw_vic=raw_vic)
    qa_report_json.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {qa_report_json}")
    print(
        f"  → Casey segments: {qa_report['casey_record_count']:,} "
        f"(of {qa_report['victoria_record_count']:,} Victoria-wide)"
    )
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "speed_zones", intermediate_parquet)
    print(f"  → {intermediate_parquet}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
