#!/usr/bin/env python3
"""Export lean T1EAM segment scores for OSM join (bake-off step 2)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from paths import SCORES_EXPORT, SCORES_PARQUET, ensure_bakeoff_dirs  # noqa: E402

KEEP = [
    "segment_id",
    "day_index_score",
    "night_index_score",
    "accessibility_score",
    "confidence_day",
    "confidence_night",
    "length_m",
    "suburb",
    "walk_path_class",
    "geometry",
]


def main() -> int:
    ensure_bakeoff_dirs()
    if not SCORES_PARQUET.exists():
        print(f"Missing {SCORES_PARQUET} — run score_segments.py first", file=sys.stderr)
        return 1

    gdf = gpd.read_parquet(SCORES_PARQUET)
    if "score_eligible" in gdf.columns:
        gdf = gdf[gdf["score_eligible"].fillna(False)].copy()
    keep = [c for c in KEEP if c in gdf.columns]
    gdf = gdf[keep].copy()
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    # Slight simplify for join speed; topology preserved enough for buffer join
    gdf["geometry"] = gdf.geometry.simplify(0.00002, preserve_topology=True)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()

    SCORES_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_file(SCORES_EXPORT, driver="GeoJSON")
    meta = {
        "feature_count": int(len(gdf)),
        "path": str(SCORES_EXPORT),
        "columns": keep,
    }
    SCORES_EXPORT.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2))
    print(f"Wrote {len(gdf)} scored polygons → {SCORES_EXPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
