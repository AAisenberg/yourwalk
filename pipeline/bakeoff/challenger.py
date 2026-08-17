"""Score-aware challenger pathfinding (OSM + Casey Dijkstra).

Shared by the bake-off harness and the local HTTP service used by the web app.
"""

from __future__ import annotations

import math
import pickle
from typing import Any

import networkx as nx
from shapely.geometry import LineString, mapping

from graph_runtime import (  # noqa: E402
    MAX_DETOUR,
    MAX_DETOUR_AWAY,
    MAX_DETOUR_COMPLEMENT,
    MAX_DETOUR_PATHISH,
    PATHISH_KEEP_MIN_SHARE,
    _norm_score,
    highway_cost_mult,
    nearest_node,
    norm_highway,
    reset_node_index,
)
from paths import GRAPH_PICKLE

_GRAPH: nx.Graph | None = None

PREF_IMPORTANCE_MIN = 10
PREF_IMPORTANCE_MAX = 100


def clamp_importance(v: object) -> int:
    try:
        n = int(round(float(v)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return PREF_IMPORTANCE_MIN
    return max(PREF_IMPORTANCE_MIN, min(PREF_IMPORTANCE_MAX, n))


def invert_dominant_stream(prefs: dict[str, Any], mode: str) -> dict[str, Any]:
    """Contrast weights: invert the dominant active stream.

    Mid/mid treats shade (day) or lighting (night) as dominant so the
    complement is footpaths-max. No corridor penalty — the other pathish
    walk (e.g. Bellevue vs Homestead) should share a prefix if it needs to.
    Both-sliders-at-floor is *not* the complement.
    """
    if mode == "night":
        w_acc = clamp_importance(prefs.get("accessibility", 60))
        w_light = clamp_importance(prefs.get("afterDark", 40))
        if w_light >= w_acc:
            return {
                "accessibility": PREF_IMPORTANCE_MAX,
                "afterDark": PREF_IMPORTANCE_MIN,
                "shadeHeat": 0,
                "preferSharedPaths": False,
            }
        return {
            "accessibility": PREF_IMPORTANCE_MIN,
            "afterDark": PREF_IMPORTANCE_MAX,
            "shadeHeat": 0,
            "preferSharedPaths": False,
        }
    w_acc = clamp_importance(prefs.get("accessibility", 60))
    w_shade = clamp_importance(prefs.get("shadeHeat", 40))
    if w_shade >= w_acc:
        return {
            "accessibility": PREF_IMPORTANCE_MAX,
            "shadeHeat": PREF_IMPORTANCE_MIN,
            "afterDark": 0,
            "preferSharedPaths": False,
        }
    return {
        "accessibility": PREF_IMPORTANCE_MIN,
        "shadeHeat": PREF_IMPORTANCE_MAX,
        "afterDark": 0,
        "preferSharedPaths": False,
    }


def complement_stream_name(prefs: dict[str, Any], mode: str) -> str:
    """Stream the inverted complement maximises."""
    if mode == "night":
        w_acc = clamp_importance(prefs.get("accessibility", 60))
        w_light = clamp_importance(prefs.get("afterDark", 40))
        return "afterDark" if w_light > w_acc else "accessibility"
    w_acc = clamp_importance(prefs.get("accessibility", 60))
    w_shade = clamp_importance(prefs.get("shadeHeat", 40))
    return "shadeHeat" if w_shade > w_acc else "accessibility"


def preference_edge_weight(
    g: nx.Graph,
    mode: str,
    prefs: dict[str, Any],
    *,
    penalize_edges: set[frozenset[Any]] | None = None,
    penalize_mult: float = 3.0,
):
    """NetworkX weight callable: preference-blended Casey streams → edge cost.

    ``penalize_edges`` (undirected ``frozenset({u, v})``) is used to push a
    second, geometrically distinct away-from-roads path off the default corridor.
    """
    meta = g.graph
    acc_p10 = float(meta.get("acc_p10", meta.get("day_p10", 40)))
    acc_p90 = float(meta.get("acc_p90", meta.get("day_p90", 80)))
    heat_p10 = float(meta.get("heat_p10", meta.get("day_p10", 40)))
    heat_p90 = float(meta.get("heat_p90", meta.get("day_p90", 80)))
    light_p10 = float(meta.get("light_p10", meta.get("night_p10", 50)))
    light_p90 = float(meta.get("light_p90", meta.get("night_p90", 90)))

    prefer_away = bool(prefs.get("preferSharedPaths"))

    if mode == "night":
        w_acc = clamp_importance(prefs.get("accessibility", 60))
        w_light = clamp_importance(prefs.get("afterDark", 40))

        def weight_night(u: Any, v: Any, data: dict[str, Any]) -> float:
            length = max(1.0, float(data.get("length_m") or 1.0))
            hw_mult = highway_cost_mult(data.get("highway"), prefer_away=prefer_away)
            parts: list[tuple[float, int]] = []
            acc = data.get("accessibility_score")
            light = data.get("lighting_after_dark_score")
            if light is None:
                light = data.get("night_index_score")
            if acc is not None and acc == acc:
                parts.append((_norm_score(float(acc), acc_p10, acc_p90), w_acc))
            if light is not None and light == light:
                parts.append(
                    (_norm_score(float(light), light_p10, light_p90), w_light)
                )
            if not parts:
                cost = length * hw_mult
            else:
                s_norm = sum(n * w for n, w in parts) / sum(w for _, w in parts)
                cost = length * (1.0 + (0.5 - s_norm)) * hw_mult
            if penalize_edges and frozenset((u, v)) in penalize_edges:
                cost *= penalize_mult
            return cost

        return weight_night

    w_acc = clamp_importance(prefs.get("accessibility", 60))
    w_shade = clamp_importance(prefs.get("shadeHeat", 40))

    def weight_day(u: Any, v: Any, data: dict[str, Any]) -> float:
        length = max(1.0, float(data.get("length_m") or 1.0))
        hw_mult = highway_cost_mult(data.get("highway"), prefer_away=prefer_away)
        parts: list[tuple[float, int]] = []
        acc = data.get("accessibility_score")
        heat = data.get("heat_shade_score")
        if acc is not None and acc == acc:
            parts.append((_norm_score(float(acc), acc_p10, acc_p90), w_acc))
        if heat is not None and heat == heat:
            parts.append((_norm_score(float(heat), heat_p10, heat_p90), w_shade))
        if not parts:
            cost = length * hw_mult
        else:
            s_norm = sum(n * w for n, w in parts) / sum(w for _, w in parts)
            cost = length * (1.0 + (0.5 - s_norm)) * hw_mult
        if penalize_edges and frozenset((u, v)) in penalize_edges:
            cost *= penalize_mult
        return cost

    return weight_day

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
        "crossing",
        # T1EAM-confirmed sidewalk beside a road (ADR-011, build-time convert)
        "sidewalk",
    }
)


def pathish_share_of(route: dict[str, Any] | None) -> float | None:
    if not route:
        return None
    highway_m = route.get("osm_highway_m") or {}
    total = sum(float(v) for v in highway_m.values())
    if total <= 0:
        return None
    pathish = sum(
        float(v) for k, v in highway_m.items() if k in OSM_PATHISH_HIGHWAYS
    )
    return pathish / total


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
        hw = norm_highway(data.get("highway"))
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
    prefs: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Score-aware path with soft detour cap vs pure distance (OD-05).

    When ``prefs`` is set and the graph has stream attributes, Dijkstra uses
    preference-blended Accessibility + Heat & Shade (day) or Lighting (night).
    """
    want_complement = bool(prefs and prefs.get("complement"))
    # Complement is its own fetch; never mix with the away-from-roads hunt.
    prefer_away = bool(prefs and prefs.get("preferSharedPaths")) and not want_complement
    use_prefs = bool(prefs) and bool(g.graph.get("prefs_pathfinding"))
    complement_stream = None
    if want_complement:
        strategy = f"score_aware_{mode}_prefs_complement"
    elif use_prefs or prefer_away:
        if use_prefs and prefer_away:
            strategy = f"score_aware_{mode}_prefs_away"
        elif prefer_away:
            strategy = f"score_aware_{mode}_away"
        else:
            strategy = f"score_aware_{mode}_prefs"
    else:
        strategy = f"score_aware_{mode}"

    u = nearest_node(g, origin[0], origin[1])
    v = nearest_node(g, dest[0], dest[1])
    quality_weight = "cost_day" if mode == "day" else "cost_night"
    path_base: list[Any] | None = None
    try:
        path_dist = nx.shortest_path(g, u, v, weight="cost_distance")
        path_quality = nx.shortest_path(g, u, v, weight=quality_weight)
        if want_complement:
            # Other pathish corridor: invert the dominant stream, no prefix
            # penalty (Bellevue shares Homestead; penalising hid it).
            base_prefs = dict(prefs or {})
            base_prefs["preferSharedPaths"] = False
            base_prefs.pop("complement", None)
            complement_prefs = invert_dominant_stream(base_prefs, mode)
            complement_stream = complement_stream_name(complement_prefs, mode)
            weight: Any = preference_edge_weight(g, mode, complement_prefs)
            path_score = nx.shortest_path(g, u, v, weight=weight)
        elif prefer_away:
            # Push off the default corridor so a longer park/trail option can
            # appear (OD-12 Alira Park is ~1.4× — cost bias alone stays on the
            # already-pathish Homestead sidewalk).
            base_prefs = dict(prefs or {})
            base_prefs["preferSharedPaths"] = False
            path_base = nx.shortest_path(
                g, u, v, weight=preference_edge_weight(g, mode, base_prefs)
            )
            used = {frozenset((a, b)) for a, b in zip(path_base, path_base[1:])}
            weight = preference_edge_weight(
                g, mode, prefs or {}, penalize_edges=used, penalize_mult=3.0
            )
            path_score = nx.shortest_path(g, u, v, weight=weight)
        elif use_prefs:
            weight = preference_edge_weight(g, mode, prefs or {})
            path_score = nx.shortest_path(g, u, v, weight=weight)
        else:
            path_score = path_quality
    except nx.NetworkXNoPath:
        return None

    scored = attach_pins(
        path_to_route(g, path_score, strategy=strategy),
        origin,
        dest,
    )
    shortest = attach_pins(
        path_to_route(g, path_dist, strategy=f"distance_{mode}"),
        origin,
        dest,
    )
    quality_route = attach_pins(
        path_to_route(g, path_quality, strategy=f"score_aware_{mode}"),
        origin,
        dest,
    )
    default_route = None
    if prefer_away and path_base is not None:
        # Footpath-biased default (not graph-shortest). Used when the away
        # search exceeds the detour cap — never fall back to a service /
        # residential shortcut and still call it "away from roads" (OD-12
        # shade+away alley cut).
        default_strategy = (
            f"score_aware_{mode}_prefs" if use_prefs else f"score_aware_{mode}"
        )
        default_route = attach_pins(
            path_to_route(g, path_base, strategy=default_strategy),
            origin,
            dest,
        )
    if scored is None:
        return default_route or quality_route or shortest
    if shortest is None:
        return scored

    # Detour vs graph path before pin stubs would also work; stubs are tiny.
    # Compare network portions via geometry without stubs if pin_stub present —
    # length_m already includes stubs equally on both, so ratio stays fair.
    detour = scored["distance_m"] / max(shortest["distance_m"], 1.0)
    if want_complement:
        max_detour = float(
            g.graph.get("max_detour_complement", MAX_DETOUR_COMPLEMENT)
        )
    elif prefer_away:
        max_detour = float(g.graph.get("max_detour_away", MAX_DETOUR_AWAY))
    else:
        max_detour = float(g.graph.get("max_detour", MAX_DETOUR))
    prefs_out = None
    if (use_prefs or want_complement) and prefs is not None:
        out_prefs = invert_dominant_stream(prefs, mode) if want_complement else prefs
        prefs_out = {
            "accessibility": clamp_importance(out_prefs.get("accessibility", 60)),
            "shadeHeat": clamp_importance(out_prefs.get("shadeHeat", 40)),
            "afterDark": clamp_importance(out_prefs.get("afterDark", 40)),
            "preferSharedPaths": prefer_away,
        }
    share = pathish_share_of(scored)
    if want_complement and share is not None and share < PATHISH_KEEP_MIN_SHARE:
        return None
    pathish_keep = (
        share is not None
        and share >= PATHISH_KEEP_MIN_SHARE
        and detour <= float(g.graph.get("max_detour_pathish", MAX_DETOUR_PATHISH))
    )
    if detour > max_detour and not (pathish_keep and not prefer_away):
        if want_complement:
            # Omit — do not show junk or a duplicate of the primary card.
            return None
        if prefer_away and default_route is not None:
            fallback = default_route
            fallback["away_capped_to_default"] = True
        else:
            # No-junk: highway-biased Casey path, never graph-shortest
            # (service / residential alley). Pathish corridors up to 1.20×
            # are kept above (OD-12 Bellevue).
            fallback = quality_route or shortest
            fallback["strategy"] = f"score_aware_{mode}"
        fallback["capped_from_detour"] = round(detour, 3)
        if prefs_out is not None:
            fallback["prefs"] = prefs_out
        return fallback
    scored["detour_vs_graph_shortest"] = round(detour, 3)
    if prefs_out is not None:
        scored["prefs"] = prefs_out
    if complement_stream is not None:
        scored["complement_stream"] = complement_stream
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
        "prefs": route.get("prefs"),
        "away_capped_to_default": route.get("away_capped_to_default"),
        "complement_stream": route.get("complement_stream"),
    }


def plan_challenger(
    origin_lng: float,
    origin_lat: float,
    dest_lng: float,
    dest_lat: float,
    *,
    mode: str = "day",
    prefs: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    g = load_graph()
    route = challenger_route(
        g,
        [origin_lng, origin_lat],
        [dest_lng, dest_lat],
        mode=mode if mode in ("day", "night") else "day",
        prefs=prefs,
    )
    if route is None:
        return None
    return route_to_json(route)
