# Routing outputs — how YourWalk delivers walk options

**Status:** Pilot practice (resident A→B) — locked for beta QA 8 Aug 2026  
**Product:** YourWalk · City of Casey  
**Related:** [`DECISIONS.md`](DECISIONS.md) ADR-001 · [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) (scores only) · [`REQS/routing.md`](REQS/routing.md) · code under `web/src/lib/routing/`

This document is the **methodology for route geometries shown in the UI**. It is separate from Day/Night Index maths. Scores still come from Casey T1EAM segment aggregation; this page covers **which lines we are allowed to show** and **how we diversify path-safe options**.

## Product rule (non-negotiable for resident trip options)

**Never show a walk option whose line follows the road carriageway** (centre of the trafficked roadway) when a path / footway / sidewalk / cycleway alignment exists.

Residents read the map literally. A teal line down the middle of a street is not an acceptable “walking option,” even if Mapbox Directions returns it and even if time/distance look competitive.

## What residents see

| Layer | Role |
|-------|------|
| **Mapbox Directions** `walking` | Primary candidate geometries (1–3 after filters) |
| **Score-aware challenger** (optional) | Distinct OSM+Casey path when the local graph service is up |
| **Casey T1EAM scores** | Length-weighted corridor pills + match ranking (not geometry) |
| **Prefer away from roads** | **Generation-time** switch: widens detour to ~1.6× and requests an off-road-biased challenger (parks / trails). Ranking still adds a shared-use bonus. Does **not** replace the carriageway gate |

## Generation pipeline (A→B trip)

Order matters. Implemented in `web/src/lib/routing/directions.ts`, `carriageway.ts`, `planRoute.ts`.

```
1. Request Mapbox walking candidates
2. Dedupe similar geometries
3. Detour gate (Mapbox only): drop if longer than 1.3 × shortest Mapbox
4. Carriageway gate: drop if Streets samples say “on road”
5. Merge distinct Casey cards: preference-best challenger, then the other pathish corridor (invert stream, no prefix penalty) when geometrically distinct. When Prefer away from roads is on, also merge an off-road-biased variant (1.6× detour)
6. If Casey merged: drop Mapbox cards that still look mid-carriageway (`centreline_look_share` ≥ 0.28). Keep Mapbox when it is a different path-safe corridor, or when Casey is absent
7. Cap ~3 cards → preference / match ranking for Recommended
```

### 1. Mapbox candidate requests

| Strategy | Parameters | Intent |
|----------|------------|--------|
| `alternatives` | `alternatives=true`, **no** `walkway_bias` | Diverse footpath-aligned geometries Mapbox already knows |
| `walkway_prefer` | `walkway_bias=0.8` | Nudge toward walkways / paths for a second distinct option |

**Do not request `walkway_bias < 0`.** Negative bias asks Mapbox to prefer roads. On 8 Aug 2026 (16 Epsom Lane, Cranbourne North → 16 Arubi Avenue, Clyde North) that produced a ~3340 m option with ~50% of samples on primary / secondary / residential carriageways.

Evidence on that OD:

| Candidate | Approx. length | Carriageway share (Mapbox Streets tilequery) |
|-----------|----------------|-----------------------------------------------|
| `alternatives` (no bias) | ~3174 m | ~0% (path / footway / cycleway / sidewalk) |
| `walkway_prefer` (0.8) | ~3220 m | ~0% |
| `walkway_less` (−0.4) — **removed** | ~3340 m | ~50% |

Forcing `walkway_bias=1` on the alternatives call collapsed both good options into a single geometry. Keep unbiased alternatives **plus** a positive walkway prefer request so path-safe diversity survives.

### 2–3. Dedupe and detour

- Geometric distinctness: sample points along the line; reject near-duplicates (same heuristic as before hybrid ship).
- Mapbox detour: reject candidates longer than **1.3 × shortest Mapbox** distance (ADR-001), or **1.6×** when Prefer away from roads is on. Challenger is **not** capped by that Mapbox ratio (its own cap is 1.15×, or 1.6× when the toggle is on).

### 4. Carriageway gate (hard filter)

**Implementation:** `web/src/lib/routing/carriageway.ts`

1. Sample ~10 evenly spaced points along the candidate polyline.
2. For each point, Mapbox Streets **tilequery** (`mapbox.mapbox-streets-v8`, layer `road`, radius ~28 m).
3. Classify nearest feature:
   - **Pathish:** `path`, `footway`, `sidewalk`, `pedestrian`, `crossing`, `steps`, `cycleway`, `track`, `bridleway`, `corridor` (class or type).
   - **Road / carriageway:** everything else with a street class (e.g. `street`, `primary`, `secondary`, `tertiary`, links).
4. **Reject** if road share of known samples **> 0.28**.
5. If tilequery fails (network / API): fail **open** for that candidate only when we already used path-preferring Mapbox strategies; still never reintroduce negative `walkway_bias`.
6. If every candidate fails the gate: keep the single lowest carriageway-share candidate as last resort (should be rare).

The same gate applies to the **score-aware challenger** before it is merged into the card list (challenger may also pass via OSM pathish share — see P1).

### 4b. Track 0 — carriageway truth / sidewalk paint (16 Aug 2026)

**Problem:** Mapbox walking often returns a polyline that **looks** mid-carriageway on the basemap (e.g. Liara Blvd on OD-12) even when Streets tilequery reports a nearby `footway` / low road share. Google Maps draws the same corridor on the **edge** of the carriageway. Casey T1EAM shows offset footpaths; scoring alone does not fix the drawn line.

**Ship rule (hybrid credibility):**

1. **Sidewalk / edge nudge (Mapbox only):** Densify the polyline (~30 m steps, ≤70 probes) and tilequery Streets at each point. Compute a **lateral-only** signed offset per point: toward a mapped `sidewalk` when one exists 3–30 m away; otherwise, when the point sits inside the road casing (distance to the widest along-route road class below a per-class edge target — secondary ≈15 m, tertiary ≈11 m, street ≈7 m), push out to the casing edge, away from the centreline. **On-path guard:** a point already on a mapped footway/sidewalk (≤3 m) is left alone unless the road centreline is essentially coincident (≤4.5 m — the Streets "footway at centre" mislabel, e.g. Liara Blvd); genuinely offset footways (east Homestead Rd) keep their true alignment. **Side-certainty guard (centreline when unsure):** within each contiguous run of proposed shifts, the evidence must agree ≥80% on which side of the road to move; ambiguous runs (a line exactly on the road centreline gives noise-driven sides — Fordholm Rd) are not nudged at all, drawing the honest centreline instead of a weave. Offsets are capped at 9 m, damped through turns/roundabouts (heading change ≥45° → no shift, so the paint hugs corners instead of swinging into islands), median-filtered (rejects sign flips from side-street stubs at intersections), then lightly smoothed. Crossings suppress the shift. Endpoints stay fixed so From/To pins still meet the line. Distance/duration remain Mapbox routing truth.
2. **Prefer score-aware when Mapbox needed a nudge:** If a path-safe distinct challenger merges and Mapbox paint was nudged, lead the card list with the challenger before preference ranking.
3. **Soft match penalty:** Residual `centreline_look_share` on a card reduces match slightly so Recommended prefers path-safer geometry when scores are close. Score-aware challenger cards are **exempt** — they already passed the OSM path-safe gate, so a centreline look there is an OSM drawing artifact, not road-walk evidence.
3b. **Hide centreline Mapbox when Casey is on the footpath (16 Aug 2026):** If a path-safe challenger merged and a Mapbox card still has `centreline_look_share` ≥ 0.28 (OD-12 Homestead after the side-certainty guard), drop that Mapbox card. Do not show the same corridor twice with one line down the middle. Path-safe Mapbox-only ODs (OD-CARRIAGE-01) and last-resort Mapbox when Casey is absent are unchanged.
4. **Challenger paint gets the same nudge (16 Aug 2026):** OSM ways without separate sidewalk geometry draw at the road centreline (OD-12 Homestead Rd west of Bellevue Dr), so the merged challenger geometry runs through the same sidewalk/edge nudge after the path-safe gate. Distance/duration stay graph truth; genuinely offset footways are untouched by the on-path guard, and centreline stretches without clear side evidence stay on the centreline per the side-certainty guard. OD-12 challenger after guards: Liara 2.8→6.7 m mean off centreline (clear side), Homestead unchanged ~3.5 m (ambiguous → honest centreline), Bellevue footpath leg unchanged (11.1 m). Weave check: 0 side flips on OD-12 / OD-05 across both engines (`scripts/verify-no-weave.ts`).

Evidence (OD-12, 16 Aug 2026): Liara Blvd samples were **on** the road centreline (`road@0`, no mapped sidewalk, cycleway ~9 m); Homestead Rd samples sat on a Streets `footway` only 5–9 m from a secondary centreline with the real north path mostly beyond the 35 m probe radius. After the nudge: Liara mean centreline distance 1.1 → 6.7 m (on-road probes 8/9 → 2/9), Homestead 7.4 → 9.6 m, max departure from the routed line capped at ~9 m.

This does **not** invent a second fake option, and it does **not** replace T1EAM-native routing (north star). It closes the “teal line down the middle of Liara / Homestead” trust gap for the pilot hybrid.

**QA:** `web/scripts/smoke-carriageway-truth.ts` (OD-12 + OD-CARRIAGE-01) · `web/scripts/verify-nudge-edges.ts` (before/after edge distances; writes `pipeline/data/qa/nudge_before_after.geojson`).

### 4c. Challenger footway bias + OSM crossing nodes (16 Aug 2026)

Paint cannot invent a north-side Homestead walk if Dijkstra still prefers the parallel road way. Two graph changes, rebuild required (`python bakeoff/build_graph.py`):

1. **Road-class cost multiplier:** residential / unclassified ~1.75×, tertiary ~1.85×, secondary / primary 2× per metre. Pathish classes stay 1×. Service / living_street stay mild (1.25×) so OD-11 cut-throughs survive. A 13% longer sidewalk now beats its road twin; roads remain routable where no footpath exists.
2. **Synthetic crossing edges:** Overpass node-tagged crossings (`highway=crossing`, `crossing=*`) become short `highway=crossing` links to nearby pathish nodes (≤22 m). Routing connectivity only — not a scoring input (Council crossing gap unchanged).
3. **Prefer away from roads:** stronger trail vs sidewalk costs, 1.6× detour, and a second Dijkstra that penalises the default corridor so a longer park option can appear (OD-12 Alira ~1.31×). If that search exceeds 1.6×, keep the default footpath route — do not fall back to graph-shortest (service / residential shortcuts) or label it away-from-roads.

Together these produce the Google-like OD-12 default: Liara sidewalk, cross at the roundabout, north-side Homestead path. **QA:** `web/scripts/verify-od12-homestead.ts`.

### 4d. Dual Casey cards (16 Aug 2026)

Residents should see **two Casey walks by default** when the network allows a real split (shared prefix, then Bellevue vs Homestead, or park vs street-edge). Prefer away from roads stays **off** unless they ask; it is a third card, not the complement.

| Card | How it is designed |
|------|--------------------|
| **Preference-best** | Current slider blend (P2). Soft 1.15× detour vs graph-shortest. A **pathish** corridor (share ≥ 0.70) may go to 1.20× so OD-12 Bellevue is not replaced by Homestead. If the search exceeds that and is not pathish, keep the highway-biased Casey path (`cost_day` / `cost_night`). Never fall back to graph-shortest. |
| **Complement** | The other pathish corridor: invert the dominant stream (shade vs footpaths by day; lighting vs footpaths by night). No prefix penalty, so Bellevue can share Homestead then split. Cap 1.20×; omit if over cap, not pathish, or not distinct. |
| **Away from roads** | Only when the toggle is on. Stronger trail bias, 1.6×, penalise primary ×3. Same no-junk fallback as before. |

The complement is **not** both sliders at least-important, and it is **not** “leave the first corridor at any cost” (that produced the Burndon / north Centre zigzag).

**Ashfield Drive (OD-12 dest):** OSM already maps parallel west (Old Cheese Factory / park) and east (residential sidewalk) footways, plus pedestrian nodes at Homestead. The west link is in the score-aware graph. After crossing Homestead the straight-ahead continuation is the west footway; hopping to the east sidewalk is a crossing-cost choice, not a missing OSM way. T1EAM-native edges remain the north star for paint and side-of-street truth. Heading-continuity at crossings (prefer straight-ahead over a side hop) is the follow-on if a card still takes the east sidewalk after Homestead.

**QA:** `web/scripts/verify-od12-homestead.ts` (default + complement + plan cards).

### 5. Challenger merge

Unchanged intent from ADR-001: add when geometrically distinct and now also off-carriageway. Shorter challenger paths remain eligible.

### 6. Ranking (not geometry)

After the card set is fixed:

- Day / Night mode selects which Casey stream pills matter.
- Importance sliders + efficiency shape **match** / Recommended.
- **Prefer away from roads** still adds a soft bonus from `shared_use_ratio` on the scored corridor. The toggle also changes **which** cards are generated (step 5). It cannot fix a carriageway geometry; the gate must already have removed those lines.

## Outing mode (Around here)

Loops are drawn on the Casey graph first. One call to the challenger `/loop` planner returns up to three distinct circuits: turning points are through-junctions (never dead-ends) scored with the same preference blend as A→B, the three legs share a cumulative reuse penalty (x4 on edges already walked, so the way home does not retrace the way out), and the via radius is resized from measured circuit length until the walk lands inside the ±5 min band. Mapbox waypoint drawing (positive `walkway_bias`, Casey-scored turning points) is the fallback when the planner returns nothing or the challenger is down. The **hard carriageway gate is trip A→B only** and is not applied to Loop / There and back. Suburban circuits necessarily use street-adjacent footpaths; treating them like mid-road trip options rejected nearly all Montpelier / Berwick loops (`no_route` after tilequery). Loop quality rules (circuit revisit, reverse-overlap, spur demote, ±5 min band) remain in `planOuting.ts` and apply to both engines. Prefer away from roads is ranking-only on loops.

## QA OD (regression)

| ID | From | To | Expect |
|----|------|-----|--------|
| **OD-CARRIAGE-01** | 16 Epsom Lane, Cranbourne North `[145.332444, -38.088427]` | 16 Arubi Avenue, Clyde North `[145.338191, -38.11054]` | At least one path-safe option; **no** mid-carriageway alternative; preferably **two** distinct footpath options (~3.17 km and ~3.22 km class) when Mapbox returns both |

Re-check after any change to Mapbox query params, dedupe thresholds, or carriageway share cutoff.

## Funnel assessment (12 Aug 2026)

Diagnostic: `web/scripts/smoke-trip-funnel.ts` → `diagnoseTripRouteFunnel` in `web/src/lib/routing/tripFunnel.ts`.  
North star fork: [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md).

### Challenger down (local + production 503)

| Finding | Evidence |
|---------|----------|
| Hybrid second geometry unavailable | `/api/challenger-route` → 503 |
| Mapbox usually returns one raw candidate | `mapbox_raw=1` on 6/7 ODs |
| Carriageway gate often rejects the only Mapbox line, then last-resort keeps it | OD-11 share 1.0; Montpelier share 1.0 |
| Path-safe diversity still works when Mapbox returns two footpath alts | OD-CARRIAGE-01 → 2 cards |

### Challenger up (localhost `serve_challenger.py` :8790)

**P1 gate (12 Aug evening):** challenger merge uses **OSM pathish share OR Streets tilequery**. Rescues OD-11 service/cycleway cut-throughs Streets mislabels; keeps OD-12 footway corridors with short connectors. Mapbox candidates remain Streets-only.

| OD | Challenger | Final cards |
|----|------------|-------------|
| **OD-11** | **kept** (~313 m, osm_pathish ≈ 0.96) | **2** |
| OD-12 | **kept** | **2** |
| OD-CARRIAGE-01 | not distinct | 2 (Mapbox only) |
| OD-01, OD-03 | not distinct | 1 |
| OD-08, Montpelier | failed both gates | 1 |

Implication: with challenger up + P1, hybrid dual cards work on the bake-off gold ODs. Sliders still cannot invent geometry until preference-weighted costs (P2) land — see [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md).

Replay: start challenger, then `cd web && npx tsx scripts/smoke-trip-funnel.ts`.

## Honest limits

- Mapbox + OSM path mapping can still be wrong locally; the gate reduces obvious centreline walks, it does not certify legal footpaths.
- **Track 0 sidewalk nudge** moves paint toward mapped sidewalks / a short edge offset; it cannot fix basemap road casings that are drawn wider than the data, and it will not invent Casey park links Mapbox never routed.
- **Side-of-road weaves are routing truth, not paint.** Where Mapbox's walking graph crosses to the other footway (e.g. Rogers Close on OD-12), the drawn jog reflects the routed OSM footway network. Google may keep the opposite footway because its graph differs. We do not repaint a line onto a footway the route never used.
- Casey T1EAM proximity alone is **not** sufficient to detect carriageways (paths often run beside roads). Streets class tilequery is the pilot signal.
- Fewer than 2–3 cards is acceptable when Mapbox only has one path-safe geometry. Prefer fewer honest options over a road line.
- Missing Council crossings / kerb ramps still reduce **score confidence**; they are not imputed as zero (methodology v1.1).

## Code map

| Concern | Location |
|---------|----------|
| Mapbox queries + detour + carriageway filter | `web/src/lib/routing/directions.ts` |
| Carriageway share / pathish classes | `web/src/lib/routing/carriageway.ts` |
| Hybrid merge + challenger gate | `web/src/lib/routing/planRoute.ts` |
| Preference ranking / away-from-roads copy | `web/src/lib/routing/preferences.ts` |
| Road-class cost + crossing synthesis | `pipeline/bakeoff/build_graph.py` |
| A→B funnel diagnostics | `web/src/lib/routing/tripFunnel.ts` · `web/scripts/smoke-trip-funnel.ts` |
| Outing P4 turning-point bias | `web/src/lib/routing/outingStreamBias.ts` · `web/scripts/verify-p4-outing-bias.ts` |
| Prefs-in-pathfinding smoke | `web/scripts/smoke-prefs-pathfinding.ts` |
| OD-12 Homestead north-side + away variant | `web/scripts/verify-od12-homestead.ts` |
| Challenger service | `pipeline/bakeoff/serve_challenger.py` |

## Changelog

| Date | Change |
|------|--------|
| **17 Aug 2026** | Resident UX pass: About/welcome modal (auto-opens once, then via the header info button; replaces the plan-sheet blurb). Camera is now chrome-aware everywhere — walk fits respect the mobile sheet at its current height, picking a different walk zooms to that whole walk, setting the second endpoint frames both pins for tweaking, and a single typed address lands mid-visible-map instead of behind the sheet. Location check-in becomes a pulsing brand-teal dot (not an endpoint pin) triggered from a button under Map layers, with a dismissible beside-the-button notice when the resident is outside Casey or denies access. Results header now shows both endpoints without state/postcode (shared suburb said once). Resident app lint debt cleared (7 → 0). |
| **17 Aug 2026** | Trip duplicate-card fix: Casey candidates (preference-best, complement, away) now dedupe raw-vs-raw with distance-based line sampling. Previously the stored winner was sidewalk-nudged before the complement was compared against it, and vertex-index sampling misaligned the two copies of the same path — an identical "More shade" twin of Best for you shipped as a second card (Cupples Cr → Ashfield Dr). |
| **17 Aug 2026** | Map design pass: footpath layer becomes off-road path centrelines from z12 plus T1EAM pavement fill from z15.5 (polygons already covered by a path line are skipped via `path_covered_segment_ids`), both in the basemap's bottom slot so they duck under road ribbons instead of painting across roundabouts. Semantic walk colours — Best for you always teal, Away from roads always green, other options in the amber family — applied to lines, map chips, and card dots. Tappable time + distance chips float on each walk; whole-walk camera pads for the desktop results panel; day footpath colour lightened to grey-lavender. |
| **17 Aug 2026** | Walk-view UX: staged footpath layer — genuine off-road paths render from z12; sidewalk lines (ADR-011 offsets, OSM-tagged and geometry-detected road-hugging footways) fade in from z15.5 where they read as pavements, not hollow block rings. Address pin now joins the route with a dotted grey connector instead of the walk line crossing yards. "Use this route" flies to a tilted street-level commence view facing the first leg, then toggles to overview. One-shot geolocate check-in button (no tracking; fix never leaves the device). |
| **17 Aug 2026** | Sidewalk drawing fix (ADR-011 amendment): draw-order side votes, roundabout rings excluded, interior pavement gaps filled, offset joints welded, loop spurs collapsed. Kills the Fairholme sawtooth, roundabout boxes, mid-block doglegs and the Denmark Hill out-and-back without giving up 0-1% road share. |
| **17 Aug 2026** | Sidewalk-aware graph (ADR-011): road edges with T1EAM pavement alongside become `sidewalk` edges (footway cost, geometry offset to the pavement side, side voted per way). Loops and A→B stop walking down centrelines wherever Casey has a footpath; `road_share` now counts only footpath-less roads. Resident map underlay switches from pavement polygons to welded centrelines. |
| **17 Aug 2026** | Road-aware loop selection: `/loop` pools all candidate circuits (up to 5 damped via resizes each) and returns the lowest road-centreline share first; >45% road only fills a two-card set; vias must touch the path network. Client demotes roadier circuits in pool quality and tags road share in the QA suffix (`_rd28`). Montpelier night 30 min: 58/64/65% road down to 29/34/40%. |
| **16 Aug 2026** | Loops move to the challenger `/loop` planner: through-junction turning points, cumulative cross-leg reuse penalty (x4), calibration probe + damped via resize for the ±5 min band. Fixes Montpelier backtracking (revisit 0.15–0.21 to 0.00–0.09). Mapbox waypoint drawing is now the fallback only. |
| **16 Aug 2026** | P4 outing: turning points use the trip preference blend; Casey graph legs when they connect; Mapbox fallback. Montpelier 30 min Loop is the exit fixture. |
| **16 Aug 2026** | Dual Casey cards: preference-best + other pathish corridor (invert stream, no prefix penalty, 1.20×). Pathish pref paths may keep up to 1.20× (OD-12 Bellevue). Prefer away from roads stays an optional third card. |
| **16 Aug 2026** | Challenger road-class cost 1.5–2× so parallel footpaths beat road ways; synthesise crossing edges from node-tagged OSM crossings; Prefer away from roads is generation-time (1.6× detour + off-road challenger). Hide Mapbox that still looks mid-carriageway when Casey is already on the footpath. OD-12 default: north-side Homestead via roundabout crossings. |
| **12 Aug 2026** | P1 gate + P2 pref costs: challenger Dijkstra blends Acc/Heat&Shade (or Lighting); resident Find passes prefs. OD-01/OD-12 shade≠footpaths geometries. |
| **10 Aug 2026** | Outing waypoint routes: disable hard carriageway gate (trip-only). Restores Loop finds in street-grid suburbs. |
| **8 Aug 2026** | Carriageway product rule; remove negative `walkway_bias`; Streets tilequery gate (share &gt; 0.28); restore unbiased `alternatives` + `walkway_prefer` for path-safe diversity (OD-CARRIAGE-01) |
| 30 Jul 2026 | Hybrid trip mode + challenger (ADR-001) |
