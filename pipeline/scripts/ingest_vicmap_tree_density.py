#!/usr/bin/env python3
"""Ingest Vicmap Vegetation Tree Density — primary Day Index canopy/shade layer.

Downloads tree density polygons (Dense / Medium / Sparse) for the Casey pilot
envelope via DEECA open-data WFS, clips to footpaths bounds, runs QA, exports
GeoParquet.

Vintage: 2019/2020 (source_begin_date / source_end_date on features).

Requires footpaths raw GeoJSON for pilot boundary envelope.

Usage:
    python scripts/ingest_vicmap_tree_density.py
    python scripts/ingest_vicmap_tree_density.py --force-download
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

import duckdb
import geopandas as gpd

from yourwalk_pipeline.export import export_geoparquet
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, RAW_DIR, ensure_data_dirs
from yourwalk_pipeline.qa_tree_density import AREA_QA_SQL, DENSITY_QA_SQL
from yourwalk_pipeline.vicmap_wfs import download_wfs_geojson

FOOTPATHS_RAW = RAW_DIR / "footpaths_ply_t1eam.geojson"
WFS_TYPE_NAME = "open-data-platform:tree_density"
DATASET_SLUG = "vicmap_tree_density_casey"
RAW_GEOJSON = RAW_DIR / f"{DATASET_SLUG}.geojson"
INTERMEDIATE_PARQUET = INTERMEDIATE_DIR / f"{DATASET_SLUG}.parquet"
QA_REPORT_JSON = QA_DIR / f"{DATASET_SLUG}_qa.json"
ENVELOPE_BUFFER_DEG = 0.004  # ~400 m at Casey latitude


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download WFS GeoJSON even if cached in data/raw/",
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
        CREATE OR REPLACE TABLE tree_density_raw AS
        SELECT
            ufi,
            feature_type,
            feature_subtype,
            lower(trim(tree_density)) AS tree_density,
            fire_mask,
            source_md_id,
            TRY_CAST(source_begin_date AS DATE) AS source_begin_date,
            TRY_CAST(source_end_date AS DATE) AS source_end_date,
            source_map_no,
            TRY_CAST(ufi_created AS DATE) AS ufi_created,
            NULL::DOUBLE AS area_m2,
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
        CREATE OR REPLACE TABLE tree_density AS
        SELECT
            *,
            {DENSITY_QA_SQL} AS density_qa_flag,
            {AREA_QA_SQL} AS area_qa_flag,
            {DENSITY_QA_SQL} AS qa_flag
        FROM tree_density_raw
        """
    )


def enrich_area_and_qa(parquet_path: Path) -> None:
    """DuckDB ST_Area returns NaN for Vicmap MultiPolygons — compute in geopandas."""
    gdf = gpd.read_parquet(parquet_path)
    gdf["area_m2"] = gdf.to_crs(7855).geometry.area
    gdf.to_parquet(parquet_path, index=False)


def tree_density_qa_summary(
    con: duckdb.DuckDBPyConnection,
    *,
    bbox: tuple[float, float, float, float],
    parquet_path: Path,
) -> dict:
    total = con.execute("SELECT COUNT(*) FROM tree_density").fetchone()[0]

    flag_counts = dict(
        con.execute(
            """
            SELECT qa_flag, COUNT(*) AS n FROM tree_density
            GROUP BY 1 ORDER BY 2 DESC
            """
        ).fetchall()
    )

    density_counts = dict(
        con.execute(
            """
            SELECT tree_density, COUNT(*) AS n FROM tree_density
            GROUP BY 1 ORDER BY 2 DESC
            """
        ).fetchall()
    )

    area_by_density = {
        str(k): float(v)
        for k, v in gpd.read_parquet(parquet_path)
        .groupby("tree_density")["area_m2"]
        .sum()
        .items()
    }

    source_dates = con.execute(
        """
        SELECT min(source_begin_date), max(source_end_date)
        FROM tree_density
        """
    ).fetchone()

    return {
        "dataset_id": DATASET_SLUG,
        "source_layer": WFS_TYPE_NAME,
        "source_url": "https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon",
        "ingested_at": datetime.now(UTC).isoformat(),
        "record_count": int(total),
        "bbox_wgs84": {
            "min_x": bbox[0],
            "min_y": bbox[1],
            "max_x": bbox[2],
            "max_y": bbox[3],
        },
        "qa_flags": {k: int(v) for k, v in flag_counts.items()},
        "tree_density_counts": {str(k): int(v) for k, v in density_counts.items()},
        "area_m2_by_density": {str(k): float(v) for k, v in area_by_density.items()},
        "source_date_range": {
            "begin": str(source_dates[0]) if source_dates[0] else None,
            "end": str(source_dates[1]) if source_dates[1] else None,
        },
        "methodology_version": "1.1",
        "scoring_role": "primary_canopy",
        "notes": (
            "Primary canopy/shade layer for Day Index Heat & Shade (40%). "
            "Classes: dense > medium > sparse for segment intersection weighting. "
            "2019/2020 vintage — document alongside 2018 urban heat in scoring output."
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

    print(f"Downloading {WFS_TYPE_NAME} via WFS …")
    download_wfs_geojson(WFS_TYPE_NAME, bbox, RAW_GEOJSON, force=args.force_download)
    print(f"  → {RAW_GEOJSON}")

    print("Loading into DuckDB and running QA …")
    build_intermediate(con)

    print("Exporting GeoParquet …")
    export_geoparquet(con, "tree_density", INTERMEDIATE_PARQUET)
    enrich_area_and_qa(INTERMEDIATE_PARQUET)
    print(f"  → {INTERMEDIATE_PARQUET}")

    qa_report = tree_density_qa_summary(con, bbox=bbox, parquet_path=INTERMEDIATE_PARQUET)
    QA_REPORT_JSON.write_text(json.dumps(qa_report, indent=2), encoding="utf-8")
    print(f"  → QA report: {QA_REPORT_JSON}")
    print(f"  → Records: {qa_report['record_count']:,}")
    print(f"  → Density classes: {qa_report['tree_density_counts']}")
    print(f"  → QA flags: {qa_report['qa_flags']}")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
