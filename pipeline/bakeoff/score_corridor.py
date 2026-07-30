"""Length-weighted Casey scores along a route LineString (bake-off parity with web)."""

from __future__ import annotations

from typing import Any

import geopandas as gpd
from shapely.geometry import LineString, mapping


def score_route(
    line: LineString,
    scores: gpd.GeoDataFrame,
    *,
    buffer_m: float = 20.0,
) -> dict[str, Any]:
    if line is None or line.is_empty:
        return empty_score(0.0)

    route = gpd.GeoDataFrame(geometry=[line], crs=4326).to_crs(7855)
    route_len = float(route.geometry.iloc[0].length)
    corridor = route.buffer(buffer_m)
    sc = scores.to_crs(7855)
    hit = sc[sc.intersects(corridor.unary_union)].copy()
    if hit.empty:
        return empty_score(route_len)

    day_s = night_s = acc_s = 0.0
    day_w = night_w = acc_w = 0.0
    covered = 0.0
    route_geom = route.geometry.iloc[0]

    for _, row in hit.iterrows():
        # Prefer intersection length along buffered polygon approx via overlap length
        overlap = route_geom.intersection(row.geometry)
        w = float(overlap.length) if not overlap.is_empty else 0.0
        if w < 0.5:
            # fall back: portion of route near polygon
            near = route_geom.intersection(row.geometry.buffer(buffer_m))
            w = float(near.length) if not near.is_empty else 0.0
        if w < 0.5:
            continue
        covered += w
        d, n, a = row.get("day_index_score"), row.get("night_index_score"), row.get("accessibility_score")
        if d is not None and d == d:
            day_s += float(d) * w
            day_w += w
        if n is not None and n == n:
            night_s += float(n) * w
            night_w += w
        if a is not None and a == a:
            acc_s += float(a) * w
            acc_w += w

    coverage = min(1.0, covered / route_len) if route_len > 0 else 0.0
    day = (day_s / day_w) if day_w else None
    night = (night_s / night_w) if night_w else None
    acc = (acc_s / acc_w) if acc_w else None
    return {
        "distance_m": route_len,
        "day_index_score": day,
        "night_index_score": night,
        "accessibility_score": acc,
        "day_display": (day / 10.0) if day is not None else None,
        "night_display": (night / 10.0) if night is not None else None,
        "accessibility_display": (acc / 10.0) if acc is not None else None,
        "coverage_ratio": coverage,
        "confidence": "full" if coverage >= 0.35 else "reduced",
        "segment_hits": int(len(hit)),
    }


def empty_score(distance_m: float) -> dict[str, Any]:
    return {
        "distance_m": distance_m,
        "day_index_score": None,
        "night_index_score": None,
        "accessibility_score": None,
        "day_display": None,
        "night_display": None,
        "accessibility_display": None,
        "coverage_ratio": 0.0,
        "confidence": "reduced",
        "segment_hits": 0,
    }


def line_to_geojson(line: LineString, props: dict[str, Any]) -> dict[str, Any]:
    return {"type": "Feature", "properties": props, "geometry": mapping(line)}
