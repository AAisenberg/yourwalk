#!/usr/bin/env python3
"""Sanity checks for road-class cost bias (no graph pickle required)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from graph_runtime import edge_cost, highway_cost_mult  # noqa: E402


def main() -> int:
    assert highway_cost_mult("footway") == 1.0
    assert highway_cost_mult("crossing") == 1.0
    assert highway_cost_mult("residential") == 1.75
    assert highway_cost_mult("secondary") == 2.0
    assert highway_cost_mult("service") == 1.25
    assert highway_cost_mult("path", prefer_away=True) == 0.75
    assert highway_cost_mult("cycleway", prefer_away=True) == 0.75
    assert highway_cost_mult("footway", prefer_away=True) == 1.45
    assert highway_cost_mult("residential", prefer_away=True) == 2.5

    # 13% longer sidewalk vs parallel residential road — footpath must win
    sidewalk = edge_cost(379, 70, p10=40, p90=80, highway="footway")
    road = edge_cost(335, 70, p10=40, p90=80, highway="residential")
    assert sidewalk < road, (sidewalk, road)

    # No footpath: road stays cheaper than a huge path detour
    only_road = edge_cost(200, 70, p10=40, p90=80, highway="residential")
    long_path = edge_cost(500, 70, p10=40, p90=80, highway="footway")
    assert only_road < long_path, (only_road, long_path)

    print("edge cost checks OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
