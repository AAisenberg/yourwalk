#!/usr/bin/env python3
"""Focused hybrid audit: Mapbox vs challenger on OD sample + Casey-only gaps.

Writes docs/HYBRID_ROUTING_AUDIT_YYYY-MM-DD.md (repo) and a JSON under data/qa/.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import duckdb
import geopandas as gpd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from challenger import load_graph, plan_challenger  # noqa: E402
from paths import (  # noqa: E402
    BAKEOFF_DATA,
    DATA_ROOT,
    OD_FIXTURE,
    OSM_WAYS,
    REPO_ROOT,
    RESULTS_DIR,
    SCORES_EXPORT,
)
from run_bakeoff import load_token, mapbox_routes  # noqa: E402
from score_corridor import score_route  # noqa: E402


def latest_features() -> dict[str, dict]:
    """Newest bake-off feature per (od_id, mode, engine)."""
    best: dict[tuple, tuple[float, dict]] = {}
    for path in sorted(RESULTS_DIR.glob("bakeoff_*.geojson")):
        mode = "night" if path.name.endswith("_night.geojson") else "day"
        if "_day" not in path.name and "_night" not in path.name:
            continue
        mtime = path.stat().st_mtime
        fc = json.loads(path.read_text())
        for feat in fc.get("features") or []:
            p = feat.get("properties") or {}
            oid = p.get("od_id")
            eng = p.get("engine")
            if not oid or not eng:
                continue
            key = (oid, mode, eng if eng != "mapbox" else f"mapbox_{p.get('rank', 0)}")
            prev = best.get(key)
            if prev is None or mtime >= prev[0]:
                best[key] = (mtime, {**p, "geometry": feat.get("geometry")})
    by_od: dict[str, dict] = defaultdict(lambda: {"day": {}, "night": {}})
    for (oid, mode, eng), (_m, props) in best.items():
        if eng.startswith("mapbox"):
            by_od[oid][mode].setdefault("mapbox", []).append(props)
        else:
            by_od[oid][mode]["challenger"] = props
    return by_od


def casey_only_gap(
    con: duckdb.DuckDBPyConnection,
    origin: list[float],
    dest: list[float],
    *,
    buffer_m: float = 20,
) -> dict:
    """T1EAM segments near straight OD with no OSM walkable way within buffer."""
    scores = DATA_ROOT / "viewer" / "segment_scores_map.geojson"
    if not scores.exists() or not OSM_WAYS.exists():
        return {"error": "missing scores or OSM ways"}
    ox, oy = origin
    dx, dy = dest
    buf = buffer_m / 111_000
    # T1EAM in corridor
    t1 = con.execute(
        f"""
        WITH line AS (
          SELECT ST_MakeLine(ST_Point({ox},{oy}), ST_Point({dx},{dy})) AS geom
        ),
        corridor AS (SELECT ST_Buffer(geom, {buf * 2}) AS geom FROM line)
        SELECT COUNT(*), ROUND(COALESCE(SUM(length_m),0)::DOUBLE,1)
        FROM ST_Read('{scores.as_posix()}') s, corridor c
        WHERE ST_Intersects(s.geom, c.geom)
        """
    ).fetchone()
    # T1EAM with no OSM within 20m of centroid
    orphan = con.execute(
        f"""
        WITH line AS (
          SELECT ST_MakeLine(ST_Point({ox},{oy}), ST_Point({dx},{dy})) AS geom
        ),
        corridor AS (SELECT ST_Buffer(geom, {buf * 2}) AS geom FROM line),
        segs AS (
          SELECT s.segment_id, s.length_m, ST_Centroid(s.geom) AS c
          FROM ST_Read('{scores.as_posix()}') s, corridor cor
          WHERE ST_Intersects(s.geom, cor.geom)
        )
        SELECT COUNT(*), ROUND(COALESCE(SUM(length_m),0)::DOUBLE,1)
        FROM segs
        WHERE NOT EXISTS (
          SELECT 1 FROM ST_Read('{OSM_WAYS.as_posix()}') o
          WHERE ST_DWithin(o.geom, segs.c, {buf})
        )
        """
    ).fetchone()
    return {
        "t1eam_in_corridor_n": t1[0],
        "t1eam_in_corridor_m": t1[1],
        "t1eam_no_osm_within_20m_n": orphan[0],
        "t1eam_no_osm_within_20m_m": orphan[1],
        "casey_only_share": round(orphan[0] / t1[0], 3) if t1[0] else None,
    }


def main() -> int:
    pairs = json.loads(OD_FIXTURE.read_text())["pairs"]
    by_od = latest_features()
    token = load_token()
    load_graph(force=True)
    scores = gpd.read_file(SCORES_EXPORT) if SCORES_EXPORT.exists() else None

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")

    rows = []
    for pair in pairs:
        oid = pair["id"]
        origin = pair["origin"]["center"]
        dest = pair["destination"]["center"]
        day_bucket = by_od.get(oid, {}).get("day", {})
        mb_list = day_bucket.get("mapbox") or []
        ch = day_bucket.get("challenger")

        # Live refresh for verified cut-through ODs if missing
        if not mb_list or not ch:
            try:
                control = mapbox_routes(token, origin, dest)
                mb_shortest = min((r["distance_m"] for r in control), default=None)
            except Exception as exc:  # noqa: BLE001
                mb_shortest = None
                control = []
                print(f"  {oid} mapbox fail: {exc}")
            live_ch = plan_challenger(origin[0], origin[1], dest[0], dest[1], mode="day")
            ch_dist = live_ch["distance_m"] if live_ch else None
        else:
            mb_shortest = min(r["distance_m"] for r in mb_list)
            ch_dist = ch.get("distance_m")
            control = mb_list

        ratio = (
            round(ch_dist / mb_shortest, 3)
            if ch_dist and mb_shortest and mb_shortest > 0
            else None
        )
        gap = casey_only_gap(con, origin, dest)

        # Score displays if we have geometry from results
        ch_day = ch.get("day_display") if ch else None
        mb_day = None
        if mb_list:
            best_mb = min(mb_list, key=lambda r: r["distance_m"])
            mb_day = best_mb.get("day_display")

        flag = []
        if ratio is not None and ratio < 0.85:
            flag.append("challenger_much_shorter")
        if ratio is not None and ratio > 1.2:
            flag.append("challenger_longer")
        if gap.get("casey_only_share") and gap["casey_only_share"] > 0.35:
            flag.append("high_casey_only_share")
        if oid == "OD-11":
            flag.append("mapbox_missed_cutthrough_verified")

        rows.append(
            {
                "od_id": oid,
                "label": pair.get("label"),
                "verified": pair.get("verified", False),
                "mapbox_shortest_m": round(mb_shortest, 1) if mb_shortest else None,
                "challenger_m": round(ch_dist, 1) if ch_dist else None,
                "ratio_ch_vs_mb": ratio,
                "mapbox_day_display": mb_day,
                "challenger_day_display": ch_day,
                "gap": gap,
                "flags": flag,
            }
        )
        print(
            f"{oid}: mb={mb_shortest} ch={ch_dist} ratio={ratio} flags={flag}"
        )

    qa_dir = DATA_ROOT / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    out_json = qa_dir / f"hybrid_od_audit_{date.today().isoformat()}.json"
    payload = {
        "date": date.today().isoformat(),
        "n": len(rows),
        "finding": (
            "OD-11: Mapbox candidate gap, not missing Casey scores. "
            "Hybrid (Mapbox + score-aware) required for credibility."
        ),
        "rows": rows,
    }
    out_json.write_text(json.dumps(payload, indent=2))

    # Markdown for repo
    md_path = REPO_ROOT / "docs" / f"HYBRID_ROUTING_AUDIT_{date.today().isoformat()}.md"
    lines = [
        f"# Hybrid routing audit — {date.today().isoformat()}",
        "",
        "Focused check after OD-11 Fairmead → Hopwood (Mapbox road loop vs Google/Casey cut-through).",
        "",
        "## Verdict",
        "",
        "**Ship hybrid trip mode.** Mapbox alone fails when neighbourhood links are tagged "
        "`cycleway`/`service` (or missing as `footway`) but Casey T1EAM scores them. "
        "Score-aware OSM+Casey Dijkstra already finds the efficient walk on OD-11 (~282 m vs ~486 m).",
        "",
        "True **Casey-only** gaps (T1EAM with no nearby OSM walkable way) need a later T1EAM-native "
        "edge track — do not block hybrid on a full LGA freeze.",
        "",
        "## OD sample (day)",
        "",
        "| OD | Mapbox m | Challenger m | Ratio | Flags |",
        "|----|----------|--------------|-------|-------|",
    ]
    for r in rows:
        flags = ", ".join(r["flags"]) if r["flags"] else "—"
        lines.append(
            f"| {r['od_id']} | {r['mapbox_shortest_m']} | {r['challenger_m']} | "
            f"{r['ratio_ch_vs_mb']} | {flags} |"
        )
    lines.extend(
        [
            "",
            "## Casey-only share (straight OD corridor)",
            "",
            "Share of T1EAM segments in the OD corridor whose centroid has no OSM way within 20 m.",
            "",
            "| OD | T1EAM n | No-OSM n | Share |",
            "|----|---------|----------|-------|",
        ]
    )
    for r in rows:
        g = r["gap"]
        lines.append(
            f"| {r['od_id']} | {g.get('t1eam_in_corridor_n')} | "
            f"{g.get('t1eam_no_osm_within_20m_n')} | {g.get('casey_only_share')} |"
        )
    lines.extend(
        [
            "",
            "## OD-11 detail",
            "",
            "- Mapbox: ~486 m via Raleigh Drive (road loop).",
            "- Challenger: ~282 m via mid-block cycleway/service; Night display ~8.3.",
            "- T1EAM mid-strip: 9 scored segments (~659 m, mean Acc ~83).",
            "- Live Overpass: 0 `footway`/`path` in mid-strip — basemap draws paths; "
            "routing graph under-represents them as dedicated footways.",
            "",
            "## Next",
            "",
            "1. Keep hybrid in resident `/` (challenger service + Mapbox).",
            "2. Preference-weighted edge costs later.",
            "3. T1EAM-native edges only where `casey_only_share` stays high on important ODs.",
            "",
            f"Machine copy: `{out_json.relative_to(REPO_ROOT)}` (under gitignored `pipeline/data/`).",
            "",
        ]
    )
    md_path.write_text("\n".join(lines))
    print(f"\nWrote {md_path}")
    print(f"Wrote {out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
