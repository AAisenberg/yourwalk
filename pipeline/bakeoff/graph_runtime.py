"""Runtime helpers for the score-aware graph (no GeoPandas).

Used by the hosted challenger image and by build_graph.py.
"""

from __future__ import annotations

import networkx as nx
from shapely.geometry import Point

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
MILD_ROAD_MULT = 1.25
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

_NODE_TREE = None
_NODE_LIST: list[tuple[float, float]] | None = None


def node_key(x: float, y: float) -> tuple[float, float]:
    return (round(x, NODE_DECIMALS), round(y, NODE_DECIMALS))


def norm_highway(hw: object) -> str:
    if hw is None:
        return "unknown"
    if isinstance(hw, (list, tuple)):
        hw = hw[0] if hw else "unknown"
    return str(hw).split(";")[0].strip().lower() or "unknown"


def highway_cost_mult(highway: object, *, prefer_away: bool = False) -> float:
    """Per-metre class bias so a parallel footpath always beats a road way."""
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
    """Map raw 0–100 score into 0–1 using network percentiles."""
    if score is None or score != score:
        return 0.5
    span = max(1e-6, p90 - p10)
    return max(0.0, min(1.0, (float(score) - p10) / span))


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
    """Higher Casey score → lower cost."""
    s_norm = _norm_score(score, p10, p90)
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
