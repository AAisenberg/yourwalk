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


def build_graph(edges: gpd.GeoDataFrame) -> nx.Graph:
    """Build walk graph from OSM ways.

    Consecutive vertices become nodes so junctions in the middle of a way
    connect to other ways (endpoint-only graphs leave suburbs disconnected).
    """
    g = nx.Graph()
    edges_m = edges.to_crs(7855) if edges.crs and edges.crs.to_epsg() != 7855 else edges

    day_s = edges["day_index_score"].dropna()
    night_s = edges["night_index_score"].dropna()
    day_p10, day_p90 = float(day_s.quantile(0.10)), float(day_s.quantile(0.90))
    night_p10, night_p90 = float(night_s.quantile(0.10)), float(night_s.quantile(0.90))
    print(
        f"Cost percentiles: day p10/p90={day_p10:.1f}/{day_p90:.1f} "
        f"night p10/p90={night_p10:.1f}/{night_p90:.1f}"
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

        day = row.get("day_index_score")
        night = row.get("night_index_score")
        day_f = float(day) if day is not None and day == day else None
        night_f = float(night) if night is not None and night == night else None
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
    g.graph["max_detour"] = MAX_DETOUR
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
