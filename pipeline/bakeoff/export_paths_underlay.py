#!/usr/bin/env python3
"""Export off-road walking centrelines for the resident map underlay.

The resident map draws this artefact as the always-visible "paths" layer
(park links, reserves, laneways, shared paths). Street-zoom pavement
detail comes from the T1EAM polygons the client already holds for
scoring, drawn as a quiet fill from z15.5 — derived sidewalk lines were
messy at roundabouts and crossings (17 Aug QA) and are not exported.

Classification (graph strips footway subtags, so Overpass id sets are
cached in osm_footway_subtags.json):
- footway=crossing ways and ADR-011 sidewalk edges: never exported
- footway=sidewalk ways: hidden
- untagged road-hugging footways (>= 70% of samples within 12 m of a
  road centreline or ADR-011 offset): hidden
- crossing links (footways <= 35 m that intersect a true road
  centreline, e.g. roundabout splitter-island diagonals): dropped
- rescue: hidden footways <= 60 m that share an endpoint with a shown
  part are re-shown, so path tails still reach the street (Hilltop
  Close dead-end, 17 Aug QA)

Geometry is simplified ~1.3 m — visual underlay only, calms zigzaggy
OSM ways.

The FeatureCollection also carries a foreign member
`path_covered_segment_ids`: T1EAM segment polygons whose pavement is
already drawn as a path line here. The client skips these in the
street-zoom pavement fill so lines and fill never double-draw
(17 Aug QA), while T1EAM-only park paths OSM lacks still get a fill.

Output: pipeline/data/bakeoff/casey_paths_underlay.geojson
Host:   GitHub release map-data-v1 (see web /api/map-data proxy).
Local:  symlink into web/public/map-data/ (see yourwalk-local-dev skill).
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, shape
from shapely.ops import linemerge
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from graph_runtime import PATHISH_HIGHWAYS, norm_highway  # noqa: E402
from paths import BAKEOFF_DATA, GRAPH_PICKLE  # noqa: E402

OUT = BAKEOFF_DATA / "casey_paths_underlay.geojson"
# Crossings are 5-20 m connector stubs — noise at underlay zooms.
SKIP = {"crossing", "sidewalk"}
# Cached Overpass ids: {"sidewalk": [way ids], "crossing": [way ids]}.
# Refresh: way["highway"="footway"]["footway"~"sidewalk|crossing"] in the
# Casey bbox (-38.25,145.15,-37.95,145.60), out ids tags.
FOOTWAY_SUBTAGS = BAKEOFF_DATA / "osm_footway_subtags.json"
# Untagged-sidewalk heuristic: footway samples within this of a road
# centreline count as road-hugging; the line is a sidewalk when the
# road-hugging share reaches SIDEWALKISH_SHARE.
SIDEWALKISH_DIST_M = 12.0
SIDEWALKISH_SHARE = 0.7
SAMPLE_STEP_M = 12.0
# Short footways that cut across a carriageway are crossing links.
CROSSLINK_MAX_M = 35.0
# Hidden footways up to this long are re-shown when they continue a
# visible path, keeping tails connected to the street.
RESCUE_MAX_M = 60.0
# ~1.3 m simplify + 5-decimal rounding — visual underlay only.
SIMPLIFY_DEG = 1.2e-5
COORD_DECIMALS = 5
# T1EAM segment polygons with >= half their outline within this of a
# drawn path line are "covered" — the fill skips them.
COVERED_DIST_M = 8.0
COVERED_SHARE = 0.5
SEGMENTS_GEOJSON = (
    Path(__file__).resolve().parents[1] / "data" / "viewer" / "segment_scores_map.geojson"
)


def _sidewalkish(line_m: LineString, tree: STRtree, roads) -> bool:
    """True when most of a footway (metric CRS) hugs a road centreline."""
    length = line_m.length
    n = max(2, min(60, int(length / SAMPLE_STEP_M) + 1))
    near = 0
    for i in range(n):
        pt = line_m.interpolate(length * i / (n - 1))
        j = int(tree.nearest(pt))
        if roads[j].distance(pt) <= SIDEWALKISH_DIST_M:
            near += 1
    return near / n >= SIDEWALKISH_SHARE


def _endpoints(line: LineString) -> tuple[tuple[float, float], tuple[float, float]]:
    c = line.coords
    return (
        (round(c[0][0], 6), round(c[0][1], 6)),
        (round(c[-1][0], 6), round(c[-1][1], 6)),
    )


def _covered_segment_ids(shown_lines: list[LineString]) -> list:
    """T1EAM segment polygons whose pavement a drawn path line already covers."""
    segs = json.loads(SEGMENTS_GEOJSON.read_text())["features"]
    polys = [shape(f["geometry"]) for f in segs]
    polys_m = gpd.GeoSeries(polys, crs="EPSG:4326").to_crs("EPSG:7855").values
    lines_m = (
        gpd.GeoSeries(shown_lines, crs="EPSG:4326").to_crs("EPSG:7855").values
    )
    tree = STRtree(lines_m)

    covered = []
    for feat, poly_m in zip(segs, polys_m):
        ring = poly_m.exterior if poly_m.geom_type == "Polygon" else None
        if ring is None:
            # MultiPolygon: use the largest part's ring
            biggest = max(poly_m.geoms, key=lambda p: p.area)
            ring = biggest.exterior
        length = ring.length
        n = max(4, min(40, int(length / 15) + 1))
        near = 0
        for i in range(n):
            pt = ring.interpolate(length * i / n)
            j = int(tree.nearest(pt))
            if lines_m[j].distance(pt) <= COVERED_DIST_M:
                near += 1
        if near / n >= COVERED_SHARE:
            covered.append(feat["properties"]["segment_id"])
    return covered


def main() -> int:
    g = pickle.loads(GRAPH_PICKLE.read_bytes())

    subtags = json.loads(FOOTWAY_SUBTAGS.read_text())
    osm_sidewalk_ids = {str(i) for i in subtags.get("sidewalk", [])}
    osm_crossing_ids = {str(i) for i in subtags.get("crossing", [])}

    plain: dict[tuple[object, str], list[LineString]] = {}
    tag_sidewalk: set[tuple[object, str]] = set()
    n_crossing_skip = 0
    for u, v, d in g.edges(data=True):
        hw = norm_highway(d.get("highway"))
        if hw not in PATHISH_HIGHWAYS or hw in SKIP:
            continue
        if d.get("synthetic_crossing"):
            continue
        osm_id = d.get("osm_id")
        if hw == "footway" and str(osm_id) in osm_crossing_ids:
            n_crossing_skip += 1
            continue
        key = (osm_id, hw)
        if hw == "footway" and str(osm_id) in osm_sidewalk_ids:
            tag_sidewalk.add(key)
        plain.setdefault(key, []).append(
            d.get("geometry") or LineString([u, v])
        )

    # Road references. Proximity test includes ADR-011 offsets (they
    # replaced the road centreline where converted); the crossing-link
    # test uses true carriageways only.
    prox_geoms: list[LineString] = []
    true_road_geoms: list[LineString] = []
    for u, v, d in g.edges(data=True):
        if d.get("synthetic_crossing"):
            continue
        hw = norm_highway(d.get("highway"))
        geom = d.get("geometry") or LineString([u, v])
        if hw not in PATHISH_HIGHWAYS:
            prox_geoms.append(geom)
            true_road_geoms.append(geom)
        elif d.get("sidewalk_of"):
            prox_geoms.append(geom)
    prox_m = gpd.GeoSeries(prox_geoms, crs="EPSG:4326").to_crs("EPSG:7855").values
    prox_tree = STRtree(prox_m)
    roads_m = (
        gpd.GeoSeries(true_road_geoms, crs="EPSG:4326").to_crs("EPSG:7855").values
    )
    road_tree = STRtree(roads_m)

    # Merge per way, then classify footway parts.
    shown: list[tuple[LineString, str]] = []
    hidden: list[LineString] = []  # footway parts classified as sidewalk
    n_tag = n_geo = n_crosslink = 0
    footway_parts: list[tuple[LineString, bool]] = []  # (part, tag_hidden)
    for key, lines in plain.items():
        _, hw = key
        merged = linemerge(lines) if len(lines) > 1 else lines[0]
        parts = merged.geoms if merged.geom_type == "MultiLineString" else [merged]
        for part in parts:
            if hw == "footway":
                footway_parts.append((part, key in tag_sidewalk))
            else:
                shown.append((part, hw))

    footways_m = (
        gpd.GeoSeries([p for p, _ in footway_parts], crs="EPSG:4326")
        .to_crs("EPSG:7855")
        .values
        if footway_parts
        else []
    )
    for (part, tag_hidden), line_m in zip(footway_parts, footways_m):
        # Crossing links: short and actually crossing a carriageway —
        # roundabout splitter diagonals, mid-block crossers. Dropped.
        if line_m.length <= CROSSLINK_MAX_M:
            hits = road_tree.query(line_m)
            if any(line_m.intersects(roads_m[j]) for j in hits):
                n_crosslink += 1
                continue
        if tag_hidden:
            n_tag += 1
            hidden.append(part)
        elif _sidewalkish(line_m, prox_tree, prox_m):
            n_geo += 1
            hidden.append(part)
        else:
            shown.append((part, "footway"))

    # Rescue pass: hidden footways that continue a shown part keep path
    # tails connected to the street. Two passes handle short chains.
    n_rescued = 0
    for _ in range(2):
        shown_ends = set()
        for part, _ in shown:
            a, b = _endpoints(part)
            shown_ends.add(a)
            shown_ends.add(b)
        still_hidden: list[LineString] = []
        for part in hidden:
            a, b = _endpoints(part)
            approx_m = part.length * 1.11e5  # degrees → metres, close enough
            if approx_m <= RESCUE_MAX_M and (a in shown_ends or b in shown_ends):
                shown.append((part, "footway"))
                n_rescued += 1
            else:
                still_hidden.append(part)
        hidden = still_hidden

    features = []
    for part, hw in shown:
        simple = part.simplify(SIMPLIFY_DEG, preserve_topology=True)
        coords = [
            [round(x, COORD_DECIMALS), round(y, COORD_DECIMALS)]
            for x, y in simple.coords
        ]
        if len(coords) < 2:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"hw": hw},
                "geometry": {"type": "LineString", "coordinates": coords},
            }
        )

    covered_ids = _covered_segment_ids([p for p, _ in shown])

    OUT.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "path_covered_segment_ids": covered_ids,
                "features": features,
            },
            separators=(",", ":"),
        )
    )
    size_mb = OUT.stat().st_size / 1e6
    print(
        f"{len(features)} lines shown ({n_tag} tag + {n_geo} geometry sidewalks "
        f"hidden, {n_rescued} tails rescued, {n_crosslink} crossing links and "
        f"{n_crossing_skip} tagged crossing edges dropped, "
        f"{len(covered_ids)} T1EAM segments line-covered) "
        f"→ {OUT} ({size_mb:.1f} MB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
