#!/usr/bin/env python3
"""Experiment: Casey-graph loop circuits without backtracking.

Not product code. Feeds the loop backtracking investigation (P4 follow-up).

Reads the via pairs probed by web/scripts/diagnose-loop-backtrack.ts from
/tmp/yourwalk-loop-diag/legs.geojson, then for each pair compares:

  baseline   three plain pref-weighted Dijkstra legs (what P4 stitches today)
  penalised  leg 2 avoids leg-1 edges, leg 3 avoids legs 1+2 (mult 4 / 8)
  adaptive   penalised + one via-radius rescale so duration lands in band

Metrics: product-equivalent same-path revisit (15 m), leg overlap metres,
duration vs the 25-35 min band, dead-end via detection.

Run from pipeline/ with the venv:
    python bakeoff/loop_backtrack_experiment.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import networkx as nx  # noqa: E402
from shapely.geometry import mapping  # noqa: E402

from challenger import load_graph, path_to_route, preference_edge_weight  # noqa: E402
from graph_runtime import nearest_node  # noqa: E402

DIAG_DIR = Path("/tmp/yourwalk-loop-diag")
START = (145.3485, -38.0405)
TARGET_MIN = 30
BAND_S = (25 * 60, 35 * 60)
WALK_MPS = 1.3

PREFS = {
    "shade-max": {"accessibility": 10, "shadeHeat": 100, "afterDark": 0},
    "footpaths-max": {"accessibility": 100, "shadeHeat": 10, "afterDark": 0},
}


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lng1, lat1 = a
    lng2, lat2 = b
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


# ---- product revisit metric (planOuting.ts), replicated ----
STEP_M = 28.0
NEAR_M = 15.0
SEP_M = 95.0
STUB_M = 80.0


def densify(coords: list[tuple[float, float]]) -> list[tuple[tuple[float, float], float]]:
    if len(coords) < 2:
        return []
    samples = [(coords[0], 0.0)]
    along = 0.0
    since = 0.0
    for i in range(1, len(coords)):
        a, b = coords[i - 1], coords[i]
        seg = haversine_m(a, b)
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


def revisit_ratio(
    coords: list[tuple[float, float]],
    start: tuple[float, float],
    near_m: float = NEAR_M,
) -> tuple[float, list[tuple[float, float]]]:
    samples = densify(coords)
    if len(samples) < 8:
        return 1.0, []
    total = samples[-1][1]
    if total < 120:
        return 1.0, []
    revisit = 0
    scored = 0
    hits: list[tuple[float, float]] = []
    for i, (p, along) in enumerate(samples):
        near_start = haversine_m(p, start) <= STUB_M
        if along < total * 0.18:
            continue
        scored += 1
        for q, e_along in samples[:i]:
            if along - e_along < SEP_M:
                continue
            if near_start and haversine_m(q, start) <= STUB_M:
                continue
            if haversine_m(p, q) <= near_m:
                revisit += 1
                hits.append(p)
                break
    return (revisit / scored if scored else 1.0), hits


def leg_overlap_m(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> float:
    sa = densify(a)
    sb = densify(b)
    overlap = 0.0
    for p, _ in sa:
        for q, _ in sb:
            if haversine_m(p, q) <= NEAR_M:
                overlap += STEP_M
                break
    return overlap


def load_pairs() -> dict[tuple[str, str], dict[str, tuple[float, float]]]:
    """Via coords per (label, pair): leg1 end = A, leg2 end = B (pin-attached)."""
    fc = json.loads((DIAG_DIR / "legs.geojson").read_text())
    pairs: dict[tuple[str, str], dict[str, tuple[float, float]]] = {}
    for f in fc["features"]:
        props = f["properties"]
        key = (props["label"], props["pair"])
        coords = f["geometry"]["coordinates"]
        entry = pairs.setdefault(key, {})
        if props["leg"] == "leg1":
            entry["a"] = (float(coords[-1][0]), float(coords[-1][1]))
        elif props["leg"] == "leg2":
            entry["b"] = (float(coords[-1][0]), float(coords[-1][1]))
    return {k: v for k, v in pairs.items() if "a" in v and "b" in v}


def circuit(
    g: nx.Graph,
    u,
    a,
    b,
    prefs: dict,
    *,
    penalize_mult: float | None,
) -> dict | None:
    """start->A->B->start; optional cumulative cross-leg edge penalty."""
    w_plain = preference_edge_weight(g, "day", prefs)
    try:
        leg1 = nx.shortest_path(g, u, a, weight=w_plain)
        if penalize_mult is None:
            leg2 = nx.shortest_path(g, a, b, weight=w_plain)
            leg3 = nx.shortest_path(g, b, u, weight=w_plain)
        else:
            used = {frozenset(e) for e in zip(leg1, leg1[1:])}
            w2 = preference_edge_weight(
                g, "day", prefs, penalize_edges=used, penalize_mult=penalize_mult
            )
            leg2 = nx.shortest_path(g, a, b, weight=w2)
            used |= {frozenset(e) for e in zip(leg2, leg2[1:])}
            w3 = preference_edge_weight(
                g, "day", prefs, penalize_edges=used, penalize_mult=penalize_mult
            )
            leg3 = nx.shortest_path(g, b, u, weight=w3)
    except nx.NetworkXNoPath:
        return None

    node_path = leg1 + leg2[1:] + leg3[1:]
    route = path_to_route(g, node_path, strategy="loop_experiment")
    if route is None:
        return None
    legs = []
    for leg in (leg1, leg2, leg3):
        r = path_to_route(g, leg, strategy="leg")
        legs.append(
            [(float(x), float(y)) for x, y in r["geometry"].coords] if r else []
        )
    return {"route": route, "legs": legs}


def summarize(tag: str, res: dict | None) -> dict | None:
    if res is None:
        print(f"    {tag}: no path")
        return None
    coords = [(float(x), float(y)) for x, y in res["route"]["geometry"].coords]
    dur = float(res["route"]["distance_m"]) / WALK_MPS
    rev, hits = revisit_ratio(coords, START)
    o12 = leg_overlap_m(res["legs"][0], res["legs"][1])
    o23 = leg_overlap_m(res["legs"][1], res["legs"][2])
    o13 = leg_overlap_m(res["legs"][0], res["legs"][2])
    in_band = "IN-BAND" if BAND_S[0] <= dur <= BAND_S[1] else "out-of-band"
    print(
        f"    {tag}: {dur / 60:.0f}min {in_band}  rev15={rev:.2f}"
        f"  legOverlap m 1-2={o12:.0f} 2-3={o23:.0f} 1-3={o13:.0f}"
    )
    return {
        "coords": coords,
        "duration_s": dur,
        "rev15": rev,
        "hits": hits,
        "in_band": BAND_S[0] <= dur <= BAND_S[1],
        "overlap_m": o12 + o23 + o13,
    }


def rescale_via(
    start: tuple[float, float],
    via: tuple[float, float],
    factor: float,
) -> tuple[float, float]:
    return (
        start[0] + (via[0] - start[0]) * factor,
        start[1] + (via[1] - start[1]) * factor,
    )


def main() -> int:
    g = load_graph()
    pairs = load_pairs()
    u = nearest_node(g, *START)
    out_features: list[dict] = []

    for (label, pair_name), via in sorted(pairs.items()):
        prefs = PREFS[label]
        a = nearest_node(g, *via["a"])
        b = nearest_node(g, *via["b"])
        deg_a = g.degree[a]
        deg_b = g.degree[b]
        print(f"\n== {label} {pair_name}  viaDeg A={deg_a} B={deg_b}")

        base = summarize("baseline  ", circuit(g, u, a, b, prefs, penalize_mult=None))
        pen4 = summarize("penalise x4", circuit(g, u, a, b, prefs, penalize_mult=4.0))
        pen8 = summarize("penalise x8", circuit(g, u, a, b, prefs, penalize_mult=8.0))

        adaptive = None
        ref = pen4 or base
        if ref and not ref["in_band"]:
            target = TARGET_MIN * 60 * WALK_MPS
            factor = max(0.35, min(1.6, target / max(1.0, ref["duration_s"] * WALK_MPS)))
            a2 = nearest_node(g, *rescale_via(START, via["a"], factor))
            b2 = nearest_node(g, *rescale_via(START, via["b"], factor))
            if a2 != a or b2 != b:
                adaptive = summarize(
                    f"adaptive x4 (r×{factor:.2f})",
                    circuit(g, u, a2, b2, prefs, penalize_mult=4.0),
                )

        for tag, res in (
            ("baseline", base),
            ("penalise4", pen4),
            ("penalise8", pen8),
            ("adaptive4", adaptive),
        ):
            if res is None:
                continue
            out_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "label": label,
                        "pair": pair_name,
                        "variant": tag,
                        "duration_min": round(res["duration_s"] / 60),
                        "rev15": round(res["rev15"], 3),
                        "in_band": res["in_band"],
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[x, y] for x, y in res["coords"]],
                    },
                }
            )
            out_features.extend(
                {
                    "type": "Feature",
                    "properties": {
                        "label": label,
                        "pair": pair_name,
                        "variant": tag,
                        "kind": "rev15",
                    },
                    "geometry": {"type": "Point", "coordinates": [p[0], p[1]]},
                }
                for p in res["hits"]
            )

    out = DIAG_DIR / "experiment.geojson"
    out.write_text(
        json.dumps({"type": "FeatureCollection", "features": out_features})
    )
    print(f"\nDumped {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
