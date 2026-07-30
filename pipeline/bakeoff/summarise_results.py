#!/usr/bin/env python3
"""Summarise a bake-off CSV into a markdown table."""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from paths import RESULTS_DIR  # noqa: E402


def latest_csv(mode: str | None = None) -> Path:
    pattern = f"bakeoff_*_{mode}.csv" if mode else "bakeoff_*.csv"
    files = sorted(RESULTS_DIR.glob(pattern))
    if not files:
        raise SystemExit(f"No results matching {pattern} in {RESULTS_DIR}")
    return files[-1]


def main() -> int:
    mode = None
    path = None
    args = sys.argv[1:]
    if args and args[0] in ("day", "night"):
        mode = args[0]
        path = latest_csv(mode)
    elif args:
        path = Path(args[0])
    else:
        path = latest_csv()

    rows = list(csv.DictReader(path.open()))
    if not rows:
        raise SystemExit("Empty results")
    mode = rows[0].get("mode") or mode or "day"
    score_col = "night_display" if mode == "night" else "day_display"

    by_od: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_od[r["od_id"]].append(r)

    print(f"# Bake-off summary ({mode}) — `{path.name}`\n")
    print(
        f"| OD | Mapbox best {mode} | Challenger {mode} | Δ | Detour | Winner |"
    )
    print("|----|------------------:|-----------------:|----:|-------:|:-------|")
    c_wins = m_wins = ties = 0
    for od in sorted(by_od):
        group = by_od[od]
        maps = [r for r in group if r["engine"] == "mapbox"]
        chals = [r for r in group if r["engine"] != "mapbox"]
        if not maps or not chals:
            continue

        def score(r: dict) -> float:
            v = r.get(score_col) or ""
            return float(v) if v not in ("", None) else float("-inf")

        mb = max(maps, key=score)
        ch = chals[0]
        mb_s, ch_s = score(mb), score(ch)
        delta = ch_s - mb_s
        detour = ch.get("detour_vs_mapbox_shortest") or ""
        if abs(delta) < 0.05:
            winner = "tie"
            ties += 1
        elif delta > 0:
            winner = "challenger"
            c_wins += 1
        else:
            winner = "mapbox"
            m_wins += 1
        print(
            f"| {od} | {mb_s:.2f} | {ch_s:.2f} | {delta:+.2f} | {detour} | {winner} |"
        )
    print()
    print(f"**{mode.title()} wins:** challenger {c_wins} · mapbox {m_wins} · tie {ties}")
    print(
        "\nDetour < 1 means challenger shorter than Mapbox shortest. "
        "Winner uses ±0.05 display-point tie band."
    )
    print(f"\nSource: `{path}`")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
