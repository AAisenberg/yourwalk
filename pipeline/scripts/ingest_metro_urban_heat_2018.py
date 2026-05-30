#!/usr/bin/env python3
"""Ingest Metropolitan Melbourne Urban Heat 2018 — Day Index heat exposure layer.

Downloads 2016 ABS mesh-block polygons with UHI18_M (urban heat island, °C above
non-urban baseline) for the Casey pilot envelope via Plan Melbourne ArcGIS REST.

Primary heat metric for Day Index Heat & Shade (40%). Pair with Vicmap Tree Density
(2019/2020) for shade. Document 2018 vintage in scoring output.

Requires footpaths raw GeoJSON for pilot boundary envelope.

Usage:
    python scripts/ingest_metro_urban_heat_2018.py
    python scripts/ingest_metro_urban_heat_2018.py --force-download
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

import duckdb

from yourwalk_pipeline.arcgis_rest import download_mapserver_geojson
from yourwalk_pipeline.export import export_geoparquet
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, RAW_DIR, ensure_data_dirs
from yourwalk_pipeline.qa_urban_heat import UHI_QA_SQL

FOOTPATHS_RAW = RAW_DIR / "footpaths_ply_t1eam.geojson"
UHI_LAYER_URL = (
    "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/"
    "Radius/Vegetation_and_heat_mapping/MapServer/6"
)
DATASET_SLUG = "metro_urban_heat_2018_casey"
RAW_GEOJSON = RAW_DIR / f"{DATASET_SLUG}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_SLUG}.parquet"
QA_REPORT_JSON = QA_DIR / f"{DATASET_SLUG}_qa.json"
ENVELOPE_BUFFER_DEG = 0.004

OUT_FIELDS = (
    "MB_CODE16,SA1_MAIN16,SA2_NAME16,LGA,"
    "UHI18_M,PERANYVEG,PERANYTREE,PERGRASS,PERSHRUB"
)


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


def require_footpaths() -> None:
    if not FOOTPATHS_RAW.exists():
        raise SystemExit(
            f"Footpaths raw file required for Casey clip envelope: {FOOTPATHS_RAW}\n"
            "Run: python scripts/ingest_footpaths_t1eam.py"
        )


def casey_bbox(con: duckdb.DuckDBPyConnection) -> tuple[float, float, float, float]:
    footpaths = FOOTPATHS_RAW.as_posix()
    row = con.execute(
        f"""
        SELECT
            ST_XMin(ST_Expand(ST_Envelope(ST_Union_Agg(geom)), {ENVELOPE_BUFFER_DEG})),
            ST_YMin(ST_Expand(ST_Envelope(ST_Union_Agg(geom)), {ENVELOPE_BUFFER_DEG})),
            ST_XMax(ST_Expand(ST_Envelope(ST_Union_Agg(geom)), {ENVELOPE_BUFFER_DEG})),
            ST_YMax(ST_Expand(ST_Envelope(ST_Union_Agg(geom)), {ENVELOPE_BUFFER_DEG}))
        FROM ST_Read('{footpaths}')
        WHERE geom IS NOT NULL
        """
    ).fetchone()
    return (float(row[0]), float(row[1]), float(row[2]), float(row[3]))


def build_intermediate(con: duckdb.DuckDBPyConnection) -> None:
    raw = RAW_GEOJSON.as_posix()
    footpaths = FOOTPATHS_RAW.as_posix()

    con.execute(
        f"""
        CREATE OR REPLACE TABLE casey_envelope AS
        SELECT ST_Expand(ST_Envelope(ST_Union_Agg(geom)), {ENVELOPE_BUFFER_DEG}) AS bounds
        FROM ST_Read('{footpaths}')
        WHERE geom IS NOT NULL
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE urban_heat_raw AS
        SELECT
            MB_CODE16 AS mesh_block_code,
            SA1_MAIN16 AS sa1_code,
            SA2_NAME16 AS sa2_name,
            LGA AS lga,
            TRY_CAST(UHI18_M AS DOUBLE) AS uhi18_m,
            TRY_CAST(PERANYVEG AS DOUBLE) AS per_any_veg,
            TRY_CAST(PERANYTREE AS DOUBLE) AS per_any_tree,
            TRY_CAST(PERGRASS AS DOUBLE) AS per_grass,
            TRY_CAST(PERSHRUB AS DOUBLE) AS per_shrub,
            ST_Transform(geom, 'EPSG:4326') AS geom
        FROM ST_Read('{raw}')
        WHERE geom IS NOT NULL
        AND ST_Intersects(
            ST_Transform(geom, 'EPSG:4326'),
            (SELECT bounds FROM casey_envelope)
        )
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE urban_heat AS
        SELECT
            *,
            {UHI_QA_SQL} AS qa_flag
        FROM urban_heat_raw
        """
    )


def urban_heat_qa_summary(
    con: duckdb.DuckDBPyConnection,
    *,
    bbox: tuple[float, float, float, float],
) -> dict:
    total = con.execute("SELECT COUNT(*) FROM urban_heat").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n FROM urban_heat
            GROUP BY 1 ORDER BY 2 DESC
            """
        ).fetchall()
    )

    lga_counts = dict(
        con.execute(
            """
            SELECT COALESCE(lga, '(null)') AS lga, COUNT(*) AS n
            FROM urban_heat
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5
            """
        ).fetchall()
    )

    uhi_stats = con.execute(
        """
        SELECT min(uhi18_m), max(uhi18_m), median(uhi18_m), avg(uhi18_m)
        FROM urban_heat
        WHERE uhi18_m IS NOT NULL
        """
    ).fetchone()

    casey_lga_count = con.execute(
        """
        SELECT COUNT(*) FROM urban_heat
        WHERE lga ILIKE '%Casey%'
        """
    ).fetchone()[0]

    return {
        "dataset_id": DATASET_SLUG,
        "source_layer": "Radius/Vegetation_and_heat_mapping/MapServer/6",
        "source_url": (
            "https://discover.data.vic.gov.au/dataset/"
            "metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018"
        ),
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "casey_lga_record_count": int(casey_lga_count),
        "bbox_wgs84": {
            "min_x": bbox[0],
            "min_y": bbox[1],
            "max_x": bbox[2],
            "max_y": bbox[3],
        },
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "lga_top": {str(k): int(v) for k, v in lga_counts.items()},
        "uhi18_m_stats": {
            "min": uhi_stats[0],
            "max": uhi_stats[1],
            "median": uhi_stats[2],
            "mean": uhi_stats[3],
        },
        "vintage": "2018",
        "capture_note": "Landsat-8 LST, summer orbits, ~10:50 AM; UHI = °C above non-urban baseline",
        "methodology_version": "1.1",
        "scoring_role": "primary_heat",
        "scoring_field": "uhi18_m",
        "scoring_direction": "lower_is_better",
        "notes": (
            "Mesh-block polygons (2016 ABS geography). UHI18_M is urban heat island "
            "intensity (not absolute LST). Segment join: sample mesh block at footpath "
            "centroid or length-weighted intersection. Document 2018 vintage alongside "
            "2019/2020 Vicmap canopy in scoring output."
        ),
    }


def main() -> int:
    args = parse_args()
    ensure_data_dirs()
    require_footpaths()

    con = duckdb.connect()
    install_extensions(con)

    bbox = casey_bbox(con)
    print(f"Casey pilot bbox (WGS84, +{ENVELOPE_BUFFER_DEG}° buffer): {bbox}")

    print("Downloading Urban Heat (UHI) 2018 via ArcGIS REST …")
    download_mapserver_geojson(
        UHI_LAYER_URL,
        RAW_GEOJSON,
        geometry=bbox,
        out_fields=OUT_FIELDS,
        force=args.force_download,
    )
    print(f"  → {RAW_GEOJSON}")

    print("Loading into DuckDB and running QA …")
    build_intermediate(con)

    qa_report = urban_heat_qa_summary(con, bbox=bbox)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,} ({qa_report['casey_lga_record_count']:,} in Casey LGA)")
    print(f"  → UHI18_M: min={qa_report['uhi18_m_stats']['min']:.2f}, "
          f"max={qa_report['uhi18_m_stats']['max']:.2f}, "
          f"median={qa_report['uhi18_m_stats']['median']:.2f}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    print("Exporting GeoParquet …")
    export_geoparquet(con, "urban_heat", INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
