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

from paths import GRAPH_PICKLE, OSM_JOINED, ensure_bakeoff_dirs  # noqa: E402

# Node snap tolerance in degrees (~3–4 m at Casey)
NODE_DECIMALS = 5
# Soft detour policy used by challenger (vs pure distance path)
MAX_DETOUR = 1.15


def node_key(x: float, y: float) -> tuple[float, float]:
    return (round(x, NODE_DECIMALS), round(y, NODE_DECIMALS))


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
) -> float:
    """Higher Casey score → lower cost.

    Uses percentile-normalised scores so Night (compressed high band) and Day
    (wider mid band) get similar cost dynamic range. Soft bounds only.
    """
    s_norm = _norm_score(score, p10, p90)
    # s_norm 0 → ×(1 + swing/2); s_norm 1 → ×(1 - swing/2)
    # swing=1.0 → ×1.5 … ×0.5
    mult = 1.0 + quality_swing * (0.5 - s_norm)
    return max(1.0, length_m) * mult


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
                "cost_day": edge_cost(length_m, day_f, p10=day_p10, p90=day_p90),
                "cost_night": edge_cost(length_m, night_f, p10=night_p10, p90=night_p90),
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
    g.graph["prefs_pathfinding"] = True
    return g


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
    reset_node_index()
    GRAPH_PICKLE.write_bytes(pickle.dumps(g, protocol=pickle.HIGHEST_PROTOCOL))
    print(f"Graph: {g.number_of_nodes()} nodes, {g.number_of_edges()} edges → {GRAPH_PICKLE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
