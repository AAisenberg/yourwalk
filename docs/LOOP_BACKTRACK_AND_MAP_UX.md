# Loop backtracks + map route UX (notes, 30 Jul 2026)

Working notes from Hampton Park / Waratah South loop testing. Not methodology — product/engineering follow-ups.

## What we’re seeing

Around-here **Loop** can produce real circuits (~40 min looking good) but Mapbox walking often inserts **dead-end spurs**: walk into a cul-de-sac or side street, reverse the same segment, then continue. On the map that reads as a little out-and-back notch on an otherwise fine loop.

Separately, when Loop generation fails duration/circuit filters, older builds mixed in **there-and-back** options (single line out). That path is being kept honest: Loop results should be circuits only.

## Idea A — Snip recognised backtracks

**Ask:** When a reverse spur is detected, cut it out of the geometry and continue the circuit without that stub.

| | |
|--|--|
| **Feasible?** | Yes, as a **post-process** on the LineString (not a new Mapbox mode). |
| **How** | Walk densified samples; when the path later re-covers an earlier corridor within ~30–40 m after ≥~80 m of travel, mark a “spur”. Collapse the out-and-back segment so the polyline jumps from spur entry → resume point. Recompute distance/duration ≈ remaining length / walk speed (or re-ask Mapbox on cleaned waypoints — heavier). |
| **Wins** | Cleaner map; less “why did it go down there?”; duration closer to the useful circuit. |
| **Risks** | Over-snip shared leave/return stubs at the start pin (mid-block starts need a short same-path leave/return). Snipping can create a polyline that isn’t a legal walk if the “continue” edge isn’t connected — safer to only snip when entry≈exit vertex on the same approach. Don’t change Casey **index** maths from snipped amenity proximity. |
| **Effort** | Medium for a careful spur clipper + QA on Casey grids; high if we also re-route through the challenger graph. |

**Lean:** Worth a dedicated spike after Loop results are consistently circuits. Start with **detect + score/reject** (already partly done via revisit ratio), then **snip only clear cul-de-sac spurs** (spur length &lt; ~120 m, reverse overlap on that window &gt; ~0.85), leave start-pin stubs alone.

## Idea B — Google-like map route chrome

Reference: selected walk = strong dotted path; alternatives = quieter coloured lines; optional time/distance chips on the map; tap path or chip to select.

| | |
|--|--|
| **Fits YourWalk?** | Yes for results sheet — reduces card-only selection and matches mental model. |
| **Mapbox GL** | Selected: `line-dasharray` + higher width/opacity. Alternatives: lower opacity, no dash (or lighter dash). Chips: `Marker` or HTML overlay at route midpoint / “farthest from start” point. |
| **Care** | Don’t imply Google parity or turn-by-turn navigation. Keep Casey score pills on cards. Mobile: chips must not cover the start pin or fight the bottom sheet. |
| **Effort** | Low–medium for paint styles + selection; medium for chips + hit-testing. |

**Lean:** Strong next UX slice once Loop quality is stable for a demo. Do **selected vs alternative styling** first; chips second.

## What to focus on next (recommended order)

1. **Loop quality lock** — circuits only under Loop; duration sizing; fewer there-and-back contaminants; tighten spur *rejection* so the worst cul-de-sac notches don’t win Recommended.
2. **Map route chrome** — dotted/selected + quieter alternatives + tap-to-select (Google-like, YourWalk colours).
3. **Backtrack snip spike** — optional geometry cleanup for remaining short spurs; document failure cases.
4. **Shareable A→B + “Why this walk?”** — per [`FLOWS/02`](FLOWS/02_tell_us_about_your_walk.md).
5. **Colour / brand polish** — after the flow reads clearly.

## Out of scope for this note

- Full score-aware graph circuits (challenger) as the only loop engine — later north star.
- Open in Apple/Google Maps (discards Casey geometry) — deferred.
- Accounts / saved walks — icebox.
