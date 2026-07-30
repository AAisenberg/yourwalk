#!/usr/bin/env python3
"""Casey network fitness check: Mapbox vs OSM vs T1EAM on bake-off ODs.

See docs/NETWORK_FITNESS_CHECK.md
"""

from __future__ import annotations

import csv
import json
import pickle
import sys
from datetime import date
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
from shapely.geometry import LineString, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from build_graph import nearest_node, reset_node_index  # noqa: E402
from paths import (  # noqa: E402
    GRAPH_PICKLE,
    OD_FIXTURE,
    OSM_WAYS,
    RESULTS_DIR,
    SCORES_EXPORT,
    REPO_ROOT,
    ensure_bakeoff_dirs,
)

T1EAM_BUFFER_M = 20.0
OSM_BUFFER_M = 12.0
GLOBAL_BUFFER_M = 15.0


def latest_day_geojson() -> Path:
    files = sorted(RESULTS_DIR.glob("bakeoff_*_day.geojson"))
    if not files:
        raise SystemExit("No bakeoff_*_day.geojson — run run_bakeoff.py --mode day")
    return files[-1]


def coverage_along_line(
    line: LineString,
    cover: gpd.GeoDataFrame,
    *,
    buffer_m: float,
) -> float:
    """Share of line length within buffer_m of any cover geometry."""
    if line is None or line.is_empty:
        return 0.0
    route = gpd.GeoDataFrame(geometry=[line], crs=4326).to_crs(7855)
    geom = route.geometry.iloc[0]
    length = float(geom.length)
    if length <= 0:
        return 0.0
    cover_m = cover.to_crs(7855)
    # candidate filter via bounds
    corridor = geom.buffer(buffer_m)
    hit = cover_m[cover_m.intersects(corridor)]
    if hit.empty:
        return 0.0
    union = unary_union(list(hit.geometry.values)).buffer(buffer_m)
    covered = geom.intersection(union)
    if covered.is_empty:
        return 0.0
    return min(1.0, float(covered.length) / length)


def band(m1: float) -> str:
    if m1 >= 0.85:
        return "strong"
    if m1 >= 0.70:
        return "ok"
    return "weak"


def global_overlap(osm: gpd.GeoDataFrame, t1: gpd.GeoDataFrame) -> dict:
    """G1/G2 on a sample for speed (every Nth feature) + report counts."""
    osm_m = osm.to_crs(7855)
    t1_m = t1.to_crs(7855)

    # Prefer foot-class OSM for G2
    foot = osm_m[osm_m["highway"].isin(["footway", "path", "pedestrian", "steps"])].copy()
    if foot.empty:
        foot = osm_m

    # Sample for runtime
    t1_s = t1_m.iloc[::2].copy() if len(t1_m) > 8000 else t1_m
    foot_s = foot.iloc[::3].copy() if len(foot) > 15000 else foot

    foot_near = 0.0
    foot_total = 0.0
    for geom in foot_s.geometry:
        if geom is None or geom.is_empty:
            continue
        length = float(geom.length)
        foot_total += length
        buf = geom.buffer(GLOBAL_BUFFER_M)
        idxs = list(t1_m.sindex.intersection(buf.bounds))
        if not idxs:
            continue
        u = unary_union([t1_m.geometry.iloc[i] for i in idxs]).buffer(GLOBAL_BUFFER_M)
        inter = geom.intersection(u)
        if not inter.is_empty:
            foot_near += float(inter.length)

    # G1: fraction of T1EAM features within buffer of OSM foot ways
    try:
        foot_buf = foot_s.copy()
        foot_buf["geometry"] = foot_buf.buffer(GLOBAL_BUFFER_M)
        j2 = gpd.sjoin(
            t1_s[["geometry"]].reset_index(drop=True),
            foot_buf[["geometry"]].reset_index(drop=True),
            how="left",
            predicate="intersects",
        )
        g1_feat = j2.index_right.notna().groupby(j2.index).any().mean()
    except Exception:  # noqa: BLE001
        g1_feat = float("nan")

    g2 = foot_near / foot_total if foot_total > 0 else float("nan")
    return {
        "g1_t1eam_features_near_osm": float(g1_feat) if g1_feat == g1_feat else None,
        "g2_osm_foot_length_near_t1eam": float(g2) if g2 == g2 else None,
        "osm_ways": int(len(osm)),
        "osm_foot_sample": int(len(foot_s)),
        "t1eam_sample": int(len(t1_s)),
    }


def main() -> int:
    ensure_bakeoff_dirs()
    for p in (OSM_WAYS, SCORES_EXPORT, GRAPH_PICKLE):
        if not p.exists():
            print(f"Missing {p}", file=sys.stderr)
            return 1

    day_gj = latest_day_geojson()
    print(f"Using {day_gj.name}")
    fc = json.loads(day_gj.read_text())
    od_meta = {p["id"]: p for p in json.loads(OD_FIXTURE.read_text())["pairs"]}

    osm = gpd.read_file(OSM_WAYS)
    t1 = gpd.read_file(SCORES_EXPORT)
    g: nx.Graph = pickle.loads(GRAPH_PICKLE.read_bytes())
    reset_node_index()

    by_od: dict[str, list] = {}
    for feat in fc.get("features") or []:
        props = feat.get("properties") or {}
        oid = props.get("od_id")
        if not oid:
            continue
        by_od.setdefault(oid, []).append(feat)

    rows: list[dict] = []
    for oid in sorted(by_od):
        feats = by_od[oid]
        mbs = [f for f in feats if f["properties"].get("engine") == "mapbox"]
        chs = [f for f in feats if f["properties"].get("engine") != "mapbox"]
        if not mbs:
            continue
        mb = max(mbs, key=lambda f: f["properties"].get("day_display") or -1)
        mb_line = shape(mb["geometry"])
        ch_line = shape(chs[0]["geometry"]) if chs else None

        m1 = coverage_along_line(mb_line, t1, buffer_m=T1EAM_BUFFER_M)
        m2 = (
            coverage_along_line(ch_line, t1, buffer_m=T1EAM_BUFFER_M)
            if ch_line
            else None
        )
        m3 = coverage_along_line(mb_line, osm, buffer_m=OSM_BUFFER_M)

        meta = od_meta.get(oid, {})
        origin = (meta.get("origin") or {}).get("center")
        dest = (meta.get("destination") or {}).get("center")
        m4 = None
        if origin and dest:
            try:
                u = nearest_node(g, origin[0], origin[1])
                v = nearest_node(g, dest[0], dest[1])
                path = nx.shortest_path(g, u, v, weight="cost_distance")
                osm_len = sum(
                    float(g.edges[a, b]["length_m"]) for a, b in zip(path, path[1:])
                )
                mb_len = float(mb["properties"].get("distance_m") or mb_line.length * 111320)
                m4 = osm_len / mb_len if mb_len > 0 else None
            except Exception:  # noqa: BLE001
                m4 = None

        flags = []
        if m1 < 0.70:
            flags.append("low_t1eam_on_mapbox")
        if m3 < 0.85:
            flags.append("mapbox_off_our_osm")
        if m4 is not None and m4 > 1.25:
            flags.append("osm_much_longer")
        if m4 is not None and m4 < 0.85:
            flags.append("osm_much_shorter")

        row = {
            "od_id": oid,
            "label": meta.get("label", oid),
            "mapbox_distance_m": round(float(mb["properties"].get("distance_m") or 0), 1),
            "mapbox_day": mb["properties"].get("day_display"),
            "challenger_distance_m": (
                round(float(chs[0]["properties"].get("distance_m") or 0), 1) if chs else None
            ),
            "challenger_day": chs[0]["properties"].get("day_display") if chs else None,
            "m1_t1eam_cov_mapbox": round(m1, 3),
            "m1_band": band(m1),
            "m2_t1eam_cov_challenger": round(m2, 3) if m2 is not None else None,
            "m2_band": band(m2) if m2 is not None else None,
            "m3_osm_cov_mapbox": round(m3, 3),
            "m3_band": "strong" if m3 >= 0.85 else ("ok" if m3 >= 0.70 else "weak"),
            "m4_osm_shortest_over_mapbox": round(m4, 3) if m4 is not None else None,
            "flags": ";".join(flags) if flags else "",
        }
        rows.append(row)
        print(
            f"{oid} M1={row['m1_t1eam_cov_mapbox']}({row['m1_band']}) "
            f"M3={row['m3_osm_cov_mapbox']} M4={row['m4_osm_shortest_over_mapbox']} "
            f"{row['flags']}"
        )

    print("\nComputing LGA extract overlap (sampled)…")
    glob = global_overlap(osm, t1)
    print(f"  G1 T1EAM features near OSM: {glob['g1_t1eam_features_near_osm']}")
    print(f"  G2 OSM foot length near T1EAM: {glob['g2_osm_foot_length_near_t1eam']}")

    stamp = date.today().isoformat().replace("-", "")
    csv_path = RESULTS_DIR / f"network_fitness_{stamp}.csv"
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"\nWrote {csv_path}")

    # Markdown results for repo (defensible summary)
    md_path = REPO_ROOT / "docs" / "NETWORK_FITNESS_RESULTS.md"
    n_ok = sum(1 for r in rows if r["m1_band"] in ("ok", "strong"))
    n_m3 = sum(1 for r in rows if r["m3_band"] in ("ok", "strong"))
    n_m4_bad = sum(
        1
        for r in rows
        if r["m4_osm_shortest_over_mapbox"] is not None
        and r["m4_osm_shortest_over_mapbox"] > 1.25
    )
    flagged = [r for r in rows if r["flags"]]

    lines = [
        "# Casey network fitness results",
        "",
        f"**Date:** {date.today().isoformat()}  ",
        f"**Method:** [`NETWORK_FITNESS_CHECK.md`](NETWORK_FITNESS_CHECK.md)  ",
        f"**Bake-off geometries:** `{day_gj.name}`  ",
        f"**CSV:** `pipeline/data/bakeoff/results/{csv_path.name}` (gitignored)",
        "",
        "## Verdict draft",
        "",
    ]

    if n_ok >= 8 and n_m3 >= 8 and n_m4_bad <= 2:
        verdict = (
            "**Provisional: OSM/Mapbox fit for pilot routing** with T1EAM as scoring. "
            "Document flagged ODs; proceed toward hybrid with eyes open on edge cases."
        )
    elif n_ok < 6 or n_m3 < 6:
        verdict = (
            "**Caution: material network mismatch.** Do not over-claim score-aware or "
            "hybrid until gaps are explained or a Council-graph path is scoped."
        )
    else:
        verdict = (
            "**Mixed: usable with caveats.** Most ODs pass; treat flagged ODs as known "
            "limitations in pilot comms and confidence copy."
        )
    lines.extend([verdict, ""])

    lines.extend(
        [
            "## Headline counts",
            "",
            f"- M1 T1EAM-on-Mapbox ok/strong: **{n_ok}/{len(rows)}**",
            f"- M3 Mapbox-on-our-OSM ok/strong: **{n_m3}/{len(rows)}**",
            f"- M4 OSM shortest >1.25× Mapbox: **{n_m4_bad}/{len(rows)}**",
            f"- G1 T1EAM features near OSM (sample): "
            f"**{glob['g1_t1eam_features_near_osm']}**",
            f"- G2 OSM foot length near T1EAM (sample): "
            f"**{glob['g2_osm_foot_length_near_t1eam']}**",
            "",
            "## Per-OD table",
            "",
            "| OD | M1 T1EAM⊃Mapbox | M2 T1EAM⊃Challenger | M3 OSM⊃Mapbox | M4 OSM/Mapbox len | Flags |",
            "|----|----------------:|--------------------:|--------------:|------------------:|:------|",
        ]
    )
    for r in rows:
        lines.append(
            f"| {r['od_id']} | {r['m1_t1eam_cov_mapbox']} ({r['m1_band']}) | "
            f"{r['m2_t1eam_cov_challenger']} ({r['m2_band']}) | "
            f"{r['m3_osm_cov_mapbox']} ({r['m3_band']}) | "
            f"{r['m4_osm_shortest_over_mapbox']} | {r['flags'] or '—'} |"
        )

    lines.extend(
        [
            "",
            "## Flagged ODs (priority for `/lab` qualitative review)",
            "",
        ]
    )
    if not flagged:
        lines.append("_None — all ODs within heuristics._")
    else:
        for r in flagged:
            lines.append(
                f"- **{r['od_id']}** ({r['label']}): `{r['flags']}` — "
                f"M1={r['m1_t1eam_cov_mapbox']}, M3={r['m3_osm_cov_mapbox']}, "
                f"M4={r['m4_osm_shortest_over_mapbox']}"
            )

    lines.extend(
        [
            "",
            "## Qualitative checklist (fill in `/lab`)",
            "",
            "| OD | Mapbox uses park/reserve? | OSM can follow it? | T1EAM under path? | Notes |",
            "|----|---------------------------|--------------------|-------------------|-------|",
            "| OD-01 | | | | Promenade Reserve QA |",
            "| OD-05 | | | | Hampton Park length gap |",
            "| OD-09 | | | | RBG edge / join stress |",
            "| _add_ | | | | |",
            "",
            "## How to read this for stakeholders",
            "",
            "- **M1 strong** = Mapbox walks are sitting on Council-scored footpaths (scoring is meaningful).",
            "- **M3 strong** = Our OSM extract sees what Mapbox walked (fair score-aware compare).",
            "- **M4 ≫ 1.25** = Our OSM graph’s shortest walk is much longer than Mapbox — network gap, not just scoring.",
            "- **G1/G2** = LGA-level agreement between Council assets and OSM foot links.",
            "",
            "## Next after this doc",
            "",
            "1. Complete qualitative rows in `/lab` for flagged ODs.",
            "2. If verdict stays provisional-fit → hybrid Mapbox + score-aware alt.",
            "3. If gaps dominate → scope T1EAM/Council routing graph (or OSM gap-fill) before north-star claims.",
            "",
        ]
    )
    # avoid em dash
    text = "\n".join(lines).replace("—", "-").replace("–", "-")
    md_path.write_text(text)
    print(f"Wrote {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
