#!/usr/bin/env python3
"""Run Mapbox control vs score-aware challenger on bake-off OD sample."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import httpx
from shapely.geometry import LineString, mapping, shape

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from build_graph import reset_node_index  # noqa: E402
from challenger import challenger_route, load_graph  # noqa: E402
from paths import (  # noqa: E402
    GRAPH_PICKLE,
    OD_FIXTURE,
    RESULTS_DIR,
    SCORES_EXPORT,
    ensure_bakeoff_dirs,
)
from score_corridor import score_route  # noqa: E402

MAPBOX_BASE = "https://api.mapbox.com/directions/v5/mapbox/walking"


def load_token() -> str:
    token = os.environ.get("MAPBOX_ACCESS_TOKEN") or os.environ.get("NEXT_PUBLIC_MAPBOX_TOKEN")
    if token:
        return token.strip()
    # web/.env.local
    env_local = ROOT.parent.parent / "web" / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            if line.startswith("NEXT_PUBLIC_MAPBOX_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("Set MAPBOX_ACCESS_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN (web/.env.local)")


def mapbox_routes(
    token: str,
    origin: list[float],
    dest: list[float],
) -> list[dict]:
    """Return list of {geometry LineString, distance_m, duration_s, strategy}."""
    coords = f"{origin[0]},{origin[1]};{dest[0]},{dest[1]}"
    variants = [
        {"alternatives": "true", "strategy": "alternatives"},
        {"alternatives": "false", "walkway_bias": "0.8", "strategy": "walkway_prefer"},
        {"alternatives": "false", "walkway_bias": "-0.4", "strategy": "walkway_less"},
    ]
    seen: list[tuple[float, LineString]] = []
    out: list[dict] = []

    with httpx.Client(timeout=60.0) as client:
        for v in variants:
            params = {
                "access_token": token,
                "geometries": "geojson",
                "overview": "full",
                "steps": "false",
                "alternatives": v.get("alternatives", "false"),
            }
            if "walkway_bias" in v:
                params["walkway_bias"] = v["walkway_bias"]
            r = client.get(f"{MAPBOX_BASE}/{coords}", params=params)
            if r.status_code != 200:
                continue
            data = r.json()
            for route in data.get("routes") or []:
                geom = route.get("geometry")
                if not geom:
                    continue
                line = shape(geom)
                if line.geom_type != "LineString":
                    continue
                dist = float(route.get("distance") or 0)
                # dedupe by rough length + endpoint
                key = round(dist, -1)
                if any(abs(k - key) < 15 and line.equals_exact(ln, 1e-5) for k, ln in seen):
                    continue
                # simpler dedupe: length within 5% and similar bbox
                dup = False
                for k, ln in seen:
                    if abs(k - dist) / max(dist, 1) < 0.05 and abs(ln.length - line.length) < 1e-4:
                        dup = True
                        break
                if dup:
                    continue
                seen.append((dist, line))
                out.append(
                    {
                        "geometry": line,
                        "distance_m": dist,
                        "duration_s": float(route.get("duration") or 0),
                        "strategy": v["strategy"],
                        "engine": "mapbox",
                    }
                )
    # reject > 1.3× shortest (trip-mode policy)
    if out:
        shortest = min(r["distance_m"] for r in out)
        out = [r for r in out if r["distance_m"] <= shortest * 1.3]
    return out[:3]


def load_ods(only: str | None) -> list[dict]:
    data = json.loads(OD_FIXTURE.read_text())
    pairs = data["pairs"]
    if only:
        pairs = [p for p in pairs if p["id"] == only]
        if not pairs:
            raise SystemExit(f"Unknown OD id {only}")
    return pairs


def main() -> int:
    parser = argparse.ArgumentParser(description="YourWalk L2c bake-off harness")
    parser.add_argument("--od", help="Run a single OD id (e.g. OD-01)")
    parser.add_argument("--mode", choices=("day", "night"), default="day")
    args = parser.parse_args()

    ensure_bakeoff_dirs()
    if not GRAPH_PICKLE.exists():
        print("Run: export_scores → fetch_and_join_osm → build_graph", file=sys.stderr)
        return 1
    if not SCORES_EXPORT.exists():
        print("Missing scores export", file=sys.stderr)
        return 1

    token = load_token()
    reset_node_index()
    g = load_graph(force=True)
    scores = gpd.read_file(SCORES_EXPORT)
    pairs = load_ods(args.od)

    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    if args.od:
        stamp = f"{stamp}_{args.od}"
    csv_path = RESULTS_DIR / f"bakeoff_{stamp}_{args.mode}.csv"
    gj_path = RESULTS_DIR / f"bakeoff_{stamp}_{args.mode}.geojson"
    rows: list[dict] = []
    features: list[dict] = []

    print(f"Graph {g.number_of_nodes()} nodes / {g.number_of_edges()} edges · mode={args.mode}")
    print(f"Running {len(pairs)} OD pair(s)…\n")

    for pair in pairs:
        oid = pair["id"]
        origin = pair["origin"]["center"]
        dest = pair["destination"]["center"]
        print(f"=== {oid} {pair['label']} ===")

        control = mapbox_routes(token, origin, dest)
        if not control:
            print("  Mapbox: no routes")
        score_key = "day_display" if args.mode == "day" else "night_display"
        for i, r in enumerate(control):
            sc = score_route(r["geometry"], scores)
            row = {
                "od_id": oid,
                "mode": args.mode,
                "engine": r["engine"],
                "strategy": r["strategy"],
                "rank": i,
                "distance_m": round(r["distance_m"], 1),
                "duration_s": round(r["duration_s"], 1),
                "day_display": round(sc["day_display"], 2) if sc["day_display"] is not None else None,
                "night_display": round(sc["night_display"], 2) if sc["night_display"] is not None else None,
                "accessibility_display": round(sc["accessibility_display"], 2)
                if sc["accessibility_display"] is not None
                else None,
                "coverage_ratio": round(sc["coverage_ratio"], 3),
                "confidence": sc["confidence"],
                "verified_od": pair.get("verified", False),
            }
            rows.append(row)
            features.append(
                {
                    "type": "Feature",
                    "properties": {**row, "label": pair["label"]},
                    "geometry": mapping(r["geometry"]),
                }
            )
            print(
                f"  mapbox[{i}] {row['distance_m']:.0f}m {row['duration_s']/60:.1f}min "
                f"{args.mode}={row[score_key]} cov={row['coverage_ratio']}"
            )

        ch = challenger_route(g, origin, dest, mode=args.mode)
        if ch is None:
            print("  challenger: no path")
        else:
            sc = score_route(ch["geometry"], scores)
            shortest = min((r["distance_m"] for r in control), default=ch["distance_m"])
            detour = ch["distance_m"] / shortest if shortest else None
            row = {
                "od_id": oid,
                "mode": args.mode,
                "engine": ch["engine"],
                "strategy": ch["strategy"],
                "rank": 0,
                "distance_m": round(ch["distance_m"], 1),
                "duration_s": round(ch["duration_s"], 1),
                "day_display": round(sc["day_display"], 2) if sc["day_display"] is not None else None,
                "night_display": round(sc["night_display"], 2) if sc["night_display"] is not None else None,
                "accessibility_display": round(sc["accessibility_display"], 2)
                if sc["accessibility_display"] is not None
                else None,
                "coverage_ratio": round(sc["coverage_ratio"], 3),
                "confidence": sc["confidence"],
                "detour_vs_mapbox_shortest": round(detour, 3) if detour else None,
                "verified_od": pair.get("verified", False),
            }
            rows.append(row)
            features.append(
                {
                    "type": "Feature",
                    "properties": {**row, "label": pair["label"]},
                    "geometry": mapping(ch["geometry"]),
                }
            )
            print(
                f"  challenger  {row['distance_m']:.0f}m {row['duration_s']/60:.1f}min "
                f"{args.mode}={row[score_key]} cov={row['coverage_ratio']} "
                f"detour={row.get('detour_vs_mapbox_shortest')}"
            )
        print()
        time.sleep(0.3)  # be kind to Mapbox / Overpass leftovers

    fieldnames = sorted({k for r in rows for k in r})
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    gj_path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, indent=2))
    print(f"Wrote {csv_path}")
    print(f"Wrote {gj_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
