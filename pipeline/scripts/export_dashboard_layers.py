#!/usr/bin/env python3
"""Slim the Council insights map layers for hosting (docs/DASHBOARD.md § Layers).

Reads the QA viewer exports in data/viewer/, keeps only the fields the
dashboard popups and styling use, simplifies area and line geometry, and
rounds coordinates. Writes data/viewer/dashboard/*.geojson, named to match
the web /api/map-data allowlist and the map-data GitHub release.

Usage (from pipeline/):
    python scripts/build_viewer_layers.py        # if viewer exports are missing
    python scripts/export_dashboard_layers.py
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd

from yourwalk_pipeline.paths import PIPELINE_ROOT

VIEWER_DIR = PIPELINE_ROOT / "data" / "viewer"
OUT_DIR = VIEWER_DIR / "dashboard"

# ~1–3 m at Casey latitudes; keeps shapes readable at street zoom
LAYERS: dict[str, dict] = {
    "streetlights.geojson": {
        "source": "streetlights.geojson",
        "fields": ["street_name", "suburb", "wattage_w", "provider"],
        "simplify": 0.0,
    },
    "park_lights.geojson": {
        "source": "park_lights.geojson",
        "fields": ["suburb", "location_type", "wattage_w"],
        "simplify": 0.0,
    },
    "tree_density.geojson": {
        "source": "tree_density.geojson",
        "fields": ["tree_density"],
        "simplify": 0.00003,
    },
    "urban_heat.geojson": {
        "source": "urban_heat.geojson",
        "fields": ["uhi18_m"],
        "simplify": 0.00003,
    },
    "speed_zones.geojson": {
        "source": "speed_zones.geojson",
        "fields": ["speed_limit_kmh", "road_name"],
        "simplify": 0.00002,
    },
    "school_crossings.geojson": {
        "source": "school_crossings.geojson",
        "fields": ["school_name", "street_name", "suburb"],
        "simplify": 0.0,
    },
}

COORD_DP = 6


def _round_coords(obj):
    if isinstance(obj, float):
        return round(obj, COORD_DP)
    if isinstance(obj, list):
        return [_round_coords(v) for v in obj]
    return obj


def export_layer(name: str, spec: dict) -> tuple[int, int]:
    src = VIEWER_DIR / spec["source"]
    if not src.exists():
        raise SystemExit(f"Missing {src}. Run: python scripts/build_viewer_layers.py")
    gdf = gpd.read_file(src).to_crs(4326)
    keep = [c for c in spec["fields"] if c in gdf.columns]
    gdf = gdf[keep + ["geometry"]].copy()
    if "uhi18_m" in gdf.columns:
        gdf["uhi18_m"] = gdf["uhi18_m"].round(1)
    if spec["simplify"]:
        gdf["geometry"] = gdf.geometry.simplify(spec["simplify"], preserve_topology=True)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]

    geo = json.loads(gdf.to_json(drop_id=True))
    for f in geo["features"]:
        f["geometry"]["coordinates"] = _round_coords(f["geometry"]["coordinates"])
        f["properties"] = {k: v for k, v in f["properties"].items() if v is not None}

    out = OUT_DIR / name
    out.write_text(json.dumps(geo, separators=(",", ":")), encoding="utf-8")
    return len(geo["features"]), out.stat().st_size


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, spec in LAYERS.items():
        before = (VIEWER_DIR / spec["source"]).stat().st_size
        count, size = export_layer(name, spec)
        print(f"{name:28} {count:>7,} features  {before / 1e6:5.1f} MB -> {size / 1e6:5.2f} MB")


if __name__ == "__main__":
    main()
