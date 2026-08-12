"""Score-aware challenger pathfinding (OSM + Casey Dijkstra).

Shared by the bake-off harness and the local HTTP service used by the web app.
"""

from __future__ import annotations

import math
import pickle
from typing import Any

import networkx as nx
from shapely.geometry import LineString, mapping

from build_graph import MAX_DETOUR, nearest_node, reset_node_index
from paths import GRAPH_PICKLE

_GRAPH: nx.Graph | None = None

# Length-weighted OSM classes treated as walkable / not mid-carriageway for
# challenger merge (P1). Includes service + cycleway cut-throughs (OD-11).
# Mapbox Streets tilequery often labels these as "road" and false-rejects.
OSM_PATHISH_HIGHWAYS = frozenset(
    {
        "footway",
        "path",
        "pedestrian",
        "steps",
        "corridor",
        "bridleway",
        "track",
        "cycleway",
        "service",
        "living_street",
    }
)


def _norm_highway(hw: Any) -> str:
    if hw is None:
        return "unknown"
    if isinstance(hw, (list, tuple)):
        hw = hw[0] if hw else "unknown"
    return str(hw).split(";")[0].strip().lower() or "unknown"


def load_graph(*, force: bool = False) -> nx.Graph:
    global _GRAPH
    if _GRAPH is not None and not force:
        return _GRAPH
    if not GRAPH_PICKLE.exists():
        raise FileNotFoundError(
            f"Missing graph pickle {GRAPH_PICKLE}. "
            "Run: export_scores → fetch_and_join_osm → build_graph"
        )
    reset_node_index()
    _GRAPH = pickle.loads(GRAPH_PICKLE.read_bytes())
    return _GRAPH


def _dist2(p: tuple[float, float], q: tuple[float, float]) -> float:
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2


def _near(
    p: tuple[float, float],
    q: tuple[float, float],
    *,
    eps: float = 1e-5,
) -> bool:
    """~1 m at Casey latitudes when comparing rounded graph nodes to raw OSM verts."""
    return abs(p[0] - q[0]) <= eps and abs(p[1] - q[1]) <= eps


def path_to_route(
    g: nx.Graph,
    path: list,
    *,
    strategy: str,
) -> dict[str, Any] | None:
    """Stitch edge geometries along a node path.

    Each undirected edge stores a LineString that may run either a→b or b→a.
    Older stitching used exact coordinate equality and often appended the full
    edge backwards, which drew scribble / out-and-back zigzags (OD-11).
    """
    coords: list[tuple[float, float]] = []
    length_m = 0.0
    highway_m: dict[str, float] = {}
    for a, b in zip(path, path[1:]):
        data = g.edges[a, b]
        seg_m = float(data.get("length_m") or 0)
        length_m += seg_m
        hw = _norm_highway(data.get("highway"))
        highway_m[hw] = highway_m.get(hw, 0.0) + seg_m
        geom = data.get("geometry")
        if geom is None:
            seg: list[tuple[float, float]] = [a, b]
        else:
            c = [(float(x), float(y)) for x, y in geom.coords]
            # Orient so the segment runs with the path (a → b)
            if _dist2(c[0], a) > _dist2(c[-1], a):
                c = list(reversed(c))
            seg = c

        if not coords:
            coords.extend(seg)
            continue
        if _near(coords[-1], seg[0]):
            coords.extend(seg[1:])
        else:
            # Rare topology snap miss — still follow path direction
            coords.append(seg[0])
            coords.extend(seg[1:])

    if len(coords) < 2:
        return None
    return {
        "geometry": LineString(coords),
        "distance_m": length_m,
        "duration_s": length_m / 1.3,
        "strategy": strategy,
        "engine": "osm_casey_dijkstra",
        "osm_highway_m": highway_m,
    }


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Approximate metres between [lng, lat] points."""
    lng1, lat1 = a
    lng2, lat2 = b
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    h = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    )
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def attach_pins(
    route: dict[str, Any] | None,
    origin: list[float],
    dest: list[float],
) -> dict[str, Any] | None:
    """Extend network path so the drawn line meets the origin/destination pins.

    Dijkstra snaps to nearest graph nodes; without stubs the map shows a gap
    between the cul-de-sac path and the address pin (OD-11 QA).
    """
    if route is None:
        return None
    geom = route["geometry"]
    if geom is None or geom.is_empty:
        return route
    coords = [(float(x), float(y)) for x, y in geom.coords]
    o = (float(origin[0]), float(origin[1]))
    d = (float(dest[0]), float(dest[1]))
    extra = 0.0
    if not _near(coords[0], o, eps=1e-6):
        extra += _haversine_m(o, coords[0])
        coords = [o, *coords]
    if not _near(coords[-1], d, eps=1e-6):
        extra += _haversine_m(coords[-1], d)
        coords = [*coords, d]
    if extra <= 0:
        return route
    length_m = float(route["distance_m"]) + extra
    out = dict(route)
    out["geometry"] = LineString(coords)
    out["distance_m"] = length_m
    out["duration_s"] = length_m / 1.3
    out["pin_stub_m"] = round(extra, 1)
    return out


def challenger_route(
    g: nx.Graph,
    origin: list[float],
    dest: list[float],
    *,
    mode: str = "day",
) -> dict[str, Any] | None:
    """Score-aware path with soft detour cap vs pure distance (OD-05)."""
    weight = "cost_day" if mode == "day" else "cost_night"
    u = nearest_node(g, origin[0], origin[1])
    v = nearest_node(g, dest[0], dest[1])
    try:
        path_score = nx.shortest_path(g, u, v, weight=weight)
        path_dist = nx.shortest_path(g, u, v, weight="cost_distance")
    except nx.NetworkXNoPath:
        return None

    scored = attach_pins(
        path_to_route(g, path_score, strategy=f"score_aware_{mode}"),
        origin,
        dest,
    )
    shortest = attach_pins(
        path_to_route(g, path_dist, strategy=f"distance_{mode}"),
        origin,
        dest,
    )
    if scored is None:
        return shortest
    if shortest is None:
        return scored

    # Detour vs graph path before pin stubs would also work; stubs are tiny.
    # Compare network portions via geometry without stubs if pin_stub present —
    # length_m already includes stubs equally on both, so ratio stays fair.
    detour = scored["distance_m"] / max(shortest["distance_m"], 1.0)
    max_detour = float(g.graph.get("max_detour", MAX_DETOUR))
    if detour > max_detour:
        shortest["strategy"] = f"score_aware_{mode}_capped"
        shortest["capped_from_detour"] = round(detour, 3)
        return shortest
    scored["detour_vs_graph_shortest"] = round(detour, 3)
    return scored


def route_to_json(route: dict[str, Any]) -> dict[str, Any]:
    """Serialize a challenger route for HTTP / Next.js."""
    geom = route["geometry"]
    highway_m = {
        str(k): round(float(v), 1)
        for k, v in (route.get("osm_highway_m") or {}).items()
    }
    total = sum(highway_m.values())
    pathish = sum(
        v for k, v in highway_m.items() if k in OSM_PATHISH_HIGHWAYS
    )
    pathish_share = round(pathish / total, 3) if total > 0 else None
    return {
        "engine": route.get("engine", "osm_casey_dijkstra"),
        "strategy": route.get("strategy", "score_aware"),
        "distance_m": round(float(route["distance_m"]), 1),
        "duration_s": round(float(route["duration_s"]), 1),
        "geometry": mapping(geom),
        "detour_vs_graph_shortest": route.get("detour_vs_graph_shortest"),
        "capped_from_detour": route.get("capped_from_detour"),
        "pin_stub_m": route.get("pin_stub_m"),
        "osm_highway_m": highway_m,
        "osm_pathish_share": pathish_share,
    }


def plan_challenger(
    origin_lng: float,
    origin_lat: float,
    dest_lng: float,
    dest_lat: float,
    *,
    mode: str = "day",
) -> dict[str, Any] | None:
    g = load_graph()
    route = challenger_route(
        g,
        [origin_lng, origin_lat],
        [dest_lng, dest_lat],
        mode=mode if mode in ("day", "night") else "day",
    )
    if route is None:
        return None
    return route_to_json(route)
