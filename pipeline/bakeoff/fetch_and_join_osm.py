#!/usr/bin/env python3
"""Fetch Casey OSM foot network (Overpass) and join Casey T1EAM scores."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import geopandas as gpd
import httpx
import numpy as np
from shapely import make_valid
from shapely.geometry import LineString, Point
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from paths import (  # noqa: E402
    LGA_BOUNDARY,
    OSM_CROSSINGS,
    OSM_JOINED,
    OSM_WAYS,
    SCORES_EXPORT,
    ensure_bakeoff_dirs,
)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USER_AGENT = "YourWalkBakeoff/0.1 (CrowdLab; casey-pilot)"
# Prefer foot-first classes; add carriageways in a second pass
HIGHWAY_GROUPS = [
    "footway|path|pedestrian|steps|cycleway|track",
    "living_street|residential|service|unclassified",
    "tertiary|secondary|primary",
]


def lga_bbox() -> tuple[float, float, float, float]:
    """Return (south, west, north, east) for Overpass."""
    gdf = gpd.read_file(LGA_BOUNDARY)
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    else:
        gdf = gdf.to_crs(4326)
    minx, miny, maxx, maxy = gdf.total_bounds
    pad = 0.005
    return (miny - pad, minx - pad, maxy + pad, maxx + pad)


def overpass_query(
    south: float, west: float, north: float, east: float, highways: str
) -> str:
    return f"""
[out:json][timeout:240];
(
  way["highway"~"^({highways})$"]({south},{west},{north},{east});
);
out body geom;
""".strip()


def overpass_crossing_query(
    south: float, west: float, north: float, east: float
) -> str:
    """Node-tagged pedestrian crossings (often not mapped as footway ways)."""
    return f"""
[out:json][timeout:180];
(
  node["highway"="crossing"]({south},{west},{north},{east});
  node["crossing"]({south},{west},{north},{east});
  node["footway"="crossing"]({south},{west},{north},{east});
);
out body;
""".strip()


def _parse_ways(payload: dict) -> list[dict]:
    rows: list[dict] = []
    for el in payload.get("elements", []):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        coords = [(p["lon"], p["lat"]) for p in geom]
        tags = el.get("tags") or {}
        rows.append(
            {
                "osm_id": el["id"],
                "highway": tags.get("highway"),
                "name": tags.get("name"),
                "foot": tags.get("foot"),
                "geometry": LineString(coords),
            }
        )
    return rows


def _parse_crossing_nodes(payload: dict) -> list[dict]:
    rows: list[dict] = []
    seen: set[int] = set()
    for el in payload.get("elements", []):
        if el.get("type") != "node":
            continue
        nid = el.get("id")
        if nid in seen:
            continue
        lon, lat = el.get("lon"), el.get("lat")
        if lon is None or lat is None:
            continue
        tags = el.get("tags") or {}
        seen.add(int(nid))
        rows.append(
            {
                "osm_id": int(nid),
                "highway": tags.get("highway"),
                "crossing": tags.get("crossing"),
                "footway": tags.get("footway"),
                "crossing_ref": tags.get("crossing_ref"),
                "geometry": Point(float(lon), float(lat)),
            }
        )
    return rows


def fetch_osm_crossing_nodes(
    *, bbox: tuple[float, float, float, float] | None = None
) -> gpd.GeoDataFrame:
    """Fetch node-tagged OSM crossings for graph-build synthesis.

    Routing connectivity only — not a scoring input (methodology v1.1
    still treats general crossings as a Council-data gap).
    """
    south, west, north, east = bbox or lga_bbox()
    print(
        f"Overpass crossings bbox S/W → N/E: {south:.4f},{west:.4f} → {north:.4f},{east:.4f}"
    )
    headers = {"User-Agent": USER_AGENT}
    q = overpass_crossing_query(south, west, north, east)
    last_err: Exception | None = None
    payload = None
    with httpx.Client(timeout=180.0, headers=headers) as client:
        for url in OVERPASS_ENDPOINTS:
            try:
                print(f"  query crossing nodes via {url.split('/')[2]}")
                r = client.post(url, data={"data": q})
                if r.status_code == 429 or r.status_code >= 500:
                    last_err = httpx.HTTPStatusError(
                        f"{r.status_code}", request=r.request, response=r
                    )
                    time.sleep(5)
                    continue
                r.raise_for_status()
                payload = r.json()
                break
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(2)
    if payload is None:
        raise RuntimeError(f"Overpass failed for crossing nodes: {last_err}")
    rows = _parse_crossing_nodes(payload)
    print(f"    +{len(rows)} crossing nodes")
    if not rows:
        return gpd.GeoDataFrame(
            columns=["osm_id", "highway", "crossing", "footway", "crossing_ref", "geometry"],
            crs=4326,
        )
    gdf = gpd.GeoDataFrame(rows, crs=4326)
    if LGA_BOUNDARY.exists() and bbox is None:
        lga = gpd.read_file(LGA_BOUNDARY)
        if lga.crs is None:
            lga = lga.set_crs(4326)
        else:
            lga = lga.to_crs(4326)
        poly = unary_union(lga.geometry).buffer(0.002)
        gdf = gdf[gdf.intersects(poly)].copy()
    return gdf


def fetch_osm_ways(*, bbox: tuple[float, float, float, float] | None = None) -> gpd.GeoDataFrame:
    south, west, north, east = bbox or lga_bbox()
    print(f"Overpass bbox S/W → N/E: {south:.4f},{west:.4f} → {north:.4f},{east:.4f}")
    rows: list[dict] = []
    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(timeout=240.0, headers=headers) as client:
        for group in HIGHWAY_GROUPS:
            q = overpass_query(south, west, north, east, group)
            last_err: Exception | None = None
            payload = None
            for url in OVERPASS_ENDPOINTS:
                try:
                    print(f"  query {group[:24]}… via {url.split('/')[2]}")
                    r = client.post(url, data={"data": q})
                    if r.status_code == 429 or r.status_code >= 500:
                        last_err = httpx.HTTPStatusError(
                            f"{r.status_code}", request=r.request, response=r
                        )
                        time.sleep(5)
                        continue
                    r.raise_for_status()
                    payload = r.json()
                    break
                except Exception as e:  # noqa: BLE001
                    last_err = e
                    time.sleep(2)
            if payload is None:
                raise RuntimeError(f"Overpass failed for {group}: {last_err}")
            chunk = _parse_ways(payload)
            print(f"    +{len(chunk)} ways")
            rows.extend(chunk)
            time.sleep(1.5)

    if not rows:
        raise RuntimeError("Overpass returned no ways — try again later")
    gdf = gpd.GeoDataFrame(rows, crs=4326).drop_duplicates(subset=["osm_id"])
    if LGA_BOUNDARY.exists() and bbox is None:
        lga = gpd.read_file(LGA_BOUNDARY)
        if lga.crs is None:
            lga = lga.set_crs(4326)
        else:
            lga = lga.to_crs(4326)
        poly = unary_union(lga.geometry).buffer(0.002)
        gdf = gdf[gdf.intersects(poly)].copy()
    return gdf


def join_scores(
    osm: gpd.GeoDataFrame,
    scores: gpd.GeoDataFrame,
    *,
    join_buffer_m: float = 12.0,
) -> gpd.GeoDataFrame:
    """Length-weighted mean of nearby T1EAM scores onto each OSM way.

    OSM centerlines rarely intersect T1EAM polygons, so we buffer the way
    by ``join_buffer_m`` and weight by intersection *area* along the buffer.
    Coverage ≈ fraction of way length within buffer of any scored polygon.
    """
    osm_m = osm.to_crs(7855).reset_index(drop=True)
    scores_m = scores.to_crs(7855).reset_index(drop=True)
    scores_m["geometry"] = scores_m.geometry.apply(
        lambda g: make_valid(g) if g is not None and not g.is_empty else g
    )
    sindex = scores_m.sindex

    day_vals: list[float | None] = []
    night_vals: list[float | None] = []
    acc_vals: list[float | None] = []
    coverages: list[float] = []
    lengths: list[float] = []

    n_ways = len(osm_m)
    for wi, geom in enumerate(osm_m.geometry):
        if wi and wi % 5000 == 0:
            print(f"  join progress {wi}/{n_ways}")
        length_m = float(geom.length) if geom is not None and not geom.is_empty else 0.0
        lengths.append(length_m)
        if length_m <= 0 or geom is None or geom.is_empty:
            day_vals.append(None)
            night_vals.append(None)
            acc_vals.append(None)
            coverages.append(0.0)
            continue

        try:
            corridor = geom.buffer(join_buffer_m)
        except Exception:  # noqa: BLE001
            day_vals.append(None)
            night_vals.append(None)
            acc_vals.append(None)
            coverages.append(0.0)
            continue

        cand_idx = list(sindex.intersection(corridor.bounds))
        day_s = night_s = acc_s = 0.0
        day_w = night_w = acc_w = 0.0
        covered_len = 0.0

        for i in cand_idx:
            poly = scores_m.geometry.iloc[i]
            if poly is None or poly.is_empty:
                continue
            try:
                inter = corridor.intersection(poly)
            except Exception:  # noqa: BLE001
                continue
            if inter.is_empty:
                continue
            w = float(inter.area)
            if w <= 0:
                continue
            # Approximate covered length: clip way to buffered poly
            try:
                cl = float(geom.intersection(poly.buffer(join_buffer_m)).length)
                covered_len += cl
            except Exception:  # noqa: BLE001
                pass
            row = scores_m.iloc[i]
            d = row.get("day_index_score")
            n = row.get("night_index_score")
            a = row.get("accessibility_score")
            if d is not None and d == d:
                day_s += float(d) * w
                day_w += w
            if n is not None and n == n:
                night_s += float(n) * w
                night_w += w
            if a is not None and a == a:
                acc_s += float(a) * w
                acc_w += w

        day_vals.append((day_s / day_w) if day_w > 0 else None)
        night_vals.append((night_s / night_w) if night_w > 0 else None)
        acc_vals.append((acc_s / acc_w) if acc_w > 0 else None)
        coverages.append(min(1.0, covered_len / length_m) if length_m > 0 else 0.0)

    out = osm_m.copy()
    out["day_index_score"] = day_vals
    out["night_index_score"] = night_vals
    out["accessibility_score"] = acc_vals
    out["score_coverage"] = coverages
    out["length_m"] = lengths
    return out.to_crs(4326)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--od01-bbox",
        action="store_true",
        help="Smaller bbox around OD-01 (Promenade Reserve) for smoke test",
    )
    parser.add_argument(
        "--reuse-osm",
        action="store_true",
        help=f"Reuse existing {OSM_WAYS.name} (skip Overpass ways)",
    )
    parser.add_argument(
        "--reuse-crossings",
        action="store_true",
        help=f"Reuse existing {OSM_CROSSINGS.name} (skip Overpass nodes)",
    )
    args = parser.parse_args()

    ensure_bakeoff_dirs()
    if not SCORES_EXPORT.exists():
        print("Run export_scores.py first", file=sys.stderr)
        return 1
    if not LGA_BOUNDARY.exists():
        print(f"Missing LGA boundary {LGA_BOUNDARY}", file=sys.stderr)
        return 1

    bbox = None
    if args.od01_bbox:
        # Carranya / Robinswood area + pad for alternate paths
        bbox = (-38.075, 145.290, -38.050, 145.325)

    t0 = time.time()
    if args.reuse_osm and OSM_WAYS.exists():
        print(f"Reusing OSM ways ← {OSM_WAYS}")
        osm = gpd.read_file(OSM_WAYS)
    else:
        print("Fetching OSM ways…")
        osm = fetch_osm_ways(bbox=bbox)
        osm.to_file(OSM_WAYS, driver="GeoJSON")
        print(f"  {len(osm)} ways → {OSM_WAYS}")

    if args.reuse_crossings and OSM_CROSSINGS.exists():
        print(f"Reusing crossing nodes ← {OSM_CROSSINGS}")
    else:
        print("Fetching OSM crossing nodes…")
        crossings = fetch_osm_crossing_nodes(bbox=bbox)
        crossings.to_file(OSM_CROSSINGS, driver="GeoJSON")
        print(f"  {len(crossings)} crossing nodes → {OSM_CROSSINGS}")

    scores = gpd.read_file(SCORES_EXPORT)
    if bbox is not None:
        south, west, north, east = bbox
        scores = scores.cx[west:east, south:north].copy()
        print(f"  clipped scores to OD-01 bbox: {len(scores)}")
    print(f"Joining {len(scores)} score polygons…")
    joined = join_scores(osm, scores)
    joined.to_file(OSM_JOINED, driver="GeoJSON")
    covered = joined["score_coverage"].fillna(0)
    day_mean = joined["day_index_score"].dropna().mean()
    print(
        f"  {len(joined)} edges → {OSM_JOINED} "
        f"(median coverage {float(np.nanmedian(covered)):.2f}, "
        f"mean day score {float(day_mean) if day_mean == day_mean else float('nan'):.1f})"
    )
    print(f"Done in {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
