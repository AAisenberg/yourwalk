"""Server-side Around-here loop planner (Casey graph circuits).

Findings behind this module (16 Aug 2026 backtracking investigation):

- Three independent Dijkstra legs retrace each other 300-500 m because two
  legs both want the same best-scoring corridor. A cumulative reuse penalty
  on edges already walked cuts same-path revisit from ~0.15-0.21 to ~0.06.
- Full trip-style quality swing makes footpaths-max legs wander ~1.5x the
  asked duration. Loops have a fixed time budget, so the swing is tempered
  and the via radius is resized from measured circuit length.
- Turning points must be through-nodes (junction degree >= 2), never
  dead-ends, or the circuit is forced out-and-back into the spur.

One /loop call returns up to three distinct in-band circuits. The web app
keeps its own quality gates and falls back to Mapbox waypoint drawing when
this planner returns nothing.
"""

from __future__ import annotations

import math
import time
from typing import Any

import networkx as nx

from challenger import (
    attach_pins,
    clamp_importance,
    load_graph,
    path_to_route,
    route_to_json,
)
from graph_runtime import _norm_score, highway_cost_mult, nearest_node

WALK_MPS = 1.3
BAND_S = 300.0
# Tempered vs the trip weight's full +-0.5 swing: circuits chase quality less.
LOOP_QUALITY_SWING = 0.5
# Cross-leg reuse penalty. x8 gave no extra revisit benefit, only duration blowouts.
PENALIZE_MULT = 4.0
REVISIT_MAX = 0.20
SIMILAR_OVERLAP = 0.75
MAX_CIRCUIT_ATTEMPTS = 22
DEADLINE_S = 8.0
SECTOR_DEG = 30.0
# First-guess via radius as a share of target circuit length. Circuits at
# Casey run ~1.6-1.9x the crow-fly triangle, so a calibration probe measures
# the real factor and re-anchors the radius before the main draws.
VIA_RADIUS_SHARE = 0.20
# Damped resize exponent: linear f = target/total oscillates past the band.
RESIZE_DAMPING = 0.85

Node = tuple[float, float]


def _haversine_m(a: Node, b: Node) -> float:
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


def _bearing_deg(a: Node, b: Node) -> float:
    dlng = math.radians(b[0] - a[0])
    lat1 = math.radians(a[1])
    lat2 = math.radians(b[1])
    y = math.sin(dlng) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(
        lat2
    ) * math.cos(dlng)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _ang_sep(a: float, b: float) -> float:
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


def _weights_for(prefs: dict[str, Any] | None, mode: str) -> tuple[int, int]:
    p = prefs or {}
    w_acc = clamp_importance(p.get("accessibility", 60))
    if mode == "night":
        return w_acc, clamp_importance(p.get("afterDark", 40))
    return w_acc, clamp_importance(p.get("shadeHeat", 40))


def _percentiles(g: nx.Graph, mode: str) -> tuple[float, float, float, float]:
    meta = g.graph
    acc_p10 = float(meta.get("acc_p10", meta.get("day_p10", 40)))
    acc_p90 = float(meta.get("acc_p90", meta.get("day_p90", 80)))
    if mode == "night":
        s_p10 = float(meta.get("light_p10", meta.get("night_p10", 50)))
        s_p90 = float(meta.get("light_p90", meta.get("night_p90", 90)))
    else:
        s_p10 = float(meta.get("heat_p10", meta.get("day_p10", 40)))
        s_p90 = float(meta.get("heat_p90", meta.get("day_p90", 80)))
    return acc_p10, acc_p90, s_p10, s_p90


def _edge_stream(data: dict[str, Any], mode: str) -> tuple[Any, Any]:
    """(accessibility, second-stream) raw scores; night falls back to Night Index."""
    acc = data.get("accessibility_score")
    if mode == "night":
        second = data.get("lighting_after_dark_score")
        if second is None:
            second = data.get("night_index_score")
    else:
        second = data.get("heat_shade_score")
    return acc, second


def _loop_edge_weight(
    g: nx.Graph,
    mode: str,
    prefs: dict[str, Any] | None,
    *,
    penalize_edges: set[frozenset[Node]] | None = None,
    penalize_mult: float = PENALIZE_MULT,
):
    """Preference blend like the trip weight, with a tempered quality swing."""
    acc_p10, acc_p90, s_p10, s_p90 = _percentiles(g, mode)
    w_acc, w_second = _weights_for(prefs, mode)

    def weight(u: Node, v: Node, data: dict[str, Any]) -> float:
        length = max(1.0, float(data.get("length_m") or 1.0))
        hw_mult = highway_cost_mult(data.get("highway"))
        acc, second = _edge_stream(data, mode)
        parts: list[tuple[float, int]] = []
        if acc is not None and acc == acc:
            parts.append((_norm_score(float(acc), acc_p10, acc_p90), w_acc))
        if second is not None and second == second:
            parts.append((_norm_score(float(second), s_p10, s_p90), w_second))
        if not parts:
            cost = length * hw_mult
        else:
            s_norm = sum(n * w for n, w in parts) / sum(w for _, w in parts)
            cost = length * (1.0 + LOOP_QUALITY_SWING * (0.5 - s_norm)) * hw_mult
        if penalize_edges and frozenset((u, v)) in penalize_edges:
            cost *= penalize_mult
        return cost

    return weight


def _node_blend(
    g: nx.Graph,
    node: Node,
    mode: str,
    prefs: dict[str, Any] | None,
    percentiles: tuple[float, float, float, float],
) -> float | None:
    """Length-weighted preference blend of the edges meeting at a node."""
    acc_p10, acc_p90, s_p10, s_p90 = percentiles
    w_acc, w_second = _weights_for(prefs, mode)
    num = 0.0
    den = 0.0
    for _, data in g.adj[node].items():
        length = max(1.0, float(data.get("length_m") or 1.0))
        acc, second = _edge_stream(data, mode)
        parts: list[tuple[float, int]] = []
        if acc is not None and acc == acc:
            parts.append((_norm_score(float(acc), acc_p10, acc_p90), w_acc))
        if second is not None and second == second:
            parts.append((_norm_score(float(second), s_p10, s_p90), w_second))
        if not parts:
            continue
        s_norm = sum(n * w for n, w in parts) / sum(w for _, w in parts)
        num += s_norm * length
        den += length
    return (num / den) if den > 0 else None


# ---- same revisit metric family as web/src/lib/routing/planOuting.ts ----
STEP_M = 28.0
NEAR_M = 15.0
SEP_M = 95.0
STUB_M = 80.0


def _densify(coords: list[Node]) -> list[tuple[Node, float]]:
    if len(coords) < 2:
        return []
    samples: list[tuple[Node, float]] = [(coords[0], 0.0)]
    along = 0.0
    since = 0.0
    for i in range(1, len(coords)):
        a, b = coords[i - 1], coords[i]
        seg = _haversine_m(a, b)
        if seg < 0.5:
            continue
        remaining = seg
        t0 = 0.0
        while since + remaining >= STEP_M:
            need = STEP_M - since
            t = t0 + need / seg
            samples.append(
                (
                    (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t),
                    along + need,
                )
            )
            along += need
            remaining -= need
            t0 += need / seg
            since = 0.0
        along += remaining
        since += remaining
    samples.append((coords[-1], along))
    return samples


def _revisit_ratio(coords: list[Node], start: Node) -> float:
    samples = _densify(coords)
    if len(samples) < 8:
        return 1.0
    total = samples[-1][1]
    if total < 120:
        return 1.0
    revisit = 0
    scored = 0
    for i, (p, along) in enumerate(samples):
        near_start = _haversine_m(p, start) <= STUB_M
        if along < total * 0.18:
            continue
        scored += 1
        for q, e_along in samples[:i]:
            if along - e_along < SEP_M:
                continue
            if near_start and _haversine_m(q, start) <= STUB_M:
                continue
            if _haversine_m(p, q) <= NEAR_M:
                revisit += 1
                break
    return revisit / scored if scored else 1.0


def _sample_overlap(a: list[Node], b: list[Node], near_m: float = 55.0) -> float:
    sa = _densify(a)
    sb = _densify(b)
    if len(sa) < 4 or len(sb) < 4:
        return 1.0
    step = max(1, len(sa) // 16)
    b_step = max(1, len(sb) // 20)
    near = 0
    n = 0
    for i in range(0, len(sa), step):
        n += 1
        p = sa[i][0]
        for j in range(0, len(sb), b_step):
            if _haversine_m(p, sb[j][0]) <= near_m:
                near += 1
                break
    return near / n if n else 1.0


def _via_candidates(
    g: nx.Graph,
    start: Node,
    r_lo: float,
    r_hi: float,
    mode: str,
    prefs: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    percentiles = _percentiles(g, mode)
    dlat = r_hi / 111320.0
    dlng = r_hi / (111320.0 * max(0.2, math.cos(math.radians(start[1]))))
    out: list[dict[str, Any]] = []
    for n in g.nodes():
        if abs(n[0] - start[0]) > dlng or abs(n[1] - start[1]) > dlat:
            continue
        d = _haversine_m(start, n)
        if d < r_lo or d > r_hi:
            continue
        if g.degree[n] < 2:
            continue
        blend = _node_blend(g, n, mode, prefs, percentiles)
        out.append(
            {
                "node": n,
                "dist": d,
                "bearing": _bearing_deg(start, n),
                "blend": blend if blend is not None else 0.5,
            }
        )
    return out


def _snap_through(g: nx.Graph, lng: float, lat: float) -> Node:
    """Nearest node, stepped off a dead-end so the circuit is not forced back."""
    n = nearest_node(g, lng, lat)
    for _ in range(3):
        if g.degree[n] >= 2:
            return n
        nbrs = list(g.adj[n])
        if not nbrs:
            return n
        n = nbrs[0]
    return n


def _edges_of(path: list[Node]) -> set[frozenset[Node]]:
    return {frozenset((a, b)) for a, b in zip(path, path[1:])}


def _circuit(
    g: nx.Graph,
    u: Node,
    a: Node,
    b: Node,
    mode: str,
    prefs: dict[str, Any] | None,
    strategy: str,
) -> dict[str, Any] | None:
    """start -> A -> B -> start with a cumulative reuse penalty across legs."""
    try:
        leg1 = nx.shortest_path(g, u, a, weight=_loop_edge_weight(g, mode, prefs))
        used = _edges_of(leg1)
        leg2 = nx.shortest_path(
            g,
            a,
            b,
            weight=_loop_edge_weight(g, mode, prefs, penalize_edges=used),
        )
        used |= _edges_of(leg2)
        leg3 = nx.shortest_path(
            g,
            b,
            u,
            weight=_loop_edge_weight(g, mode, prefs, penalize_edges=used),
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None
    node_path = leg1 + leg2[1:] + leg3[1:]
    if len(node_path) < 3:
        return None
    return path_to_route(g, node_path, strategy=strategy)


def plan_loops(
    start_lng: float,
    start_lat: float,
    minutes: float,
    *,
    mode: str = "day",
    prefs: dict[str, Any] | None = None,
    max_options: int = 3,
) -> list[dict[str, Any]]:
    """Up to ``max_options`` distinct in-band circuits from a Casey start."""
    g = load_graph()
    mode = mode if mode in ("day", "night") else "day"
    minutes = max(10.0, min(60.0, float(minutes)))
    max_options = max(1, min(3, int(max_options)))

    start: Node = (float(start_lng), float(start_lat))
    target_m = minutes * 60.0 * WALK_MPS
    band_lo = (minutes * 60.0 - BAND_S) * WALK_MPS
    band_hi = (minutes * 60.0 + BAND_S) * WALK_MPS
    r0 = max(140.0, target_m * VIA_RADIUS_SHARE)

    u = nearest_node(g, *start)

    def build_pairs(r: float) -> list[tuple[dict[str, Any], dict[str, Any]]]:
        cands = _via_candidates(g, start, 0.62 * r, 1.38 * r, mode, prefs)
        if len(cands) < 2:
            return []
        # Best turning point per 30 degree sector, sectors ordered by that
        # score, so shade-max does not put every candidate in one reserve.
        sectors: dict[int, dict[str, Any]] = {}
        for c in cands:
            if c["dist"] < 0.75 * r:
                continue
            key = int(c["bearing"] // SECTOR_DEG)
            if key not in sectors or c["blend"] > sectors[key]["blend"]:
                sectors[key] = c
        firsts = sorted(sectors.values(), key=lambda c: -c["blend"])

        out: list[tuple[dict[str, Any], dict[str, Any]]] = []
        seen: set[frozenset[Node]] = set()
        for i, a in enumerate(firsts[:12]):
            sides: dict[bool, list[dict[str, Any]]] = {True: [], False: []}
            for c in cands:
                if c["node"] == a["node"]:
                    continue
                if not 95.0 <= _ang_sep(a["bearing"], c["bearing"]) <= 150.0:
                    continue
                if _haversine_m(a["node"], c["node"]) < 0.5 * r:
                    continue
                signed = ((c["bearing"] - a["bearing"] + 540.0) % 360.0) - 180.0
                sides[signed >= 0].append(c)
            # Alternate the preferred side so one high-scoring partner does
            # not become B for every A (near-duplicate circuits).
            prefer = bool(i % 2)
            partners = sides[prefer] or sides[not prefer]
            if not partners:
                continue
            b = max(partners, key=lambda c: c["blend"])
            key = frozenset((a["node"], b["node"]))
            if key in seen:
                continue
            seen.add(key)
            out.append((a, b))
        return out

    pairs = build_pairs(r0)
    if not pairs:
        return []

    accepted: list[dict[str, Any]] = []
    accepted_coords: list[list[Node]] = []
    attempts = 0
    deadline = time.monotonic() + DEADLINE_S
    r_use = r0

    # Calibration probe: one draw at the first-guess radius measures the real
    # network/wander factor, then the via ring is re-anchored so most first
    # draws land inside the band instead of burning resizes.
    probe = _circuit(
        g, u, pairs[0][0]["node"], pairs[0][1]["node"], mode, prefs, "probe"
    )
    attempts += 1
    if probe is not None:
        k = float(probe["distance_m"]) / target_m
        if k > 0:
            r_use = max(110.0, min(1.3 * r0, r0 / k))
        if abs(r_use - r0) / r0 > 0.12:
            rebuilt = build_pairs(r_use)
            if rebuilt:
                pairs = rebuilt

    for a_cand, b_cand in pairs:
        if (
            len(accepted) >= max_options
            or attempts >= MAX_CIRCUIT_ATTEMPTS
            or time.monotonic() > deadline
        ):
            break
        a_node: Node = a_cand["node"]
        b_node: Node = b_cand["node"]
        strategy = (
            f"score_aware_loop_{mode}_b{int(a_cand['bearing'])}_r{int(r_use)}"
        )
        best: dict[str, Any] | None = None
        # Initial draw plus up to two damped via-radius resizes.
        for _ in range(3):
            if attempts >= MAX_CIRCUIT_ATTEMPTS or time.monotonic() > deadline:
                break
            attempts += 1
            route = _circuit(g, u, a_node, b_node, mode, prefs, strategy)
            if route is None:
                break
            total = float(route["distance_m"])
            if band_lo <= total <= band_hi:
                best = route
                break
            f = (target_m / max(1.0, total)) ** RESIZE_DAMPING
            f = max(0.45, min(1.6, f))
            if abs(f - 1.0) < 0.04:
                break
            na = _snap_through(
                g,
                start[0] + (a_node[0] - start[0]) * f,
                start[1] + (a_node[1] - start[1]) * f,
            )
            nb = _snap_through(
                g,
                start[0] + (b_node[0] - start[0]) * f,
                start[1] + (b_node[1] - start[1]) * f,
            )
            if (na, nb) == (a_node, b_node):
                break
            a_node, b_node = na, nb

        if best is None:
            continue

        pinned = attach_pins(best, [start[0], start[1]], [start[0], start[1]])
        if pinned is None:
            continue
        coords = [(float(x), float(y)) for x, y in pinned["geometry"].coords]

        rev = _revisit_ratio(coords, start)
        if rev > REVISIT_MAX:
            continue
        max_away = max((_haversine_m(start, p) for p in coords), default=0.0)
        if max_away < 0.35 * r_use:
            continue
        if any(
            _sample_overlap(coords, prev) >= SIMILAR_OVERLAP
            for prev in accepted_coords
        ):
            continue

        out = route_to_json(pinned)
        out["revisit"] = round(rev, 3)
        out["vias"] = [
            [a_node[0], a_node[1]],
            [b_node[0], b_node[1]],
        ]
        accepted.append(out)
        accepted_coords.append(coords)

    return accepted
