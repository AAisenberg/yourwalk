#!/usr/bin/env python3
"""Plot the loop backtracking evidence (investigation figure, not product).

Reads /tmp/yourwalk-loop-diag/{cards,experiment}.geojson.
Writes /tmp/yourwalk-loop-diag/loop_backtrack_report.png

Run from pipeline/ with the venv:
    python bakeoff/plot_loop_backtrack.py
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DIAG = Path("/tmp/yourwalk-loop-diag")
START = (145.3485, -38.0405)


def load(name: str) -> list[dict]:
    return json.loads((DIAG / name).read_text())["features"]


def draw_panel(ax, lines, points, title):
    for coords, colour, lw, label in lines:
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        ax.plot(xs, ys, color=colour, linewidth=lw, label=label, alpha=0.9)
    for pts, colour, label in points:
        if not pts:
            continue
        ax.scatter(
            [p[0] for p in pts],
            [p[1] for p in pts],
            s=22,
            color=colour,
            zorder=5,
            label=label,
        )
    ax.scatter([START[0]], [START[1]], marker="*", s=180, color="black", zorder=6)
    ax.set_title(title, fontsize=10)
    ax.set_aspect(1.27)  # ~cos(lat) so shapes are not stretched
    ax.tick_params(labelsize=6)
    handles, labels = ax.get_legend_handles_labels()
    seen: dict[str, object] = {}
    for h, l in zip(handles, labels):
        seen.setdefault(l, h)
    ax.legend(seen.values(), seen.keys(), fontsize=7, loc="best")


def main() -> int:
    cards = load("cards.geojson")
    exp = load("experiment.geojson")

    def card_line(label: str, index: int = 0):
        found = [
            f
            for f in cards
            if f["properties"].get("kind") == "card"
            and f["properties"]["label"] == label
        ]
        return found[index] if index < len(found) else None

    def card_points(label: str, kind: str):
        return [
            f["geometry"]["coordinates"]
            for f in cards
            if f["properties"].get("kind") == kind
            and f["properties"]["label"] == label
        ]

    def exp_line(label: str, pair: str, variant: str):
        for f in exp:
            p = f["properties"]
            if (
                p.get("kind") != "rev15"
                and p["label"] == label
                and p["pair"] == pair
                and p["variant"] == variant
            ):
                return f
        return None

    def exp_points(label: str, pair: str, variant: str):
        return [
            f["geometry"]["coordinates"]
            for f in exp
            if f["properties"].get("kind") == "rev15"
            and f["properties"]["label"] == label
            and f["properties"]["pair"] == pair
            and f["properties"]["variant"] == variant
        ]

    fig, axes = plt.subplots(2, 2, figsize=(13, 11))

    # Panel 1: what the resident saw (shade-max card, Mapbox-drawn)
    c1 = card_line("shade-max")
    if c1:
        p = c1["properties"]
        draw_panel(
            axes[0][0],
            [(c1["geometry"]["coordinates"], "#0d9488", 2.2, "shown card (Mapbox draw)")],
            [
                (card_points("shade-max", "rev15"), "#dc2626", "same-path backtrack (15 m)"),
                (card_points("shade-max", "rev45only"), "#f59e0b", "looks-like backtrack (45 m)"),
            ],
            f"1. Shown today - shade max ({p['duration_min']} min, rev15={p['rev15']})\n"
            "Mapbox draws to a mid-spur via -> out-and-back notch",
        )

    # Panel 2: what the resident saw (footpaths-max card)
    c2 = card_line("footpaths-max")
    if c2:
        p = c2["properties"]
        draw_panel(
            axes[0][1],
            [(c2["geometry"]["coordinates"], "#0d9488", 2.2, "shown card (Mapbox draw)")],
            [
                (card_points("footpaths-max", "rev15"), "#dc2626", "same-path backtrack (15 m)"),
                (card_points("footpaths-max", "rev45only"), "#f59e0b", "looks-like backtrack (45 m)"),
            ],
            f"2. Shown today - footpaths max ({p['duration_min']} min, rev15={p['rev15']})",
        )

    # Panel 3: Casey legs baseline vs penalised (worst overlap pair)
    pair = "loop_casey_149_465"
    base = exp_line("footpaths-max", pair, "baseline")
    pen = exp_line("footpaths-max", pair, "penalise4")
    if base and pen:
        draw_panel(
            axes[1][0],
            [
                (base["geometry"]["coordinates"], "#94a3b8", 3.2, f"baseline legs (rev15={base['properties']['rev15']})"),
                (pen["geometry"]["coordinates"], "#7c3aed", 1.8, f"penalised x4 (rev15={pen['properties']['rev15']})"),
            ],
            [
                (exp_points("footpaths-max", pair, "baseline"), "#dc2626", "baseline backtrack"),
            ],
            "3. Casey 3-leg circuit - footpaths max, same vias\n"
            "cross-leg edge penalty removes leg-on-leg retrace",
        )

    # Panel 4: clean in-band Casey circuit vs shown Mapbox card (same via pair)
    clean = exp_line("shade-max", "loop_casey_66_465", "baseline")
    if clean and c1:
        draw_panel(
            axes[1][1],
            [
                (c1["geometry"]["coordinates"], "#94a3b8", 3.2, f"shown Mapbox card (rev15={c1['properties']['rev15']})"),
                (clean["geometry"]["coordinates"], "#16a34a", 1.8, f"Casey circuit, same vias (rev15={clean['properties']['rev15']})"),
            ],
            [
                (card_points("shade-max", "rev15"), "#dc2626", "Mapbox card backtrack"),
            ],
            "4. Same turning points, drawn on the Casey graph\n"
            f"{clean['properties']['duration_min']} min in-band, zero same-path backtrack",
        )

    for ax in axes.flat:
        ax.set_xlabel("lng", fontsize=7)
        ax.set_ylabel("lat", fontsize=7)

    fig.suptitle(
        "Montpelier 30 min Loop - backtracking investigation (16 Aug 2026)",
        fontsize=13,
    )
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    out = DIAG / "loop_backtrack_report.png"
    fig.savefig(out, dpi=130)
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
