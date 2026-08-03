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
import pandas as pd

from yourwalk_pipeline.download import download_geojson_export
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, PIPELINE_ROOT, RAW_DIR

VIEWER_DIR = PIPELINE_ROOT / "data" / "viewer"
MANIFEST_PATH = VIEWER_DIR / "layers.json"

CASEY_BOUNDS = {
    "south": -38.231,
    "west": 145.215,
    "north": -37.950,
    "east": 145.410,
}

SPEED_LIMIT_COLORS = {
    "40": "#22c55e",
    "50": "#84cc16",
    "60": "#eab308",
    "70": "#f97316",
    "80": "#ef4444",
    "100": "#991b1b",
}

TREE_DENSITY_COLORS = {
    "sparse": "#bbf7d0",
    "medium": "#4ade80",
    "dense": "#15803d",
}

SCORE_INDEX_COLORS = ["#b91c1c", "#f97316", "#facc15", "#84cc16", "#15803d"]

WALK_PATH_CLASS_COLORS = {
    "footpath": "#2563eb",
    "shared_use": "#0d9488",
    "other": "#94a3b8",
}

WIDTH_QA_COLORS = {
    "ok": "#2563eb",
    "missing_width": "#94a3b8",
    "invalid_width": "#f59e0b",
    "zero_width": "#ef4444",
    "too_narrow": "#a855f7",
    "too_wide": "#dc2626",
}

SURFACE_COLORS = {
    "Concrete": "#64748b",
    "Reinforced Concrete": "#475569",
    "Gravel": "#d97706",
    "Asphalt - DGA": "#1e293b",
    "Brick Paving": "#b45309",
    "Timber": "#92400e",
    "Other": "#cbd5e1",
}

PARK_RESERVE_TYPE_COLORS = {
    "Major Passive Park": "#166534",
    "Neighbourhood Parks, LINKING CRT HDS": "#4ade80",
    "Arterial Reserve": "#a3e635",
    "Community Reserve": "#22d3ee",
    "Sports Reserve": "#f97316",
    "Leisure Facilities": "#c084fc",
    "Undeveloped Reserve": "#94a3b8",
}

LIGHT_CATEGORY_COLORS = {
    "daylight": "#fbbf24",
    "dawn_dusk": "#fb923c",
    "dark_lighted": "#6366f1",
    "dark_not_lighted": "#312e81",
    "other": "#94a3b8",
    "missing": "#475569",
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
    export_fields: list[str] | None = None,
    default_on: bool = False,
    cluster: bool = False,
    point_radius: float = 5,
    simplify: float | None = None,
    sample: int | None = None,
    fill_opacity: float = 0.35,
    weight: int = 2,
    style_modes: dict | None = None,
    filter_by: str = "suburb",
) -> dict:
    return {
        "id": layer_id,
        "name": name,
        "parquet": parquet,
        "stream": stream,
        "geometry": geometry,
        "color": color,
        "popup_fields": popup_fields,
        "export_fields": export_fields or popup_fields,
        "default_on": default_on,
        "cluster": cluster,
        "point_radius": point_radius,
        "simplify": simplify,
        "sample": sample,
        "fill_opacity": fill_opacity,
        "weight": weight,
        "style_modes": style_modes or {},
        "filter_by": filter_by,
    }


LAYER_SPECS = [
    layer_spec(
        "footpaths",
        "Walk network (T1EAM)",
        "footpaths_ply_t1eam.parquet",
        stream="Segment network",
        geometry="polygon",
        color="#2563eb",
        popup_fields=[
            "segment_id",
            "walk_path_class",
            "surface_material",
            "width_m",
            "length_m",
            "suburb",
            "ward",
            "width_qa_flag",
        ],
        export_fields=[
            "segment_id",
            "walk_path_class",
            "surface_material",
            "width_m",
            "length_m",
            "suburb",
            "ward",
            "width_qa_flag",
        ],
        default_on=True,
        simplify=0.00003,
        fill_opacity=0.55,
        filter_by="suburb",
        style_modes={
            "walk_path_class": {
                "label": "Path class",
                "type": "categorical",
                "field": "walk_path_class",
                "palette": WALK_PATH_CLASS_COLORS,
            },
            "width_m": {
                "label": "Width (m)",
                "type": "numeric",
                "field": "width_m",
                "colors": ["#dbeafe", "#60a5fa", "#2563eb", "#1e40af", "#dc2626"],
                "max_display": 4.0,
            },
            "surface_material": {
                "label": "Surface material",
                "type": "categorical",
                "field": "surface_material",
                "palette": SURFACE_COLORS,
            },
            "width_qa_flag": {
                "label": "Width QA flag",
                "type": "categorical",
                "field": "width_qa_flag",
                "palette": WIDTH_QA_COLORS,
            },
        },
    ),
    layer_spec(
        "segment_scores",
        "Segment scores (Day / Night)",
        "segment_scores.parquet",
        stream="Scoring",
        geometry="polygon",
        color="#15803d",
        popup_fields=[
            "segment_id",
            "walk_path_class",
            "score_eligible",
            "day_index_score",
            "night_index_score",
            "day_index_display",
            "night_index_display",
            "accessibility_score",
            "heat_shade_score",
            "lighting_after_dark_score",
            "score_width",
            "score_surface",
            "score_speed",
            "score_graffiti",
            "score_heat",
            "score_canopy",
            "score_comfort",
            "score_lighting",
            "score_crash",
            "lighting_density_per_100m",
            "length_m",
            "confidence_day",
            "confidence_night",
            "suburb",
            "ward",
        ],
        export_fields=[
            "segment_id",
            "walk_path_class",
            "score_eligible",
            "day_index_score",
            "night_index_score",
            "day_index_display",
            "night_index_display",
            "accessibility_score",
            "heat_shade_score",
            "lighting_after_dark_score",
            "score_width",
            "score_surface",
            "score_speed",
            "score_graffiti",
            "score_heat",
            "score_canopy",
            "score_comfort",
            "score_lighting",
            "score_crash",
            "lighting_density_per_100m",
            "length_m",
            "confidence_day",
            "confidence_night",
            "suburb",
            "ward",
        ],
        default_on=False,
        simplify=0.00003,
        fill_opacity=0.65,
        weight=1,
        filter_by="suburb",
        style_modes={
            "day_index_score": {
                "label": "Day Index (0–100)",
                "type": "numeric",
                "field": "day_index_score",
                "colors": SCORE_INDEX_COLORS,
                "max_display": 100,
            },
            "night_index_score": {
                "label": "Night Index (0–100)",
                "type": "numeric",
                "field": "night_index_score",
                "colors": SCORE_INDEX_COLORS,
                "max_display": 100,
            },
            "accessibility_score": {
                "label": "Accessibility (0–100)",
                "type": "numeric",
                "field": "accessibility_score",
                "colors": SCORE_INDEX_COLORS,
                "max_display": 100,
            },
            "heat_shade_score": {
                "label": "Heat & shade (0–100)",
                "type": "numeric",
                "field": "heat_shade_score",
                "colors": SCORE_INDEX_COLORS,
                "max_display": 100,
            },
            "lighting_after_dark_score": {
                "label": "Lighting / after dark (0–100)",
                "type": "numeric",
                "field": "lighting_after_dark_score",
                "colors": SCORE_INDEX_COLORS,
                "max_display": 100,
            },
            "confidence_day": {
                "label": "Day data confidence",
                "type": "categorical",
                "field": "confidence_day",
                "palette": {"high": "#15803d", "medium": "#ca8a04", "low": "#b91c1c"},
                "legend_note": (
                    "Trust in Day Index inputs — not walk quality. "
                    "High = fewer data gaps (width, speed, heat, canopy, crossings)."
                ),
            },
            "confidence_night": {
                "label": "Night data confidence",
                "type": "categorical",
                "field": "confidence_night",
                "palette": {"high": "#15803d", "medium": "#ca8a04", "low": "#b91c1c"},
                "legend_note": (
                    "Trust in Night Index inputs — not walk quality. "
                    "High = fewer data gaps (width, speed, lighting, crossings)."
                ),
            },
        },
    ),
    layer_spec(
        "speed_zones",
        "Speed zones (Casey)",
        "speed_zones_casey_2026-02.parquet",
        stream="Accessibility",
        geometry="line",
        color="#dc2626",
        popup_fields=["speed_limit_kmh", "road_name", "zone_length_m", "lga", "qa_flag"],
        export_fields=["speed_limit_kmh", "road_name", "zone_length_m", "lga", "qa_flag"],
        filter_by="spatial",
        simplify=0.00002,
        fill_opacity=0.0,
        weight=4,
        style_modes={
            "speed_limit_kmh": {
                "label": "Speed limit (km/h)",
                "type": "categorical",
                "field": "speed_limit_kmh",
                "palette": SPEED_LIMIT_COLORS,
            },
        },
    ),
    layer_spec(
        "urban_heat",
        "Urban heat 2018 (UHI)",
        "metro_urban_heat_2018_casey.parquet",
        stream="Day Index — heat",
        geometry="polygon",
        color="#ea580c",
        popup_fields=["uhi18_m", "mesh_block_code", "lga", "per_any_veg", "qa_flag"],
        export_fields=["uhi18_m", "mesh_block_code", "lga", "per_any_veg", "qa_flag"],
        filter_by="spatial",
        simplify=0.00008,
        fill_opacity=0.65,
        style_modes={
            "uhi18_m": {
                "label": "UHI (°C above baseline)",
                "type": "numeric",
                "field": "uhi18_m",
                "colors": ["#fef9c3", "#fdba74", "#ea580c", "#c2410c", "#7f1d1d"],
            },
        },
    ),
    layer_spec(
        "tree_density",
        "Tree density (Vicmap)",
        "vicmap_tree_density_casey.parquet",
        stream="Day Index — canopy",
        geometry="polygon",
        color="#16a34a",
        popup_fields=["tree_density", "area_m2", "qa_flag"],
        export_fields=["tree_density", "area_m2", "qa_flag"],
        filter_by="spatial",
        simplify=0.00008,
        fill_opacity=0.5,
        style_modes={
            "tree_density": {
                "label": "Canopy density class",
                "type": "categorical",
                "field": "tree_density",
                "palette": TREE_DENSITY_COLORS,
            },
        },
    ),
    layer_spec(
        "streetlights",
        "Street lights (AusNet/UE)",
        "ausnet_unitedenergy_mvp4_streetlights.parquet",
        stream="Night Index",
        geometry="point",
        color="#facc15",
        popup_fields=["wattage_w", "globe_type", "provider", "suburb", "ward", "street_name", "qa_flag"],
        export_fields=["wattage_w", "globe_type", "provider", "suburb", "ward", "street_name", "qa_flag"],
        cluster=False,
        point_radius=2.5,
        style_modes={
            "wattage_w": {
                "label": "Wattage (W)",
                "type": "numeric",
                "field": "wattage_w",
                "colors": ["#fef08a", "#facc15", "#ca8a04", "#854d0e"],
                "max_display": 150,
            },
            "provider": {
                "label": "Provider",
                "type": "categorical",
                "field": "provider",
                "palette": {
                    "AusNet Services": "#facc15",
                    "United Energy": "#fb923c",
                },
            },
        },
    ),
    layer_spec(
        "park_lights",
        "Park / reserve lights",
        "parkreserve_light_pt_t1eam.parquet",
        stream="Night Index",
        geometry="point",
        color="#fde047",
        popup_fields=["wattage_w", "luminaire_type", "location_type", "suburb", "ward", "qa_flag"],
        export_fields=["wattage_w", "luminaire_type", "location_type", "suburb", "ward", "qa_flag"],
        cluster=False,
        point_radius=4,
        style_modes={
            "location_type": {
                "label": "Location type",
                "type": "categorical",
                "field": "location_type",
                "palette": {},
            },
        },
    ),
    layer_spec(
        "crashes",
        "Pedestrian crashes (Casey)",
        "vic_crashes_casey_pedestrian.parquet",
        stream="Night Index",
        geometry="point",
        color="#7c3aed",
        popup_fields=["crash_date", "light_category", "injury_severity", "road_name", "night_index_eligible"],
        export_fields=["crash_date", "light_category", "injury_severity", "road_name", "night_index_eligible", "qa_flag"],
        default_on=False,
        filter_by="spatial",
        point_radius=6,
        style_modes={
            "light_category": {
                "label": "Light condition",
                "type": "categorical",
                "field": "light_category",
                "palette": LIGHT_CATEGORY_COLORS,
            },
        },
    ),
    layer_spec(
        "graffiti",
        "Graffiti locations",
        "graffiti-locations.parquet",
        stream="Accessibility",
        geometry="point",
        color="#ec4899",
        popup_fields=["graffiti_type", "suburb", "ward", "created_date", "days_to_remove", "qa_flag"],
        cluster=True,
    ),
    layer_spec(
        "council_trees",
        "Council trees (sample)",
        "council_trees_pt_t1eam.parquet",
        stream="Day Index",
        geometry="point",
        color="#15803d",
        popup_fields=["tree_type", "tree_age", "tree_height_m", "suburb", "ward"],
        cluster=True,
        sample=8000,
        style_modes={
            "tree_type": {
                "label": "Tree type",
                "type": "categorical",
                "field": "tree_type",
                "palette": {
                    "Street Tree": "#15803d",
                    "Reserve Tree": "#4ade80",
                    "To be determined": "#94a3b8",
                },
            },
        },
    ),
    layer_spec(
        "fountains",
        "Drinking fountains",
        "drinkingfountains_pt_t1eam.parquet",
        stream="Day Index — comfort",
        geometry="point",
        color="#0891b2",
        popup_fields=["fountain_type", "condition", "suburb", "ward", "park_reserve_name", "qa_flag"],
        point_radius=6,
    ),
    layer_spec(
        "benches",
        "Benches & seats",
        "benches_seats_pt_t1eam.parquet",
        stream="Day Index — comfort",
        geometry="point",
        color="#92400e",
        popup_fields=["amenity_type", "suburb", "ward", "reserve_name"],
        cluster=True,
        filter_by="suburb",
    ),
    layer_spec(
        "school_crossings",
        "School crossings",
        "school_crossings_pt_t1eam.parquet",
        stream="Accessibility",
        geometry="point",
        color="#4f46e5",
        popup_fields=["school_name", "street_name", "suburb", "ward", "qa_flag"],
        default_on=False,
        point_radius=7,
    ),
]

# Viewer-only context layers (raw GeoJSON from Casey Open Data — not ingested for scoring).
REFERENCE_LAYER_SPECS = [
    {
        "id": "parks_reserves",
        "dataset_id": "parks-reserves-ply-t1eam",
        "name": "Parks & reserves (T1EAM)",
        "stream": "Open space (QA context)",
        "geometry": "polygon",
        "color": "#22c55e",
        "popup_fields": [
            "parkresname",
            "prtype",
            "funcuse",
            "osareatype",
            "prarea_ha",
            "suburb",
            "ward",
        ],
        "export_fields": [
            "parkresname",
            "prtype",
            "funcuse",
            "osareatype",
            "prarea_ha",
            "suburb",
            "ward",
            "ownership",
        ],
        "default_on": False,
        "simplify": 0.00006,
        "fill_opacity": 0.22,
        "weight": 1,
        "filter_by": "spatial",
        "style_modes": {
            "prtype": {
                "label": "Park reserve type",
                "type": "categorical",
                "field": "prtype",
                "palette": PARK_RESERVE_TYPE_COLORS,
            },
        },
    },
    {
        "id": "dog_friendly_spaces",
        "dataset_id": "dog-friendly-spaces",
        "name": "Dog-friendly spaces",
        "stream": "Open space (QA context)",
        "geometry": "polygon",
        "color": "#a855f7",
        "popup_fields": ["reserve", "status", "suburb", "postcode", "address"],
        "export_fields": ["reserve", "status", "suburb", "postcode", "address", "descript"],
        "default_on": False,
        "simplify": 0.00002,
        "fill_opacity": 0.45,
        "weight": 2,
        "filter_by": "spatial",
    },
]

BOUNDARY_DATASET_ID = "caseylga_boundary"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Rebuild all GeoJSON files even if they exist")
    return parser.parse_args()


def enrich_categorical_palette(gdf: gpd.GeoDataFrame, mode: dict) -> dict:
    field = mode["field"]
    palette = dict(mode.get("palette") or {})
    if field not in gdf.columns:
        return palette
    values = gdf[field].dropna().astype(str).unique()
    fallback_hues = ["#38bdf8", "#a78bfa", "#f472b6", "#4ade80", "#fb923c", "#f87171"]
    i = 0
    for value in sorted(values):
        if value not in palette:
            palette[value] = fallback_hues[i % len(fallback_hues)]
            i += 1
    return palette


def enrich_numeric_stats(gdf: gpd.GeoDataFrame, mode: dict) -> dict:
    field = mode["field"]
    out = dict(mode)
    if field not in gdf.columns:
        return out
    series = pd.to_numeric(gdf[field], errors="coerce").dropna()
    if series.empty:
        return out
    out["min"] = float(series.min())
    out["max"] = float(series.max())
    out["median"] = float(series.median())
    return out


def build_style_modes(gdf: gpd.GeoDataFrame, spec: dict) -> dict:
    modes = spec.get("style_modes") or {}
    if not modes:
        return {}

    built: dict = {}
    for mode_id, mode in modes.items():
        entry = dict(mode)
        if entry["type"] == "categorical":
            entry["palette"] = enrich_categorical_palette(gdf, entry)
        elif entry["type"] == "numeric":
            entry = enrich_numeric_stats(gdf, entry)
        built[mode_id] = entry

    default_mode = next(iter(built))
    return {"default": default_mode, "modes": built}


def export_reference_layer(spec: dict, *, force: bool) -> dict | None:
    """Export a Casey Open Data reference layer to viewer GeoJSON (no Parquet ingest)."""
    dataset_id = spec["dataset_id"]
    raw_path = RAW_DIR / f"{dataset_id}.geojson"
    output = VIEWER_DIR / f"{spec['id']}.geojson"

    if output.exists() and not force and raw_path.exists():
        print(f"  reuse {spec['id']} → {output.name}")
        gdf = gpd.read_file(output)
        manifest = {k: v for k, v in spec.items() if k not in ("dataset_id", "simplify", "export_fields", "style_modes")}
        manifest["file"] = f"data/viewer/{output.name}"
        manifest["feature_count"] = len(gdf)
        manifest["style"] = build_style_modes(gdf, spec)
        manifest["qa_only"] = True
        return manifest

    print(f"  download {dataset_id} …")
    download_geojson_export(dataset_id, raw_path, force=force)

    print(f"  build {spec['id']} …")
    gdf = gpd.read_file(raw_path)
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    else:
        gdf = gdf.to_crs(4326)

    if "prarea_m2" in gdf.columns:
        gdf["prarea_ha"] = (pd.to_numeric(gdf["prarea_m2"], errors="coerce") / 10_000).round(2)

    simplify = spec.get("simplify")
    if simplify:
        gdf = gdf.copy()
        gdf["geometry"] = gdf.geometry.simplify(simplify, preserve_topology=True)

    keep_fields = list(dict.fromkeys(spec.get("export_fields") or spec["popup_fields"]))
    keep = ["geometry"] + [f for f in keep_fields if f in gdf.columns]
    gdf = gdf[keep]
    gdf.to_file(output, driver="GeoJSON")
    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"    → {output.name} ({len(gdf):,} features, {size_mb:.1f} MB)")

    manifest = {k: v for k, v in spec.items() if k not in ("dataset_id", "simplify", "export_fields", "style_modes")}
    manifest["file"] = f"data/viewer/{output.name}"
    manifest["feature_count"] = len(gdf)
    manifest["style"] = build_style_modes(gdf, spec)
    manifest["qa_only"] = True
    return manifest


def export_lga_boundary(*, force: bool) -> dict | None:
    """Casey LGA outline for fixed map context (viewer-only)."""
    raw_path = RAW_DIR / f"{BOUNDARY_DATASET_ID}.geojson"
    output = VIEWER_DIR / "casey_lga_boundary.geojson"

    if output.exists() and not force and raw_path.exists():
        print(f"  reuse LGA boundary → {output.name}")
        return {
            "file": f"data/viewer/{output.name}",
            "name": "City of Casey LGA boundary",
            "default_on": True,
            "toggleable": True,
            "interactive": False,
        }

    print(f"  download {BOUNDARY_DATASET_ID} …")
    download_geojson_export(BOUNDARY_DATASET_ID, raw_path, force=force)
    gdf = gpd.read_file(raw_path).to_crs(4326)
    if len(gdf) != 1:
        print(f"    warning: expected 1 LGA feature, got {len(gdf)}")
    keep = ["geometry"] + [c for c in ("lga_name", "gisfid") if c in gdf.columns]
    gdf = gdf[keep]
    gdf.to_file(output, driver="GeoJSON")
    print(f"    → {output.name}")
    return {
        "file": f"data/viewer/{output.name}",
        "name": "City of Casey LGA boundary",
        "default_on": True,
        "toggleable": True,
        "interactive": False,
    }


def export_layer(spec: dict, *, force: bool) -> dict | None:
    parquet_path = INTERMEDIATE_DIR / spec["parquet"]
    if not parquet_path.exists():
        print(f"  skip {spec['id']}: missing {parquet_path.name}")
        return None

    output = VIEWER_DIR / f"{spec['id']}.geojson"
    if output.exists() and not force:
        print(f"  reuse {spec['id']} → {output.name}")
        manifest = {
            k: v
            for k, v in spec.items()
            if k not in ("parquet", "simplify", "sample", "export_fields", "style_modes")
        }
        manifest["file"] = f"data/viewer/{output.name}"
        return manifest

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

    keep_fields = list(dict.fromkeys(spec.get("export_fields") or spec["popup_fields"]))
    keep = ["geometry"] + [f for f in keep_fields if f in gdf.columns]
    gdf = gdf[keep]

    gdf.to_file(output, driver="GeoJSON")
    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"    → {output.name} ({len(gdf):,} features, {size_mb:.1f} MB)")

    manifest = {k: v for k, v in spec.items() if k not in ("parquet", "simplify", "sample", "export_fields", "style_modes")}
    manifest["file"] = f"data/viewer/{output.name}"
    manifest["feature_count"] = len(gdf)
    manifest["style"] = build_style_modes(gdf, spec)
    if spec.get("sample"):
        manifest["sampled"] = True
        manifest["sample_size"] = spec["sample"]
    return manifest


def _bounds_dict(gdf: gpd.GeoDataFrame) -> dict[str, float]:
    minx, miny, maxx, maxy = gdf.total_bounds
    return {"west": float(minx), "south": float(miny), "east": float(maxx), "north": float(maxy)}


def _count_in_area(points: gpd.GeoDataFrame, area: gpd.GeoDataFrame) -> int:
    if points.empty or area.empty:
        return 0
    joined = gpd.sjoin(points, area, predicate="within", how="inner")
    return int(len(joined))


def _count_intersecting(polygons: gpd.GeoDataFrame, area: gpd.GeoDataFrame) -> int:
    if polygons.empty or area.empty:
        return 0
    joined = gpd.sjoin(polygons, area, predicate="intersects", how="inner")
    return int(len(joined))


def _score_stats(segments: gpd.GeoDataFrame) -> dict:
    """Median index scores for eligible segments in a subset."""
    if segments.empty or "day_index_score" not in segments.columns:
        return {}
    eligible = segments[segments["score_eligible"] == True]  # noqa: E712
    if eligible.empty:
        return {}
    return {
        "scored_segments": int(len(eligible)),
        "median_day_index": round(float(eligible["day_index_score"].median()), 1),
        "median_night_index": round(float(eligible["night_index_score"].median()), 1),
        "median_accessibility": round(float(eligible["accessibility_score"].median()), 1),
    }


def _mean_in_area(
    polygons: gpd.GeoDataFrame,
    area: gpd.GeoDataFrame,
    field: str,
) -> float | None:
    if polygons.empty or area.empty or field not in polygons.columns:
        return None
    joined = gpd.sjoin(polygons, area, predicate="intersects", how="inner")
    if joined.empty:
        return None
    series = pd.to_numeric(joined[field], errors="coerce").dropna()
    return float(series.mean()) if not series.empty else None


def build_filter_index(*, force: bool) -> dict:
    """Suburb/ward boundaries, bboxes, and coverage stats for the QA viewer."""
    filters_path = VIEWER_DIR / "filters.json"
    suburb_path = VIEWER_DIR / "suburb_boundaries.geojson"
    ward_path = VIEWER_DIR / "ward_boundaries.geojson"

    if filters_path.exists() and suburb_path.exists() and ward_path.exists() and not force:
        print("  reuse filters.json + boundary layers")
        return json.loads(filters_path.read_text(encoding="utf-8"))

    print("Building suburb/ward filter index …")
    footpaths = gpd.read_parquet(INTERMEDIATE_DIR / "footpaths_ply_t1eam.parquet").to_crs(4326)

    scores_path = INTERMEDIATE_DIR / "segment_scores.parquet"
    scores_gdf = (
        gpd.read_parquet(scores_path).to_crs(4326) if scores_path.exists() else None
    )

    layer_points: dict[str, gpd.GeoDataFrame] = {}
    for layer_id, parquet in [
        ("streetlights", "ausnet_unitedenergy_mvp4_streetlights.parquet"),
        ("park_lights", "parkreserve_light_pt_t1eam.parquet"),
        ("crashes", "vic_crashes_casey_pedestrian.parquet"),
        ("graffiti", "graffiti-locations.parquet"),
        ("fountains", "drinkingfountains_pt_t1eam.parquet"),
        ("benches", "benches_seats_pt_t1eam.parquet"),
        ("school_crossings", "school_crossings_pt_t1eam.parquet"),
        ("council_trees", "council_trees_pt_t1eam.parquet"),
    ]:
        path = INTERMEDIATE_DIR / parquet
        if path.exists():
            layer_points[layer_id] = gpd.read_parquet(path).to_crs(4326)

    heat = gpd.read_parquet(INTERMEDIATE_DIR / "metro_urban_heat_2018_casey.parquet").to_crs(4326)
    trees = gpd.read_parquet(INTERMEDIATE_DIR / "vicmap_tree_density_casey.parquet").to_crs(4326)
    speed = gpd.read_parquet(INTERMEDIATE_DIR / "speed_zones_casey_2026-02.parquet").to_crs(4326)

    suburb_dissolved = (
        footpaths.dissolve(by="suburb", aggfunc={"ward": "first"})
        .reset_index()
        .rename(columns={"suburb": "area_name"})
    )
    suburb_dissolved["area_type"] = "suburb"
    suburb_dissolved["geometry"] = suburb_dissolved.geometry.simplify(0.00015, preserve_topology=True)

    ward_dissolved = (
        footpaths.dissolve(by="ward", aggfunc={"suburb": "first"})
        .reset_index()
        .rename(columns={"ward": "area_name"})
    )
    ward_dissolved["area_type"] = "ward"
    ward_dissolved["geometry"] = ward_dissolved.geometry.simplify(0.00015, preserve_topology=True)

    suburb_dissolved.to_file(suburb_path, driver="GeoJSON")
    ward_dissolved.to_file(ward_path, driver="GeoJSON")

    def coverage_for(area_gdf: gpd.GeoDataFrame, area_type: str, area_name: str) -> dict:
        fp = footpaths[footpaths[area_type] == area_name]
        area_geom = area_gdf[area_gdf["area_name"] == area_name]
        shared = fp[fp["walk_path_class"] == "shared_use"] if "walk_path_class" in fp.columns else fp.iloc[0:0]
        stats: dict = {
            "footpath_segments": int(len(fp)),
            "footpath_length_km": round(float(fp["length_m"].fillna(0).sum()) / 1000, 1)
            if "length_m" in fp.columns
            else None,
            "shared_use_segments": int(len(shared)),
            "shared_use_length_km": round(float(shared["length_m"].fillna(0).sum()) / 1000, 1)
            if "length_m" in shared.columns and not shared.empty
            else 0.0,
            "median_width_m": round(float(fp["width_m"].median()), 2)
            if "width_m" in fp.columns and not fp.empty
            else None,
            "bounds": _bounds_dict(fp if not fp.empty else area_geom),
        }
        for layer_id, points in layer_points.items():
            stats[layer_id] = _count_in_area(points, area_geom)
        stats["heat_mesh_blocks"] = _count_intersecting(heat, area_geom)
        stats["tree_density_polygons"] = _count_intersecting(trees, area_geom)
        stats["speed_zone_segments"] = _count_intersecting(speed, area_geom)
        stats["mean_uhi18_m"] = (
            round(v, 2) if (v := _mean_in_area(heat, area_geom, "uhi18_m")) is not None else None
        )
        if scores_gdf is not None:
            area_scores = scores_gdf[scores_gdf[area_type] == area_name]
            stats.update(_score_stats(area_scores))
        return stats

    suburbs = sorted(footpaths["suburb"].dropna().unique())
    wards = sorted(footpaths["ward"].dropna().unique())

    suburb_index = {}
    for name in suburbs:
        suburb_index[name] = coverage_for(suburb_dissolved, "suburb", name)
        suburb_index[name]["primary_ward"] = (
            footpaths.loc[footpaths["suburb"] == name, "ward"].mode().iloc[0]
            if not footpaths[footpaths["suburb"] == name].empty
            else None
        )

    ward_index = {}
    for name in wards:
        ward_index[name] = coverage_for(ward_dissolved, "ward", name)
        ward_index[name]["suburb_count"] = int(footpaths.loc[footpaths["ward"] == name, "suburb"].nunique())

    shared_lga = (
        footpaths[footpaths["walk_path_class"] == "shared_use"]
        if "walk_path_class" in footpaths.columns
        else footpaths.iloc[0:0]
    )
    lga_stats = {
        "footpath_segments": int(len(footpaths)),
        "footpath_length_km": round(float(footpaths["length_m"].fillna(0).sum()) / 1000, 1),
        "shared_use_segments": int(len(shared_lga)),
        "shared_use_length_km": round(float(shared_lga["length_m"].fillna(0).sum()) / 1000, 1)
        if not shared_lga.empty
        else 0.0,
        "median_width_m": round(float(footpaths["width_m"].median()), 2),
    }
    for layer_id, points in layer_points.items():
        lga_stats[layer_id] = int(len(points))
    lga_stats["heat_mesh_blocks"] = int(len(heat))
    lga_stats["tree_density_polygons"] = int(len(trees))
    lga_stats["speed_zone_segments"] = int(len(speed))
    lga_stats["mean_uhi18_m"] = round(float(heat["uhi18_m"].mean()), 2)
    if scores_gdf is not None:
        lga_stats.update(_score_stats(scores_gdf))

    payload = {
        "suburbs": suburbs,
        "wards": wards,
        "suburb_stats": suburb_index,
        "ward_stats": ward_index,
        "lga_stats": lga_stats,
        "suburb_boundaries_file": "data/viewer/suburb_boundaries.geojson",
        "ward_boundaries_file": "data/viewer/ward_boundaries.geojson",
        "geographic_scope": {
            "scoring_boundary": "City of Casey LGA",
            "routing_graph": "OSM clip — Casey LGA + 2 km buffer (future)",
            "routing_confidence": "Reduced outside LGA boundary",
            "mvp_origin_destination": "Both endpoints within Casey LGA",
            "dashboard_filters": ["suburb (primary)", "ward (secondary)", "SA2 (reporting aggregate)"],
        },
    }
    filters_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"  → {filters_path.name} ({len(suburbs)} suburbs, {len(wards)} wards)")
    return payload


def main() -> int:
    args = parse_args()
    VIEWER_DIR.mkdir(parents=True, exist_ok=True)

    print("Building viewer layers from intermediate GeoParquet …")
    layers: list[dict] = []
    for spec in LAYER_SPECS:
        entry = export_layer(spec, force=args.force)
        if entry:
            layers.append(entry)

    print("\nBuilding QA context layers (Open Data reference, not scored) …")
    for spec in REFERENCE_LAYER_SPECS:
        entry = export_reference_layer(spec, force=args.force)
        if entry:
            layers.append(entry)

    boundary = export_lga_boundary(force=args.force)

    filter_index = build_filter_index(force=args.force)

    manifest = {
        "title": "YourWalk — Casey pipeline layer QA",
        "generated_at": datetime.now(UTC).isoformat(),
        "bounds": CASEY_BOUNDS,
        "center": [
            (CASEY_BOUNDS["south"] + CASEY_BOUNDS["north"]) / 2,
            (CASEY_BOUNDS["west"] + CASEY_BOUNDS["east"]) / 2,
        ],
        "layers": layers,
        "boundary": boundary,
        "filters_file": "data/viewer/filters.json",
        "geographic_scope": filter_index["geographic_scope"],
        "notes": (
            "Walk network on by default; toggle Segment scores for Day/Night choropleth. "
            "Choropleth / graded symbology on key layers. LGA boundary on by default. "
            "Parks/reserves and dog-friendly are QA context only (not ingested). "
            "Re-run build after re-ingesting or re-scoring."
        ),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nManifest → {MANIFEST_PATH}")
    print(f"Layers ready: {len(layers)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
