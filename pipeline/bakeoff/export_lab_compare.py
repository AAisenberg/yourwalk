#!/usr/bin/env python3
"""Package bake-off GeoJSON into web/public for /lab compare UI.

Merges **all** `bakeoff_*_{day|night}.geojson` result files so newer single-OD
runs (e.g. OD-11) do not wipe OD-01…10. Newest file wins per (od_id, engine, mode).
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from paths import OD_FIXTURE, RESULTS_DIR, REPO_ROOT  # noqa: E402

OUT = REPO_ROOT / "web" / "public" / "bakeoff" / "compare.json"

REASONING = {
    "headline": (
        "Hybrid trip mode: Mapbox proposes walks; score-aware adds neighbourhood "
        "links Mapbox misses (OD-11 Fairmead cut-through). Day Index varies more "
        "across Casey; Night sits higher and more compressed."
    ),
    "evidence": [
        "OD-11 (30 Jul 2026): Mapbox ~486 m road loop; challenger ~282 m cut-through; "
        "Casey T1EAM scores the mid-block strip Mapbox skipped.",
        "OSM mid-strip links are often tagged cycleway/service, not footway — "
        "Mapbox walking under-uses them; our graph includes them.",
        "Cost v2 uses percentile normalisation so Day/Night get equal swing; "
        "plus 1.15× detour cap vs graph-shortest (OD-05 fix).",
        "Night Index shares Accessibility 60% with Day; lighting lifts the floor "
        "so many corridors look ‘good enough’ at night.",
    ],
}


def all_mode_files(mode: str) -> list[Path]:
    return sorted(RESULTS_DIR.glob(f"bakeoff_*_{mode}.geojson"))


def main() -> int:
    od_meta = {p["id"]: p for p in json.loads(OD_FIXTURE.read_text())["pairs"]}
    # key: (od_id, mode, engine, rank_or_challenger) → entry with mtime
    best: dict[tuple, tuple[float, dict]] = {}

    sources: dict[str, str] = {}
    for mode in ("day", "night"):
        files = all_mode_files(mode)
        if not files:
            print(f"No {mode} geojson in {RESULTS_DIR}", file=sys.stderr)
            continue
        sources[mode] = files[-1].name
        for path in files:
            mtime = path.stat().st_mtime
            fc = json.loads(path.read_text())
            for feat in fc.get("features") or []:
                props = feat.get("properties") or {}
                oid = props.get("od_id")
                if not oid:
                    continue
                engine = props.get("engine") or "unknown"
                rank = props.get("rank", 0)
                key = (oid, mode, engine, rank if engine == "mapbox" else "ch")
                entry = {
                    "geometry": feat.get("geometry"),
                    "distance_m": props.get("distance_m"),
                    "duration_s": props.get("duration_s"),
                    "day_display": props.get("day_display"),
                    "night_display": props.get("night_display"),
                    "accessibility_display": props.get("accessibility_display"),
                    "coverage_ratio": props.get("coverage_ratio"),
                    "confidence": props.get("confidence"),
                    "strategy": props.get("strategy"),
                    "detour_vs_mapbox_shortest": props.get(
                        "detour_vs_mapbox_shortest"
                    ),
                }
                prev = best.get(key)
                if prev is None or mtime >= prev[0]:
                    best[key] = (mtime, entry)

    by_od: dict[str, dict] = defaultdict(lambda: {"day": {}, "night": {}})
    for (oid, mode, engine, rank), (_mt, entry) in best.items():
        bucket = by_od[oid][mode]
        if engine == "mapbox":
            bucket.setdefault("mapbox", [])
            # store with rank for sort
            bucket["mapbox"].append((rank if isinstance(rank, int) else 0, entry))
        else:
            bucket["challenger"] = entry

    for oid in by_od:
        for mode in ("day", "night"):
            mb = by_od[oid][mode].get("mapbox")
            if isinstance(mb, list) and mb and isinstance(mb[0], tuple):
                mb_sorted = sorted(mb, key=lambda t: t[0])
                by_od[oid][mode]["mapbox"] = [e for _, e in mb_sorted]

    # Include fixture ODs even if no bake-off run yet (origin/dest for jumper parity)
    od_ids = sorted(set(od_meta) | set(by_od), key=lambda x: (len(x), x))
    ods = []
    for oid in od_ids:
        meta = od_meta.get(oid, {})
        day = by_od.get(oid, {}).get("day", {})
        night = by_od.get(oid, {}).get("night", {})
        ods.append(
            {
                "id": oid,
                "label": meta.get("label", oid),
                "why": meta.get("why"),
                "verified": meta.get("verified", False),
                "origin": (meta.get("origin") or {}).get("center"),
                "destination": (meta.get("destination") or {}).get("center"),
                "day": day,
                "night": night,
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_from": sources,
        "reasoning": REASONING,
        "ods": ods,
    }
    OUT.write_text(json.dumps(payload, indent=2))
    with_routes = sum(
        1
        for o in ods
        if o["day"].get("mapbox")
        or o["day"].get("challenger")
        or o["night"].get("mapbox")
        or o["night"].get("challenger")
    )
    print(f"Wrote {len(ods)} ODs ({with_routes} with routes) → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
