#!/usr/bin/env python3
"""Build an undirected score-aware walk graph from joined OSM edges."""

from __future__ import annotations

import pickle
import sys
from math import hypot
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
from shapely.geometry import LineString, Point

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from paths import GRAPH_PICKLE, OSM_CROSSINGS, OSM_JOINED, ensure_bakeoff_dirs  # noqa: E402

# Node snap tolerance in degrees (~3–4 m at Casey)
NODE_DECIMALS = 5
# Soft detour policy used by challenger (vs pure distance path)
MAX_DETOUR = 1.15
# When "Prefer away from roads" is on — admits park/trail options (~40% OD-12)
MAX_DETOUR_AWAY = 1.6
# Complementary Casey card: the other pathish corridor (invert stream, no prefix penalty)
MAX_DETOUR_COMPLEMENT = 1.20
# Pathish pref paths may exceed the 1.15 junk cap up to this (OD-12 Bellevue 1.18×)
MAX_DETOUR_PATHISH = 1.20
PATHISH_KEEP_MIN_SHARE = 0.70
# Connect sidewalk nodes to a node-tagged crossing within this radius
CROSSING_CONNECT_M = 22.0
CROSSING_MAX_EDGES = 6

# Path / trail classes — no extra per-metre cost (and cheap when prefer-away)
PATHISH_HIGHWAYS = frozenset(
    {
        "footway",
        "path",
        "pedestrian",
        "steps",
        "corridor",
        "bridleway",
        "track",
        "cycleway",
        "crossing",
    }
)
# Mild: walkable cut-throughs (OD-11 service) — do not punish like carriageways
MILD_ROAD_MULT = 1.25
# Parallel footpath must beat these (13% longer sidewalk vs 1.75× road → footpath wins)
ROAD_COST_MULT: dict[str, float] = {
    "living_street": MILD_ROAD_MULT,
    "service": MILD_ROAD_MULT,
    "residential": 1.75,
    "unclassified": 1.75,
    "tertiary": 1.85,
    "tertiary_link": 1.85,
    "secondary": 2.0,
    "secondary_link": 2.0,
    "primary": 2.0,
    "primary_link": 2.0,
    "trunk": 2.0,
    "trunk_link": 2.0,
    "motorway": 3.0,
    "motorway_link": 3.0,
}
DEFAULT_ROAD_MULT = 1.6
# Stronger bias when the resident asked for paths away from roads.
# Sidewalks (footway) still sit on the street edge — trails / cycleways win.
AWAY_TRAIL_HIGHWAYS = frozenset(
    {"path", "cycleway", "track", "bridleway", "pedestrian"}
)
AWAY_TRAIL_MULT = 0.75
AWAY_FOOTWAY_MULT = 1.45
AWAY_CROSSING_MULT = 0.85
AWAY_ROAD_COST_MULT: dict[str, float] = {
    "living_street": 1.5,
    "service": 1.5,
    "residential": 2.5,
    "unclassified": 2.5,
    "tertiary": 2.8,
    "tertiary_link": 2.8,
    "secondary": 3.0,
    "secondary_link": 3.0,
    "primary": 3.0,
    "primary_link": 3.0,
    "trunk": 3.0,
    "trunk_link": 3.0,
    "motorway": 4.0,
    "motorway_link": 4.0,
}
AWAY_DEFAULT_ROAD_MULT = 2.4


def node_key(x: float, y: float) -> tuple[float, float]:
    return (round(x, NODE_DECIMALS), round(y, NODE_DECIMALS))


def norm_highway(hw: object) -> str:
    if hw is None:
        return "unknown"
    if isinstance(hw, (list, tuple)):
        hw = hw[0] if hw else "unknown"
    return str(hw).split(";")[0].strip().lower() or "unknown"


def highway_cost_mult(highway: object, *, prefer_away: bool = False) -> float:
    """Per-metre class bias so a parallel footpath always beats a road way.

    Roads stay routable where no footpath exists (Casey growth-area gaps).
    ``prefer_away`` is the generation-time "Prefer away from roads" switch.
    """
    hw = norm_highway(highway)
    if prefer_away:
        if hw in AWAY_TRAIL_HIGHWAYS:
            return AWAY_TRAIL_MULT
        if hw == "crossing":
            return AWAY_CROSSING_MULT
        if hw in {"footway", "steps", "corridor"}:
            return AWAY_FOOTWAY_MULT
        return AWAY_ROAD_COST_MULT.get(hw, AWAY_DEFAULT_ROAD_MULT)
    if hw in PATHISH_HIGHWAYS:
        return 1.0
    return ROAD_COST_MULT.get(hw, DEFAULT_ROAD_MULT)


def _norm_score(score: float | None, p10: float, p90: float) -> float:
    """Map raw 0–100 score into 0–1 using network percentiles (equal bite day/night)."""
    if score is None or score != score:
        return 0.5
    span = max(1e-6, p90 - p10)
    return float(np.clip((float(score) - p10) / span, 0.0, 1.0))


def edge_cost(
    length_m: float,
    score: float | None,
    *,
    p10: float,
    p90: float,
    quality_swing: float = 1.0,
    highway: object = None,
    prefer_away: bool = False,
) -> float:
    """Higher Casey score → lower cost.

    Uses percentile-normalised scores so Night (compressed high band) and Day
    (wider mid band) get similar cost dynamic range. Soft bounds only.
    Road-class edges pay an extra per-metre multiplier so a parallel footpath
    wins even when it is a little longer (OD-12 Homestead sidewalk vs road).
    """
    s_norm = _norm_score(score, p10, p90)
    # s_norm 0 → ×(1 + swing/2); s_norm 1 → ×(1 - swing/2)
    # swing=1.0 → ×1.5 … ×0.5
    mult = 1.0 + quality_swing * (0.5 - s_norm)
    return max(1.0, length_m) * mult * highway_cost_mult(
        highway, prefer_away=prefer_away
    )


def derive_heat_shade(
    day: float | None,
    acc: float | None,
) -> float | None:
    """Heat & Shade stream from Day Index = 0.6×Acc + 0.4×Heat (v1.1)."""
    if day is None or acc is None:
        return None
    heat = (float(day) - 0.6 * float(acc)) / 0.4
    if heat != heat:
        return None
    return float(max(0.0, min(100.0, heat)))


def _finite(val: object) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if f != f:
        return None
    return f


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


_NODE_TREE = None
_NODE_LIST: list[tuple[float, float]] | None = None


def _ensure_node_index(g: nx.Graph) -> None:
    global _NODE_TREE, _NODE_LIST
    if _NODE_TREE is not None and _NODE_LIST is not None:
        return
    from shapely import STRtree

    _NODE_LIST = list(g.nodes())
    pts = [Point(n[0], n[1]) for n in _NODE_LIST]
    _NODE_TREE = STRtree(pts)


def nearest_node(g: nx.Graph, lng: float, lat: float) -> tuple[float, float]:
    _ensure_node_index(g)
    assert _NODE_TREE is not None and _NODE_LIST is not None
    idx = _NODE_TREE.nearest(Point(lng, lat))
    if hasattr(idx, "__iter__"):
        idx = int(list(idx)[0])
    else:
        idx = int(idx)
    return _NODE_LIST[idx]


def reset_node_index() -> None:
    global _NODE_TREE, _NODE_LIST
    _NODE_TREE = None
    _NODE_LIST = None


def main() -> int:
    ensure_bakeoff_dirs()
    if not OSM_JOINED.exists():
        print("Run fetch_and_join_osm.py first", file=sys.stderr)
        return 1
    edges = gpd.read_file(OSM_JOINED)
    g = build_graph(edges)
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
