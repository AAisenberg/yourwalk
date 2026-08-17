#!/usr/bin/env python3
"""Export walkable-network centrelines for the resident map underlay.

The resident day/night map used to draw the raw T1EAM pavement polygons,
which read as "shards" at street zooms. This exports the graph's pathish
edges (including ADR-011 sidewalk edges, whose geometry is already offset
to the pavement side) as merged lines — one artefact powers a clean
line-based underlay and stays consistent with what routing actually uses.

Sidewalk edges are welded per OSM way using the original centreline node
topology (their offset endpoints do not coincide at bends), averaging the
offset joints so chains draw as one smooth polyline.

OSM footways tagged footway=sidewalk are reclassified hw="sidewalk" and
footway=crossing stubs are dropped (the graph strips those subtags, so the
id sets come from a cached Overpass query — see osm_footway_subtags.json).
Many Casey sidewalks are mapped as bare highway=footway with no subtag, so
a geometric test also reclassifies footways that hug a road centreline
(>= 70% of samples within 12 m). The map hides hw="sidewalk", showing only
genuine off-road paths; sidewalk lines ringing every block read as hollow
polygons (17 Aug QA).

Output: pipeline/data/bakeoff/casey_paths_underlay.geojson
Host:   GitHub release map-data-v1 (see web /api/map-data proxy).
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString
from shapely.ops import linemerge
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from graph_runtime import PATHISH_HIGHWAYS, norm_highway  # noqa: E402
from paths import BAKEOFF_DATA, GRAPH_PICKLE  # noqa: E402

OUT = BAKEOFF_DATA / "casey_paths_underlay.geojson"
# Crossings are 5-20 m connector stubs — noise at underlay zooms.
SKIP = {"crossing"}
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
# ~1.1 m — plenty under the 4.5 m sidewalk offset, halves coordinate bytes.
COORD_DECIMALS = 5

Node = tuple[float, float]
SwEdge = tuple[Node, Node, list[tuple[float, float]]]


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


def _weld_sidewalk_chains(edges: list[SwEdge]) -> list[list[tuple[float, float]]]:
    """Chain sidewalk edges via centreline topology; average offset joints."""
    adj: dict[Node, list[int]] = {}
    for i, (u, v, _) in enumerate(edges):
        adj.setdefault(u, []).append(i)
        adj.setdefault(v, []).append(i)

    used: set[int] = set()
    chains: list[list[int]] = []

    def walk(start: Node, first: int) -> list[int]:
        chain = [first]
        used.add(first)
        u, v, _ = edges[first]
        cur = v if u == start else u
        while len(adj.get(cur, [])) == 2:
            nxt = [j for j in adj[cur] if j not in used]
            if not nxt:
                break
            j = nxt[0]
            used.add(j)
            chain.append(j)
            uu, vv, _ = edges[j]
            cur = vv if uu == cur else uu
        return chain

    for n, incident in adj.items():
        if len(incident) == 2:
            continue
        for i in incident:
            if i not in used:
                chains.append(walk(n, i))
    for i in range(len(edges)):  # pure rings
        if i not in used:
            u, _, _ = edges[i]
            chains.append(walk(u, i))

    out: list[list[tuple[float, float]]] = []
    for chain in chains:
        # Orient each edge's offset segment along the walk, then join with
        # midpoints so bend gaps between offset segments disappear.
        first_u, first_v, _ = edges[chain[0]]
        if len(chain) > 1:
            nu, nv, _ = edges[chain[1]]
            prev = first_v if first_v in (nu, nv) else first_u
            start = first_u if prev == first_v else first_v
        else:
            start, prev = first_u, first_v
        coords: list[tuple[float, float]] = []
        cur = start
        pending: tuple[float, float] | None = None
        for i in chain:
            u, v, seg = edges[i]
            a, b = seg[0], seg[-1]
            if u != cur:
                a, b = b, a
                cur = u
            else:
                cur = v
            if pending is None:
                coords.append(a)
            else:
                coords.append(((pending[0] + a[0]) / 2, (pending[1] + a[1]) / 2))
            pending = b
        if pending is not None:
            coords.append(pending)
        if len(coords) >= 2:
            out.append(coords)
    return out


def main() -> int:
    g = pickle.loads(GRAPH_PICKLE.read_bytes())

    subtags = json.loads(FOOTWAY_SUBTAGS.read_text())
    osm_sidewalk_ids = {str(i) for i in subtags.get("sidewalk", [])}
    osm_crossing_ids = {str(i) for i in subtags.get("crossing", [])}

    plain: dict[tuple[object, str], list[LineString]] = {}
    sidewalks: dict[object, list[SwEdge]] = {}
    n_reclass = n_crossing_skip = 0
    for u, v, d in g.edges(data=True):
        hw = norm_highway(d.get("highway"))
        if hw not in PATHISH_HIGHWAYS or hw in SKIP:
            continue
        if d.get("synthetic_crossing"):
            continue
        osm_id = d.get("osm_id")
        if hw == "footway":
            if str(osm_id) in osm_crossing_ids:
                n_crossing_skip += 1
                continue
            if str(osm_id) in osm_sidewalk_ids:
                hw = "sidewalk-osm"  # true geometry; no offset welding
                n_reclass += 1
        geom = d.get("geometry") or LineString([u, v])
        if hw == "sidewalk":
            seg = [(float(x), float(y)) for x, y in geom.coords]
            sidewalks.setdefault(osm_id, []).append((u, v, seg))
        else:
            plain.setdefault((osm_id, hw), []).append(geom)

    features = []

    def emit(coords_list: list[tuple[float, float]], hw: str) -> None:
        coords = [
            [round(x, COORD_DECIMALS), round(y, COORD_DECIMALS)]
            for x, y in coords_list
        ]
        if len(coords) < 2:
            return
        features.append(
            {
                "type": "Feature",
                "properties": {"hw": hw},
                "geometry": {"type": "LineString", "coordinates": coords},
            }
        )

    # Road proxies for the untagged-sidewalk test: true road edges plus
    # ADR-011 offsets (which replaced the road centreline where converted).
    road_geoms = []
    for u, v, d in g.edges(data=True):
        if d.get("synthetic_crossing"):
            continue
        hw = norm_highway(d.get("highway"))
        if hw not in PATHISH_HIGHWAYS or d.get("sidewalk_of"):
            road_geoms.append(d.get("geometry") or LineString([u, v]))
    roads_m = gpd.GeoSeries(road_geoms, crs="EPSG:4326").to_crs("EPSG:7855").values
    road_tree = STRtree(roads_m)

    footway_parts: list[LineString] = []
    for (_, hw), lines in plain.items():
        merged = linemerge(lines) if len(lines) > 1 else lines[0]
        parts = merged.geoms if merged.geom_type == "MultiLineString" else [merged]
        for part in parts:
            if hw == "footway":
                footway_parts.append(part)
            else:
                emit(list(part.coords), "sidewalk" if hw == "sidewalk-osm" else hw)

    n_geo = 0
    if footway_parts:
        footways_m = (
            gpd.GeoSeries(footway_parts, crs="EPSG:4326").to_crs("EPSG:7855").values
        )
        for part, line_m in zip(footway_parts, footways_m):
            if _sidewalkish(line_m, road_tree, roads_m):
                n_geo += 1
                emit(list(part.coords), "sidewalk")
            else:
                emit(list(part.coords), "footway")

    n_sw = 0
    for _, sw_edges in sidewalks.items():
        for coords in _weld_sidewalk_chains(sw_edges):
            emit(coords, "sidewalk")
            n_sw += 1

    OUT.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            separators=(",", ":"),
        )
    )
    size_mb = OUT.stat().st_size / 1e6
    print(
        f"{len(features)} lines ({n_sw} welded sidewalk chains, "
        f"{n_reclass} tag-reclassified + {n_geo} geometry-reclassified "
        f"footway sidewalks, {n_crossing_skip} crossing edges dropped) "
        f"→ {OUT} ({size_mb:.1f} MB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
