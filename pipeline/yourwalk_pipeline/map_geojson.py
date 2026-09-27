"""Build a lean map GeoJSON from segment_scores.parquet for CDN / Storage hosting.

Default: T1EAM **polygons** (source geometry). Lab paints them with Mapbox fill
like the Leaflet QA map — not derived centerlines.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd

MAP_COLUMNS = [
    "segment_id",
    "walk_path_class",
    "suburb",
    "ward",
    "street_name",
    "day_index_score",
    "night_index_score",
    "accessibility_score",
    "heat_shade_score",
    "lighting_after_dark_score",
    "score_lighting",
    "lighting_density_per_100m",
    "confidence_day",
    "confidence_night",
    "scoring_spec_version",
    "length_m",
    "geometry",
]

# ~2–3 m at Casey latitudes — keeps network shape, shrinks payload
SIMPLIFY_DEG = 0.000025


def _with_street_names(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Join cleaned street labels from the footpaths intermediate, if it has them."""
    import pandas as pd

    from yourwalk_pipeline.paths import INTERMEDIATE_DIR
    from yourwalk_pipeline.street_names import street_label

    src = INTERMEDIATE_DIR / "footpaths_ply_t1eam.parquet"
    if not src.exists():
        return gdf
    import pyarrow.parquet as pq

    if "asset_description" not in pq.read_schema(src).names:
        return gdf
    desc = pd.read_parquet(src, columns=["segment_id", "asset_description"])
    desc["street_name"] = desc["asset_description"].map(street_label)
    names = desc.set_index(desc["segment_id"].astype(str))["street_name"]
    gdf = gdf.copy()
    gdf["street_name"] = gdf["segment_id"].astype(str).map(names)
    return gdf


def build_map_geojson(
    parquet_path: Path,
    *,
    eligible_only: bool = True,
    simplify_deg: float = SIMPLIFY_DEG,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (FeatureCollection dict, meta dict) with polygon geometries."""
    gdf = gpd.read_parquet(parquet_path)
    if eligible_only and "score_eligible" in gdf.columns:
        gdf = gdf[gdf["score_eligible"].fillna(False)].copy()

    required = [
        "segment_id",
        "walk_path_class",
        "suburb",
        "day_index_score",
        "night_index_score",
        "accessibility_score",
        "confidence_day",
        "confidence_night",
        "scoring_spec_version",
        "geometry",
    ]
    missing = [c for c in required if c not in gdf.columns]
    if missing:
        raise ValueError(f"Parquet missing columns: {missing}")

    scored_at = None
    if "scored_at" in gdf.columns and gdf["scored_at"].notna().any():
        scored_at = str(gdf["scored_at"].dropna().iloc[0])

    if "street_name" not in gdf.columns:
        gdf = _with_street_names(gdf)

    keep = [c for c in MAP_COLUMNS if c in gdf.columns]
    gdf = gdf[keep].copy()
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    if simplify_deg and simplify_deg > 0:
        gdf["geometry"] = gdf.geometry.simplify(simplify_deg, preserve_topology=True)

    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()

    spec = None
    if len(gdf) and gdf["scoring_spec_version"].notna().any():
        spec = str(gdf["scoring_spec_version"].dropna().iloc[0])

    geo = json.loads(gdf.to_json())
    if geo.get("type") != "FeatureCollection":
        raise ValueError("Expected FeatureCollection from GeoDataFrame.to_json()")

    meta = {
        "feature_count": len(gdf),
        "scoring_spec_version": spec,
        "scored_at": scored_at,
        "methodology_version": "1.1",
        "eligible_only": eligible_only,
        "simplify_deg": simplify_deg,
        "geometry_kind": "Polygon",
        "built_at": datetime.now(UTC).isoformat(),
        "source": str(parquet_path.name),
    }
    return geo, meta


def write_map_geojson_files(
    parquet_path: Path,
    out_geojson: Path,
    out_gzip: Path | None = None,
    out_meta: Path | None = None,
) -> dict[str, Any]:
    """Write lean polygon GeoJSON (+ optional gzip and meta.json). Returns meta."""
    import gzip

    collection, meta = build_map_geojson(parquet_path)
    out_geojson.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(collection, separators=(",", ":")).encode("utf-8")
    out_geojson.write_bytes(payload)

    if out_gzip is not None:
        with gzip.open(out_gzip, "wb", compresslevel=6) as zf:
            zf.write(payload)
        meta["gzip_bytes"] = out_gzip.stat().st_size

    meta["geojson_bytes"] = out_geojson.stat().st_size
    if out_meta is not None:
        out_meta.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    return meta
