"""Plot the routing graph around 32 McNaughton Cr, Berwick: are the oval /
park paths present and connected, and where do best vs away actually go?"""

from __future__ import annotations

import json
import pickle
import urllib.request

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from paths import GRAPH_PICKLE

ORIGIN = (145.324383, -38.053105)
DEST_E = (145.3369, -38.0525)
PAD = 0.010

g = pickle.loads(GRAPH_PICKLE.read_bytes())

fig, ax = plt.subplots(figsize=(13, 11))
x0, x1 = ORIGIN[0] - PAD, ORIGIN[0] + PAD
y0, y1 = ORIGIN[1] - PAD, ORIGIN[1] + PAD

PATHISH = {"footway", "path", "track", "cycleway", "pedestrian", "steps"}

for u, v, d in g.edges(data=True):
    geom = d.get("geometry")
    if geom is None:
        continue
    xs, ys = geom.xy
    if max(xs) < x0 or min(xs) > x1 or max(ys) < y0 or min(ys) > y1:
        continue
    hw = d.get("highway", "")
    if hw == "sidewalk":
        ax.plot(xs, ys, color="#7FB3D5", lw=1.0, zorder=2)
    elif hw == "crossing":
        ax.plot(xs, ys, color="#B03A2E", lw=0.8, ls=":", zorder=3)
    elif hw in PATHISH:
        ax.plot(xs, ys, color="#1E8449", lw=1.8, zorder=4)
    else:
        ax.plot(xs, ys, color="#BDBDBD", lw=0.7, zorder=1)


def call_route(extra):
    body = {
        "origin": {"lng": ORIGIN[0], "lat": ORIGIN[1]},
        "destination": {"lng": DEST_E[0], "lat": DEST_E[1]},
        "mode": "day",
        "prefs": {"accessibility": 60, "shadeHeat": 85, "afterDark": 40, **extra},
    }
    req = urllib.request.Request(
        "http://127.0.0.1:8790/route",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["route"]


best = call_route({})
away = call_route({"preferSharedPaths": True})
bx = [c[0] for c in best["geometry"]["coordinates"]]
by = [c[1] for c in best["geometry"]["coordinates"]]
ax.plot(bx, by, color="#0E7C7B", lw=3.5, alpha=0.85, zorder=6, label="best (teal)")
ax_ = [c[0] for c in away["geometry"]["coordinates"]]
ay_ = [c[1] for c in away["geometry"]["coordinates"]]
ax.plot(ax_, ay_, color="#E67E22", lw=2.2, ls="--", zorder=7, label="away (dashed amber)")

ax.plot(*ORIGIN, "o", ms=12, color="#27AE60", zorder=8)
ax.plot(*DEST_E, "o", ms=12, color="#C0392B", zorder=8)

ax.set_xlim(x0, x1)
ax.set_ylim(y0, y1)
ax.set_aspect(1 / 0.788)
ax.legend(loc="lower right")
ax.set_title(
    "32 McNaughton Cr, Berwick — graph coverage\n"
    "green=off-road paths, blue=sidewalk edges, grey=roads, red dots=crossings"
)
out = "data/bakeoff/qa_mcnaughton_area.png"
plt.tight_layout()
plt.savefig(out, dpi=110)
print("saved", out)
print("best m:", round(best["distance_m"]), " away m:", round(away["distance_m"]))
