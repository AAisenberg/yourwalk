#!/usr/bin/env python3
"""Build an undirected score-aware walk graph from joined OSM edges."""

from __future__ import annotations

import pickle
import sys
from math import hypot
from pathlib import Path

import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString, Point

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from graph_runtime import (  # noqa: E402
    MAX_DETOUR,
    MAX_DETOUR_AWAY,
    MAX_DETOUR_COMPLEMENT,  # noqa: F401
    MAX_DETOUR_PATHISH,  # noqa: F401
    PATHISH_HIGHWAYS,
    PATHISH_KEEP_MIN_SHARE,  # noqa: F401
    _finite,
    _norm_score,  # noqa: F401
    derive_heat_shade,
    edge_cost,
    highway_cost_mult,  # noqa: F401
    nearest_node,  # noqa: F401
    node_key,
    norm_highway,
    reset_node_index,
)
from paths import (  # noqa: E402
    GRAPH_PICKLE,
    OSM_CROSSINGS,
    OSM_JOINED,
    T1EAM_FOOTPATHS_PLY,
    T1EAM_SHAREDUSE_PLY,
    ensure_bakeoff_dirs,
)

# Connect sidewalk nodes to a node-tagged crossing within this radius
CROSSING_CONNECT_M = 22.0
CROSSING_MAX_EDGES = 6

# --- T1EAM sidewalk-aware conversion (ADR-011) -------------------------------
# OSM Berwick rarely maps residential sidewalks as separate ways, so walking
# routes drew down road centrelines. Where a Casey T1EAM footpath pavement
# polygon runs alongside a road edge, the edge is converted to a "sidewalk":
# footway cost, geometry offset to the pavement side. Roads without Council
# pavement keep their road cost — the only roads a route still uses.
SIDEWALKABLE_HIGHWAYS = frozenset(
    {
        "residential",
        "unclassified",
        "living_street",
        "tertiary",
        "tertiary_link",
        "secondary",
        "secondary_link",
        "primary",
        "primary_link",
    }
)
# Pavement polygon must be within this of the road centreline (typical Casey
# verge: kerb ~3-4 m + nature strip). 12 m also matched 77% of road metres in
# the Hobart Ave audit without pulling in paths across parkland.
SIDEWALK_MATCH_M = 12.0
# Draw offset toward the pavement side. Visual only — length stays the road's.
SIDEWALK_OFFSET_M = 4.5


def build_graph(edges: gpd.GeoDataFrame) -> nx.Graph:
    """Build walk graph from OSM ways.

    Consecutive vertices become nodes so junctions in the middle of a way
    connect to other ways (endpoint-only graphs leave suburbs disconnected).

    Stores Accessibility + Heat & Shade (+ lighting proxy) for preference-weighted
    Dijkstra at request time (PREFS_IN_PATHFINDING P2).
    """
    g = nx.Graph()
    edges_m = edges.to_crs(7855) if edges.crs and edges.crs.to_epsg() != 7855 else edges

    day_s = edges["day_index_score"].dropna()
    night_s = edges["night_index_score"].dropna()
    day_p10, day_p90 = float(day_s.quantile(0.10)), float(day_s.quantile(0.90))
    night_p10, night_p90 = float(night_s.quantile(0.10)), float(night_s.quantile(0.90))

    # Stream percentiles for preference blend (derive heat when column absent)
    if "heat_shade_score" in edges.columns:
        heat_series = edges["heat_shade_score"]
    else:
        heat_series = (
            (edges["day_index_score"] - 0.6 * edges["accessibility_score"]) / 0.4
        ).clip(lower=0.0, upper=100.0)
    acc_s = (
        edges["accessibility_score"].dropna()
        if "accessibility_score" in edges.columns
        else day_s
    )
    heat_s = heat_series.dropna()
    # Lighting stream: prefer explicit column; else Night Index as interim proxy
    if "lighting_after_dark_score" in edges.columns:
        light_series = edges["lighting_after_dark_score"]
    else:
        light_series = edges["night_index_score"]
    light_s = light_series.dropna()

    acc_p10, acc_p90 = float(acc_s.quantile(0.10)), float(acc_s.quantile(0.90))
    heat_p10, heat_p90 = float(heat_s.quantile(0.10)), float(heat_s.quantile(0.90))
    light_p10, light_p90 = float(light_s.quantile(0.10)), float(light_s.quantile(0.90))
    print(
        f"Cost percentiles: day {day_p10:.1f}/{day_p90:.1f} "
        f"night {night_p10:.1f}/{night_p90:.1f} "
        f"acc {acc_p10:.1f}/{acc_p90:.1f} "
        f"heat {heat_p10:.1f}/{heat_p90:.1f} "
        f"light {light_p10:.1f}/{light_p90:.1f}"
    )

    for idx, row in edges.iterrows():
        geom = row.geometry
        geom_m = edges_m.loc[idx].geometry
        if geom is None or geom.is_empty or geom.geom_type != "LineString":
            continue
        coords = list(geom.coords)
        coords_m = list(geom_m.coords)
        if len(coords) < 2:
            continue

        day_f = _finite(row.get("day_index_score"))
        night_f = _finite(row.get("night_index_score"))
        acc_f = _finite(row.get("accessibility_score"))
        heat_f = _finite(row.get("heat_shade_score"))
        if heat_f is None:
            heat_f = derive_heat_shade(day_f, acc_f)
        light_f = _finite(row.get("lighting_after_dark_score"))
        if light_f is None:
            light_f = night_f  # interim until joined lighting stream
        cov = float(row.get("score_coverage") or 0)
        osm_id = int(row["osm_id"]) if row.get("osm_id") == row.get("osm_id") else None

        for i in range(len(coords) - 1):
            u = node_key(*coords[i])
            v = node_key(*coords[i + 1])
            if u == v:
                continue
            dx = coords_m[i + 1][0] - coords_m[i][0]
            dy = coords_m[i + 1][1] - coords_m[i][1]
            length_m = max(1.0, hypot(dx, dy))
            seg = LineString([coords[i], coords[i + 1]])
            attrs = {
                "length_m": length_m,
                "day_index_score": day_f,
                "night_index_score": night_f,
                "accessibility_score": acc_f,
                "heat_shade_score": heat_f,
                "lighting_after_dark_score": light_f,
                "score_coverage": cov,
                "osm_id": osm_id,
                "highway": row.get("highway"),
                "geometry": seg,
                "cost_day": edge_cost(
                    length_m, day_f, p10=day_p10, p90=day_p90, highway=row.get("highway")
                ),
                "cost_night": edge_cost(
                    length_m,
                    night_f,
                    p10=night_p10,
                    p90=night_p90,
                    highway=row.get("highway"),
                ),
                "cost_distance": length_m,
            }
            if g.has_edge(u, v):
                if attrs["cost_day"] < g.edges[u, v].get("cost_day", 1e18):
                    g.edges[u, v].update(attrs)
            else:
                g.add_edge(u, v, **attrs)
            g.add_node(u, x=u[0], y=u[1])
            g.add_node(v, x=v[0], y=v[1])

    g.graph["day_p10"] = day_p10
    g.graph["day_p90"] = day_p90
    g.graph["night_p10"] = night_p10
    g.graph["night_p90"] = night_p90
    g.graph["acc_p10"] = acc_p10
    g.graph["acc_p90"] = acc_p90
    g.graph["heat_p10"] = heat_p10
    g.graph["heat_p90"] = heat_p90
    g.graph["light_p10"] = light_p10
    g.graph["light_p90"] = light_p90
    g.graph["max_detour"] = MAX_DETOUR
    g.graph["max_detour_away"] = MAX_DETOUR_AWAY
    g.graph["prefs_pathfinding"] = True
    g.graph["highway_cost_bias"] = True
    return g


def convert_sidewalk_edges(g: nx.Graph) -> int:
    """Convert road edges with a T1EAM pavement alongside into sidewalk edges.

    Side selection is voted per OSM way (length-weighted) so the drawn line
    stays on one consistent side of a street instead of flipping mid-block —
    residents read a mid-block flip as "crossing where there is no crossing".
    """
    from pyproj import Transformer
    from shapely import STRtree
    from shapely.ops import nearest_points

    geoms = []
    for p in (T1EAM_FOOTPATHS_PLY, T1EAM_SHAREDUSE_PLY):
        if not p.exists():
            continue
        gdf = gpd.read_parquet(p)
        gdf = gdf.to_crs(7855) if gdf.crs and gdf.crs.to_epsg() != 7855 else gdf
        geoms.extend(x for x in gdf.geometry.values if x is not None and not x.is_empty)
    if not geoms:
        print("T1EAM pavement parquet missing — sidewalk conversion skipped")
        return 0
    tree = STRtree(geoms)
    to_m = Transformer.from_crs("EPSG:4326", "EPSG:7855", always_xy=True)
    to_deg = Transformer.from_crs("EPSG:7855", "EPSG:4326", always_xy=True)

    # Pass 1: match road edges to the nearest pavement polygon + side sign.
    hits: list[tuple[dict, float, tuple[float, float], tuple[float, float]]] = []
    votes: dict[int, float] = {}
    for u, v, d in g.edges(data=True):
        if norm_highway(d.get("highway")) not in SIDEWALKABLE_HIGHWAYS:
            continue
        a = to_m.transform(u[0], u[1])
        b = to_m.transform(v[0], v[1])
        line = LineString([a, b])
        try:
            idxs = tree.query(line, predicate="dwithin", distance=SIDEWALK_MATCH_M)
        except TypeError:  # older shapely without dwithin
            idxs = [
                i
                for i in tree.query(line.buffer(SIDEWALK_MATCH_M))
                if geoms[int(i)].distance(line) <= SIDEWALK_MATCH_M
            ]
        best = None
        for i in idxs:
            poly = geoms[int(i)]
            dist = poly.distance(line)
            if dist <= SIDEWALK_MATCH_M and (best is None or dist < best[0]):
                best = (dist, poly)
        if best is None:
            continue
        p_line, p_poly = nearest_points(line, best[1])
        ex, ey = b[0] - a[0], b[1] - a[1]
        cross = ex * (p_poly.y - p_line.y) - ey * (p_poly.x - p_line.x)
        side = 1.0 if cross >= 0 else -1.0
        hits.append((d, side, a, b))
        oid = d.get("osm_id")
        if oid is not None:
            votes[oid] = votes.get(oid, 0.0) + side * float(d.get("length_m") or 1.0)

    # Pass 2: convert, with the way-level side vote deciding the offset.
    day_p10, day_p90 = float(g.graph["day_p10"]), float(g.graph["day_p90"])
    night_p10, night_p90 = float(g.graph["night_p10"]), float(g.graph["night_p90"])
    converted = 0
    for d, side, a, b in hits:
        oid = d.get("osm_id")
        use = side
        if oid is not None and votes.get(oid):
            use = 1.0 if votes[oid] >= 0 else -1.0
        ex, ey = b[0] - a[0], b[1] - a[1]
        length = hypot(ex, ey) or 1.0
        ox, oy = (-ey / length, ex / length) if use >= 0 else (ey / length, -ex / length)
        a2 = to_deg.transform(a[0] + ox * SIDEWALK_OFFSET_M, a[1] + oy * SIDEWALK_OFFSET_M)
        b2 = to_deg.transform(b[0] + ox * SIDEWALK_OFFSET_M, b[1] + oy * SIDEWALK_OFFSET_M)
        d["sidewalk_of"] = norm_highway(d.get("highway"))
        d["highway"] = "sidewalk"
        d["geometry"] = LineString([a2, b2])
        d["cost_day"] = edge_cost(
            float(d.get("length_m") or 1.0),
            d.get("day_index_score"),
            p10=day_p10,
            p90=day_p90,
            highway="sidewalk",
        )
        d["cost_night"] = edge_cost(
            float(d.get("length_m") or 1.0),
            d.get("night_index_score"),
            p10=night_p10,
            p90=night_p90,
            highway="sidewalk",
        )
        converted += 1
    return converted


def _node_has_pathish(g: nx.Graph, n: tuple[float, float]) -> bool:
    for _, _, data in g.edges(n, data=True):
        if norm_highway(data.get("highway")) in PATHISH_HIGHWAYS:
            return True
    return False


def synthesise_crossing_edges(
    g: nx.Graph,
    crossings: gpd.GeoDataFrame,
    *,
    day_p10: float,
    day_p90: float,
    night_p10: float,
    night_p90: float,
) -> int:
    """Add short crossing edges from node-tagged OSM crossings to nearby paths.

    Node-only crossings (highway=crossing / crossing=unmarked) sit on the road
    way and do not connect parallel sidewalks unless we synthesise a link.
    Scores stay unset (neutral length cost) — routing connectivity only.
    """
    if crossings is None or crossings.empty:
        return 0
    from pyproj import Transformer
    from shapely import STRtree

    to_m = Transformer.from_crs("EPSG:4326", "EPSG:7855", always_xy=True)
    node_list = list(g.nodes())
    if not node_list:
        return 0
    pts_m = [Point(*to_m.transform(n[0], n[1])) for n in node_list]
    tree = STRtree(pts_m)

    added = 0
    for _, row in crossings.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        if geom.geom_type != "Point":
            geom = geom.centroid
        lng, lat = float(geom.x), float(geom.y)
        ck = node_key(lng, lat)
        c_m = Point(*to_m.transform(lng, lat))
        if ck not in g:
            g.add_node(ck, x=ck[0], y=ck[1], crossing=True)

        raw_idx = tree.query(c_m.buffer(CROSSING_CONNECT_M))
        candidates: list[tuple[float, tuple[float, float]]] = []
        for idx in raw_idx:
            n = node_list[int(idx)]
            if n == ck:
                continue
            dist = float(c_m.distance(pts_m[int(idx)]))
            if dist > CROSSING_CONNECT_M:
                continue
            if not _node_has_pathish(g, n):
                continue
            candidates.append((dist, n))
        candidates.sort(key=lambda t: t[0])

        osm_id = int(row["osm_id"]) if row.get("osm_id") == row.get("osm_id") else None
        for dist, n in candidates[:CROSSING_MAX_EDGES]:
            if g.has_edge(ck, n):
                # Prefer tagging an existing short link as a crossing if cheaper
                continue
            length_m = max(1.0, dist)
            attrs = {
                "length_m": length_m,
                "day_index_score": None,
                "night_index_score": None,
                "accessibility_score": None,
                "heat_shade_score": None,
                "lighting_after_dark_score": None,
                "score_coverage": 0.0,
                "osm_id": osm_id,
                "highway": "crossing",
                "synthetic_crossing": True,
                "geometry": LineString([ck, n]),
                "cost_day": edge_cost(
                    length_m, None, p10=day_p10, p90=day_p90, highway="crossing"
                ),
                "cost_night": edge_cost(
                    length_m, None, p10=night_p10, p90=night_p90, highway="crossing"
                ),
                "cost_distance": length_m,
            }
            g.add_edge(ck, n, **attrs)
            added += 1
    return added


def load_or_fetch_crossings() -> gpd.GeoDataFrame:
    if OSM_CROSSINGS.exists():
        print(f"Crossing nodes ← {OSM_CROSSINGS}")
        return gpd.read_file(OSM_CROSSINGS)
    from fetch_and_join_osm import fetch_osm_crossing_nodes

    print("Crossing nodes file missing — fetching from Overpass…")
    crossings = fetch_osm_crossing_nodes()
    crossings.to_file(OSM_CROSSINGS, driver="GeoJSON")
    print(f"  {len(crossings)} crossing nodes → {OSM_CROSSINGS}")
    return crossings


def main() -> int:
    ensure_bakeoff_dirs()
    if not OSM_JOINED.exists():
        print("Run fetch_and_join_osm.py first", file=sys.stderr)
        return 1
    edges = gpd.read_file(OSM_JOINED)
    g = build_graph(edges)
    n_side = convert_sidewalk_edges(g)
    print(f"Sidewalk-converted road edges (T1EAM pavement alongside): {n_side}")
    crossings = load_or_fetch_crossings()
    n_cross = synthesise_crossing_edges(
        g,
        crossings,
        day_p10=float(g.graph["day_p10"]),
        day_p90=float(g.graph["day_p90"]),
        night_p10=float(g.graph["night_p10"]),
        night_p90=float(g.graph["night_p90"]),
    )
    print(f"Synthetic crossing edges: {n_cross}")
    reset_node_index()
    GRAPH_PICKLE.write_bytes(pickle.dumps(g, protocol=pickle.HIGHEST_PROTOCOL))
    print(f"Graph: {g.number_of_nodes()} nodes, {g.number_of_edges()} edges → {GRAPH_PICKLE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
