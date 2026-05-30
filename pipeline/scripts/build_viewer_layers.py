#!/usr/bin/env python3
"""Export lightweight GeoJSON layers for the local pipeline QA map viewer.

Reads ingested GeoParquet from data/intermediate/, simplifies geometry where
needed, samples very large point layers, writes to data/viewer/.

Usage:
    python scripts/build_viewer_layers.py
    python scripts/build_viewer_layers.py --force
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd

from yourwalk_pipeline.paths import INTERMEDIATE_DIR, PIPELINE_ROOT

VIEWER_DIR = PIPELINE_ROOT / "data" / "viewer"
MANIFEST_PATH = VIEWER_DIR / "layers.json"

# Casey pilot home view (from footpaths envelope + buffer).
CASEY_BOUNDS = {
    "south": -38.231,
    "west": 145.215,
    "north": -37.950,
    "east": 145.410,
}


def layer_spec(
    layer_id: str,
    name: str,
    parquet: str,
    *,
    stream: str,
    geometry: str,
    color: str,
    popup_fields: list[str],
    default_on: bool = False,
    cluster: bool = False,
    simplify: float | None = None,
    sample: int | None = None,
    fill_opacity: float = 0.35,
    weight: int = 2,
) -> dict:
    return {
        "id": layer_id,
        "name": name,
        "parquet": parquet,
        "stream": stream,
        "geometry": geometry,
        "color": color,
        "popup_fields": popup_fields,
        "default_on": default_on,
        "cluster": cluster,
        "simplify": simplify,
        "sample": sample,
        "fill_opacity": fill_opacity,
        "weight": weight,
    }


LAYER_SPECS = [
    layer_spec(
        "footpaths",
        "Footpaths (T1EAM)",
        "footpaths_ply_t1eam.parquet",
        stream="Segment network",
        geometry="polygon",
        color="#2563eb",
        popup_fields=["segment_id", "surface_material", "width_m", "length_m", "suburb"],
        default_on=True,
        simplify=0.00003,
        fill_opacity=0.15,
    ),
    layer_spec(
        "speed_zones",
        "Speed zones (Casey)",
        "speed_zones_casey_2026-02.parquet",
        stream="Accessibility",
        geometry="line",
        color="#dc2626",
        popup_fields=["speed_limit_kmh", "road_name", "zone_length_m", "lga"],
        simplify=0.00002,
        fill_opacity=0.0,
        weight=3,
    ),
    layer_spec(
        "urban_heat",
        "Urban heat 2018 (UHI)",
        "metro_urban_heat_2018_casey.parquet",
        stream="Day Index — heat",
        geometry="polygon",
        color="#ea580c",
        popup_fields=["uhi18_m", "mesh_block_code", "lga", "per_any_veg"],
        simplify=0.00008,
        fill_opacity=0.45,
    ),
    layer_spec(
        "tree_density",
        "Tree density (Vicmap)",
        "vicmap_tree_density_casey.parquet",
        stream="Day Index — canopy",
        geometry="polygon",
        color="#16a34a",
        popup_fields=["tree_density", "area_m2"],
        simplify=0.00008,
        fill_opacity=0.35,
    ),
    layer_spec(
        "streetlights",
        "Street lights (AusNet/UE)",
        "ausnet_unitedenergy_mvp4_streetlights.parquet",
        stream="Night Index",
        geometry="point",
        color="#facc15",
        popup_fields=["wattage_w", "globe_type", "provider", "suburb", "street_name"],
        cluster=True,
    ),
    layer_spec(
        "park_lights",
        "Park / reserve lights",
        "parkreserve_light_pt_t1eam.parquet",
        stream="Night Index",
        geometry="point",
        color="#fde047",
        popup_fields=["wattage_w", "luminaire_type", "location_type", "suburb"],
        cluster=True,
    ),
    layer_spec(
        "crashes",
        "Pedestrian crashes (Casey)",
        "vic_crashes_casey_pedestrian.parquet",
        stream="Night Index",
        geometry="point",
        color="#7c3aed",
        popup_fields=["crash_date", "light_category", "injury_severity", "road_name"],
        default_on=True,
    ),
    layer_spec(
        "graffiti",
        "Graffiti locations",
        "graffiti-locations.parquet",
        stream="Accessibility",
        geometry="point",
        color="#ec4899",
        popup_fields=["graffiti_type", "suburb", "created_date", "days_to_remove"],
        cluster=True,
    ),
    layer_spec(
        "council_trees",
        "Council trees (sample)",
        "council_trees_pt_t1eam.parquet",
        stream="Day Index",
        geometry="point",
        color="#15803d",
        popup_fields=["tree_type", "tree_age", "tree_height_m", "suburb"],
        cluster=True,
        sample=8000,
    ),
    layer_spec(
        "fountains",
        "Drinking fountains",
        "drinkingfountains_pt_t1eam.parquet",
        stream="Day Index — comfort",
        geometry="point",
        color="#0891b2",
        popup_fields=["fountain_type", "condition", "suburb", "park_reserve_name"],
    ),
    layer_spec(
        "benches",
        "Benches & seats",
        "benches_seats_pt_t1eam.parquet",
        stream="Day Index — comfort",
        geometry="point",
        color="#92400e",
        popup_fields=["amenity_type", "suburb", "reserve_name"],
        cluster=True,
    ),
    layer_spec(
        "school_crossings",
        "School crossings",
        "school_crossings_pt_t1eam.parquet",
        stream="Accessibility",
        geometry="point",
        color="#4f46e5",
        popup_fields=["school_name", "street_name", "suburb"],
        default_on=True,
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild all GeoJSON files even if they exist",
    )
    return parser.parse_args()


def export_layer(spec: dict, *, force: bool) -> dict | None:
    parquet_path = INTERMEDIATE_DIR / spec["parquet"]
    if not parquet_path.exists():
        print(f"  skip {spec['id']}: missing {parquet_path.name}")
        return None

    output = VIEWER_DIR / f"{spec['id']}.geojson"
    if output.exists() and not force:
        print(f"  reuse {spec['id']} → {output.name}")
        return {k: v for k, v in spec.items() if k != "parquet"} | {"file": f"data/viewer/{output.name}"}

    print(f"  build {spec['id']} …")
    gdf = gpd.read_parquet(parquet_path)
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    else:
        gdf = gdf.to_crs(4326)

    if spec.get("sample") and len(gdf) > spec["sample"]:
        gdf = gdf.sample(spec["sample"], random_state=42)

    simplify = spec.get("simplify")
    if simplify:
        gdf = gdf.copy()
        gdf["geometry"] = gdf.geometry.simplify(simplify, preserve_topology=True)

    keep = ["geometry"] + [f for f in spec["popup_fields"] if f in gdf.columns]
    if "qa_flag" in gdf.columns and "qa_flag" not in keep:
        keep.append("qa_flag")
    gdf = gdf[keep]

    gdf.to_file(output, driver="GeoJSON")
    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"    → {output.name} ({len(gdf):,} features, {size_mb:.1f} MB)")

    manifest = {k: v for k, v in spec.items() if k not in ("parquet", "simplify", "sample")}
    manifest["file"] = f"data/viewer/{output.name}"
    manifest["feature_count"] = len(gdf)
    if spec.get("sample"):
        manifest["sampled"] = True
        manifest["sample_size"] = spec["sample"]
    return manifest


def main() -> int:
    args = parse_args()
    VIEWER_DIR.mkdir(parents=True, exist_ok=True)

    print("Building viewer layers from intermediate GeoParquet …")
    layers: list[dict] = []
    for spec in LAYER_SPECS:
        entry = export_layer(spec, force=args.force)
        if entry:
            layers.append(entry)

    manifest = {
        "title": "YourWalk — Casey pipeline layer QA",
        "generated_at": datetime.now(UTC).isoformat(),
        "bounds": CASEY_BOUNDS,
        "center": [
            (CASEY_BOUNDS["south"] + CASEY_BOUNDS["north"]) / 2,
            (CASEY_BOUNDS["west"] + CASEY_BOUNDS["east"]) / 2,
        ],
        "layers": layers,
        "notes": (
            "Local QA viewer only — not production UI. Council trees are a random "
            "sample of 8,000 for browser performance. Re-run after re-ingesting layers."
        ),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nManifest → {MANIFEST_PATH}")
    print(f"Layers ready: {len(layers)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
