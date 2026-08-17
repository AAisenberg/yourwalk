"""One-off QA probe: why does 'Away from roads' vanish at 32 McNaughton Cr?

Replicates the client's three challenger calls (best / complement / away)
for a set of plausible destinations near the origin, then applies the same
dedupe heuristic as web/src/lib/routing/planRoute.ts isGeometryDistinct to
report which exit dropped the away card.
"""

from __future__ import annotations

import json
import math
import urllib.request

BASE = "http://127.0.0.1:8790"
ORIGIN = (145.324383, -38.053105)  # 32 McNaughton Cr, Berwick

DESTS = {
    "E ~1.1km (2 Ashfield Dr side)": (145.3369, -38.0525),
    "S ~1.0km (Fieldstone Blvd side)": (145.3252, -38.0621),
    "N ~0.9km (Bemersyde Dr side)": (145.3220, -38.0450),
    "W ~1.2km (Buchanan Rd side)": (145.3110, -38.0545),
}

PREFS = {"accessibility": 60, "shadeHeat": 85, "afterDark": 40}


def call_route(dest, extra_prefs):
    body = {
        "origin": {"lng": ORIGIN[0], "lat": ORIGIN[1]},
        "destination": {"lng": dest[0], "lat": dest[1]},
        "mode": "day",
        "prefs": {**PREFS, **extra_prefs},
    }
    req = urllib.request.Request(
        f"{BASE}/route",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def sample_points(coords, n=7):
    cum = [0.0]
    for i in range(1, len(coords)):
        ax, ay = coords[i - 1]
        bx, by = coords[i]
        kx = math.cos(math.radians((ay + by) / 2))
        cum.append(cum[-1] + math.hypot((bx - ax) * kx, by - ay))
    total = cum[-1]
    if total == 0:
        return [coords[0]] * n
    out = []
    seg = 1
    for i in range(n):
        t = (i / (n - 1)) * total
        while seg < len(cum) - 1 and cum[seg] < t:
            seg += 1
        t0, t1 = cum[seg - 1], cum[seg]
        f = (t - t0) / (t1 - t0) if t1 > t0 else 0
        a, b = coords[seg - 1], coords[seg]
        out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
    return out


def is_distinct(cand_coords, cand_dist, others):
    for geom, dist in others:
        ratio = abs(cand_dist - dist) / max(cand_dist, dist, 1)
        if ratio > 0.22:
            continue
        a = sample_points(cand_coords)
        b = sample_points(geom)
        close = 0
        s = 0.0
        for (ax, ay), (bx, by) in zip(a, b):
            d = math.hypot(ax - bx, ay - by)
            s += d
            if d < 0.0011:
                close += 1
        if close >= 5 or (s / len(a)) < 0.0007:
            return False
    return True


def pathish_share(route):
    return route.get("pathish_share")


for name, dest in DESTS.items():
    best = call_route(dest, {})
    comp = call_route(dest, {"complement": True})
    away = call_route(dest, {"preferSharedPaths": True})

    rows = []
    others = []
    for label, resp in [("best", best), ("complement", comp), ("away", away)]:
        rt = resp.get("route")
        if not rt:
            rows.append(f"  {label:10s} -> NO ROUTE ({resp.get('reason')})")
            continue
        coords = rt["geometry"]["coordinates"]
        dist = rt["distance_m"]
        distinct = is_distinct(coords, dist, others)
        rows.append(
            f"  {label:10s} -> {dist:6.0f} m  pathish={pathish_share(rt)}"
            f"  strategy={rt.get('strategy')}  {'DISTINCT' if distinct else 'DEDUPED (dropped)'}"
        )
        if distinct:
            others.append((coords, dist))
    print(f"\n{name}")
    print("\n".join(rows))
