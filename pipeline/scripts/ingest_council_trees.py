#!/usr/bin/env python3
"""Ingest City of Casey Council Trees (T1EAM) — local tree inventory.

Council-owned tree assets for proximity and maturity context on the Day Index.
Primary canopy/shade scoring uses Vicmap Tree Density (separate ingest).

Portal canopy width fields (canopyewwidth_m, canopynswidth_m) are usually zero —
see QA report; do not use for canopy extent without a methodology change.

Usage:
    python scripts/ingest_council_trees.py
    python scripts/ingest_council_trees.py --force-download
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
from yourwalk_pipeline.qa_council_trees import AGE_QA_SQL, CANOPY_WIDTH_QA_SQL, HEIGHT_QA_SQL

DATASET_ID = "council_trees_pt_t1eam"
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
    raw = RAW_GEOJSON.as_posix()

    con.execute(
        f"""
        CREATE OR REPLACE TABLE council_trees_raw AS
        SELECT
            assetnumber AS asset_number,
            legacyassetnumber AS legacy_asset_number,
            treetype AS tree_type,
            shortdescription AS short_description,
            description,
            commonname AS common_name,
            botanicname AS botanic_name,
            familygenus AS family_genus,
            treeage AS tree_age,
            treehealth AS tree_health,
            TRY_CAST(treeheight_m AS DOUBLE) AS tree_height_m,
            TRY_CAST(diameterbreast_hcm AS DOUBLE) AS diameter_breast_height_cm,
            TRY_CAST(canopyewwidth_m AS DOUBLE) AS canopy_ew_width_m,
            TRY_CAST(canopynswidth_m AS DOUBLE) AS canopy_ns_width_m,
            suburb,
            ward,
            postcode,
            address,
            melwayref AS melway_ref,
            ownership,
            maintenancezone AS maintenance_zone,
            observedcondition AS observed_condition,
            geom
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE council_trees AS
        SELECT
            *,
            {CANOPY_WIDTH_QA_SQL} AS canopy_qa_flag,
            {HEIGHT_QA_SQL} AS height_qa_flag,
            {AGE_QA_SQL} AS age_qa_flag,
            CASE
                WHEN {HEIGHT_QA_SQL} != 'ok' THEN {HEIGHT_QA_SQL}
                WHEN {AGE_QA_SQL} NOT IN ('ok', 'placeholder_age') THEN {AGE_QA_SQL}
                ELSE 'ok'
            END AS qa_flag
        FROM council_trees_raw
        """
    )


def council_trees_qa_summary(con: duckdb.DuckDBPyConnection) -> dict:
    total = con.execute("SELECT COUNT(*) FROM council_trees").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n FROM council_trees
            GROUP BY 1 ORDER BY 2 DESC
            """
        ).fetchall()
    )

    canopy_flags = dict(
        con.execute(
            """
            SELECT canopy_qa_flag, COUNT(*) AS n FROM council_trees
            GROUP BY 1 ORDER BY 2 DESC
            """
        ).fetchall()
    )

    tree_types = dict(
        con.execute(
            """
            SELECT tree_type, COUNT(*) AS n FROM council_trees
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """
        ).fetchall()
    )

    tree_ages = dict(
        con.execute(
            """
            SELECT tree_age, COUNT(*) AS n FROM council_trees
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """
        ).fetchall()
    )

    height_stats = con.execute(
        """
        SELECT
            min(tree_height_m),
            max(tree_height_m),
            median(tree_height_m)
        FROM council_trees
        WHERE tree_height_m IS NOT NULL AND tree_height_m > 0
        """
    ).fetchone()

    return {
        "dataset_id": DATASET_ID,
        "source_url": f"https://data.casey.vic.gov.au/explore/dataset/{DATASET_ID}/",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "canopy_qa_flags": {k: int(v) for k, v in canopy_flags.items()},
        "tree_types_top": {str(k): int(v) for k, v in tree_types.items()},
        "tree_ages_top": {str(k): int(v) for k, v in tree_ages.items()},
        "tree_height_m_stats": {
            "min": height_stats[0],
            "max": height_stats[1],
            "median": height_stats[2],
        },
        "methodology_version": "1.1",
        "scoring_role": "enriching",
        "primary_canopy_source": "vicmap-vegetation-tree-density-polygon",
        "notes": (
            "Council-owned tree inventory for local proximity and maturity context "
            "on the Day Index. Canopy width asset fields are usually unpopulated — "
            "Vicmap Tree Density is the primary canopy/shade layer for scoring. "
            "Records with qa_flag != 'ok' are retained; placeholder age values are "
            "common in the asset system."
        ),
    }


def main() -> int:
    args = parse_args()
    ensure_data_dirs()

    print(f"Downloading {DATASET_ID} …")
    print("  (~200k records; download may take 2–3 minutes)")
    download_geojson_export(DATASET_ID, RAW_GEOJSON, force=args.force_download, timeout=600.0)
    print(f"  → {RAW_GEOJSON}")

    con = duckdb.connect()
    install_extensions(con)

    print("Loading into DuckDB and running QA …")
    build_intermediate(con)

    qa_report = council_trees_qa_summary(con)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → Canopy QA: {qa_report['canopy_qa_flags']}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "council_trees", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
