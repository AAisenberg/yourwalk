#!/usr/bin/env python3
"""Length-weighted suburb and ward ranks for the D0 dashboard artefact.

Reads scored T1EAM segments. Rolls up eligible rows only. Does not impute
missing as zero. Suburb and ward are the values tagged on Casey footpaths,
not official locality cadastre.

Usage (from pipeline/):
    python scripts/extract_dashboard_area_ranks.py
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon

from yourwalk_pipeline.paths import INTERMEDIATE_DIR, PIPELINE_ROOT

REPO_ROOT = PIPELINE_ROOT.parent
DEFAULT_INPUT = INTERMEDIATE_DIR / "segment_scores.parquet"
DEFAULT_JSON = REPO_ROOT / "docs" / "meeting-prep" / "dashboard-area-ranks.json"
DEFAULT_JS = REPO_ROOT / "docs" / "meeting-prep" / "dashboard-area-ranks.js"

# Casey LGA viewport used by the QA viewer. Maps to the D0 schematic blob.
CASEY_BOUNDS = {
    "south": -38.231,
    "west": 145.215,
    "north": -37.950,
    "east": 145.410,
}
SCHEMATIC = {"x0": 70.0, "y0": 80.0, "w": 660.0, "h": 400.0}
THIN_SEGMENTS = 50
THIN_KM = 2.0
HULL_SIMPLIFY = 0.003


def _slug(name: str) -> str:
    return (
        name.strip()
        .lower()
        .replace(" ", "-")
        .replace("'", "")
        .replace("/", "-")
    )


def _project_xy(lon: float, lat: float) -> tuple[float, float]:
    west, east = CASEY_BOUNDS["west"], CASEY_BOUNDS["east"]
    south, north = CASEY_BOUNDS["south"], CASEY_BOUNDS["north"]
    x = SCHEMATIC["x0"] + (lon - west) / (east - west) * SCHEMATIC["w"]
    y = SCHEMATIC["y0"] + (north - lat) / (north - south) * SCHEMATIC["h"]
    return round(x, 1), round(y, 1)


def _largest_polygon(geom):
    if geom is None or geom.is_empty:
        return None
    if isinstance(geom, Polygon):
        return geom
    if isinstance(geom, MultiPolygon):
        parts = [g for g in geom.geoms if not g.is_empty]
        if not parts:
            return None
        return max(parts, key=lambda g: g.area)
    return geom.convex_hull


def _hull_path(geom) -> str | None:
    """Schematic convex hull of scored footpaths, not official locality cadastre."""
    if geom is None or geom.is_empty:
        return None
    hull = geom.convex_hull
    poly = _largest_polygon(hull)
    if poly is None or poly.is_empty:
        return None
    simple = poly.simplify(HULL_SIMPLIFY, preserve_topology=True)
    if simple.is_empty:
        return None
    ring = getattr(simple, "exterior", None)
    if ring is None:
        return None
    coords = list(ring.coords)
    if len(coords) < 4:
        return None
    parts = []
    for i, (lon, lat) in enumerate(coords):
        x, y = _project_xy(lon, lat)
        parts.append(f"{'M' if i == 0 else 'L'}{x} {y}")
    return " ".join(parts) + " Z"


def _weighted_mean(frame: pd.DataFrame, col: str, weights: pd.Series) -> float:
    series = pd.to_numeric(frame[col], errors="coerce")
    valid = series.notna() & (weights > 0)
    if not valid.any():
        return float("nan")
    return float((series[valid] * weights[valid]).sum() / weights[valid].sum())


def _roll_up(eligible: gpd.GeoDataFrame, field: str) -> list[dict]:
    rows: list[dict] = []
    for name, part in eligible.groupby(field, dropna=True):
        label = str(name).strip()
        if not label:
            continue
        weights = pd.to_numeric(part["length_m"], errors="coerce").fillna(0)
        length_m = float(weights.sum())
        day100 = _weighted_mean(part, "day_index_score", weights)
        night100 = _weighted_mean(part, "night_index_score", weights)
        acc = _weighted_mean(part, "accessibility_score", weights)
        heat = _weighted_mean(part, "heat_shade_score", weights)
        light = _weighted_mean(part, "lighting_after_dark_score", weights)
        segs = int(len(part))
        length_km = length_m / 1000.0
        thin = segs < THIN_SEGMENTS or length_km < THIN_KM
        centroid = part.geometry.union_all().centroid
        x, y = _project_xy(float(centroid.x), float(centroid.y))
        dissolved = part.dissolve()
        hull_geom = dissolved.geometry.iloc[0] if not dissolved.empty else None
        minx, miny, maxx, maxy = (hull_geom.bounds if hull_geom is not None else (0, 0, 0, 0))
        x0, y0 = _project_xy(minx, maxy)
        x1, y1 = _project_xy(maxx, miny)
        rows.append(
            {
                "id": _slug(label),
                "name": label,
                "day": round(day100 / 10.0, 1),
                "night": round(night100 / 10.0, 1),
                "acc": int(round(acc)),
                "heat": int(round(heat)),
                "light": int(round(light)),
                "segs": segs,
                "length_km": round(length_km, 1),
                "thin": thin,
                "x": x,
                "y": y,
                "rx": max(18.0, round((x1 - x0) / 2, 1)),
                "ry": max(14.0, round((y1 - y0) / 2, 1)),
                "hull": _hull_path(hull_geom),
                "_acc": acc,
                "_heat": heat,
                "_light": light,
            }
        )
    return rows


def _tag_streams(rows: list[dict]) -> None:
    if not rows:
        return
    acc_med = float(pd.Series(r["_acc"] for r in rows).median())
    heat_med = float(pd.Series(r["_heat"] for r in rows).median())
    light_med = float(pd.Series(r["_light"] for r in rows).median())
    for row in rows:
        row["tagsDay"] = []
        row["tagsNight"] = []
        if row["_acc"] < acc_med:
            row["tagsDay"].append("Footpaths")
            row["tagsNight"].append("Footpaths")
        if row["_heat"] < heat_med:
            row["tagsDay"].append("Heat and shade")
        if row["_light"] < light_med:
            row["tagsNight"].append("After dark")
        for key in ("_acc", "_heat", "_light"):
            del row[key]


def extract(scores_path: Path) -> dict:
    gdf = gpd.read_parquet(scores_path).to_crs(4326)
    eligible = gdf[gdf["score_eligible"].fillna(False)].copy()
    eligible = eligible[eligible["length_m"].fillna(0) > 0]
    if eligible.empty:
        raise SystemExit("No score-eligible segments with length.")

    spec = str(eligible["scoring_spec_version"].dropna().iloc[0])
    scored_at = str(eligible["scored_at"].dropna().iloc[0]) if "scored_at" in eligible else None

    suburbs = _roll_up(eligible, "suburb")
    wards = _roll_up(eligible, "ward")
    _tag_streams(suburbs)
    _tag_streams(wards)

    weights = pd.to_numeric(eligible["length_m"], errors="coerce").fillna(0)
    lga = {
        "day": round(_weighted_mean(eligible, "day_index_score", weights) / 10.0, 1),
        "night": round(_weighted_mean(eligible, "night_index_score", weights) / 10.0, 1),
        "acc": int(round(_weighted_mean(eligible, "accessibility_score", weights))),
        "heat": int(round(_weighted_mean(eligible, "heat_shade_score", weights))),
        "light": int(round(_weighted_mean(eligible, "lighting_after_dark_score", weights))),
        "segs": int(len(eligible)),
        "length_km": round(float(weights.sum()) / 1000.0, 1),
    }

    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "source": str(scores_path.relative_to(REPO_ROOT))
        if scores_path.is_relative_to(REPO_ROOT)
        else str(scores_path),
        "scoring_spec_version": spec,
        "scored_at": scored_at,
        "rule": (
            "Length-weighted mean of score_eligible segments. "
            "Suburb and ward as tagged on Casey footpaths. "
            "Missing is not treated as zero. Dandenong is not eligible."
        ),
        "honest_copy": (
            "Suburb and ward as tagged on Casey footpaths. "
            "Hulls are schematic convex hulls of scored paths, not official locality boundaries."
        ),
        "lga": lga,
        "suburbs": sorted(suburbs, key=lambda r: (r["day"], r["name"])),
        "wards": sorted(wards, key=lambda r: (r["day"], r["name"])),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--js-out", type=Path, default=DEFAULT_JS)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Missing scores: {args.input}")

    payload = extract(args.input)
    text = json.dumps(payload, indent=2)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(text + "\n", encoding="utf-8")
    args.js_out.write_text(
        "window.YOURWALK_AREA_RANKS = " + text + ";\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.json_out.relative_to(REPO_ROOT)} "
        f"({len(payload['suburbs'])} suburbs, {len(payload['wards'])} wards, "
        f"LGA Day {payload['lga']['day']} Night {payload['lga']['night']})"
    )


if __name__ == "__main__":
    main()
