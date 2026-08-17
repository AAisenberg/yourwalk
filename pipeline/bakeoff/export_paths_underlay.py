#!/usr/bin/env python3
"""Export walkable-network centrelines for the resident map underlay.

The resident day/night map used to draw the raw T1EAM pavement polygons,
which read as "shards" at street zooms. This exports the graph's pathish
edges (including ADR-011 sidewalk edges, whose geometry is already offset
to the pavement side) as merged lines — one artefact powers a clean
line-based underlay and stays consistent with what routing actually uses.

Sidewalk edges are welded per OSM way using the original centreline node
topology (their offset endpoints do not coincide at bends), averaging the
offset joints so chains draw as one smooth polyline.

Output: pipeline/data/bakeoff/casey_paths_underlay.geojson
Host:   GitHub release map-data-v1 (see web /api/map-data proxy).
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

from shapely.geometry import LineString
from shapely.ops import linemerge

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from graph_runtime import PATHISH_HIGHWAYS, norm_highway  # noqa: E402
from paths import BAKEOFF_DATA, GRAPH_PICKLE  # noqa: E402

OUT = BAKEOFF_DATA / "casey_paths_underlay.geojson"
# Crossings are 5-20 m connector stubs — noise at underlay zooms.
SKIP = {"crossing"}
# ~1.1 m — plenty under the 4.5 m sidewalk offset, halves coordinate bytes.
COORD_DECIMALS = 5

Node = tuple[float, float]
SwEdge = tuple[Node, Node, list[tuple[float, float]]]


def _weld_sidewalk_chains(edges: list[SwEdge]) -> list[list[tuple[float, float]]]:
    """Chain sidewalk edges via centreline topology; average offset joints."""
    adj: dict[Node, list[int]] = {}
    for i, (u, v, _) in enumerate(edges):
        adj.setdefault(u, []).append(i)
        adj.setdefault(v, []).append(i)

    used: set[int] = set()
    chains: list[list[int]] = []

    def walk(start: Node, first: int) -> list[int]:
        chain = [first]
        used.add(first)
        u, v, _ = edges[first]
        cur = v if u == start else u
        while len(adj.get(cur, [])) == 2:
            nxt = [j for j in adj[cur] if j not in used]
            if not nxt:
                break
            j = nxt[0]
            used.add(j)
            chain.append(j)
            uu, vv, _ = edges[j]
            cur = vv if uu == cur else uu
        return chain

    for n, incident in adj.items():
        if len(incident) == 2:
            continue
        for i in incident:
            if i not in used:
                chains.append(walk(n, i))
    for i in range(len(edges)):  # pure rings
        if i not in used:
            u, _, _ = edges[i]
            chains.append(walk(u, i))

    out: list[list[tuple[float, float]]] = []
    for chain in chains:
        # Orient each edge's offset segment along the walk, then join with
        # midpoints so bend gaps between offset segments disappear.
        first_u, first_v, _ = edges[chain[0]]
        if len(chain) > 1:
            nu, nv, _ = edges[chain[1]]
            prev = first_v if first_v in (nu, nv) else first_u
            start = first_u if prev == first_v else first_v
        else:
            start, prev = first_u, first_v
        coords: list[tuple[float, float]] = []
        cur = start
        pending: tuple[float, float] | None = None
        for i in chain:
            u, v, seg = edges[i]
            a, b = seg[0], seg[-1]
            if u != cur:
                a, b = b, a
                cur = u
            else:
                cur = v
            if pending is None:
                coords.append(a)
            else:
                coords.append(((pending[0] + a[0]) / 2, (pending[1] + a[1]) / 2))
            pending = b
        if pending is not None:
            coords.append(pending)
        if len(coords) >= 2:
            out.append(coords)
    return out


def main() -> int:
    g = pickle.loads(GRAPH_PICKLE.read_bytes())

    plain: dict[tuple[object, str], list[LineString]] = {}
    sidewalks: dict[object, list[SwEdge]] = {}
    for u, v, d in g.edges(data=True):
        hw = norm_highway(d.get("highway"))
        if hw not in PATHISH_HIGHWAYS or hw in SKIP:
            continue
        if d.get("synthetic_crossing"):
            continue
        geom = d.get("geometry") or LineString([u, v])
        if hw == "sidewalk":
            seg = [(float(x), float(y)) for x, y in geom.coords]
            sidewalks.setdefault(d.get("osm_id"), []).append((u, v, seg))
        else:
            plain.setdefault((d.get("osm_id"), hw), []).append(geom)

    features = []

    def emit(coords_list: list[tuple[float, float]], hw: str) -> None:
        coords = [
            [round(x, COORD_DECIMALS), round(y, COORD_DECIMALS)]
            for x, y in coords_list
        ]
        if len(coords) < 2:
            return
        features.append(
            {
                "type": "Feature",
                "properties": {"hw": hw},
                "geometry": {"type": "LineString", "coordinates": coords},
            }
        )

    for (_, hw), lines in plain.items():
        merged = linemerge(lines) if len(lines) > 1 else lines[0]
        parts = merged.geoms if merged.geom_type == "MultiLineString" else [merged]
        for part in parts:
            emit(list(part.coords), hw)

    n_sw = 0
    for _, sw_edges in sidewalks.items():
        for coords in _weld_sidewalk_chains(sw_edges):
            emit(coords, "sidewalk")
            n_sw += 1

    OUT.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            separators=(",", ":"),
        )
    )
    size_mb = OUT.stat().st_size / 1e6
    print(
        f"{len(features)} lines ({n_sw} welded sidewalk chains) → {OUT} ({size_mb:.1f} MB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
