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
| **Prefer away from roads** | Soft **ranking** bias toward shared-use path class — does **not** invent geometry and does **not** replace the carriageway gate |

## Generation pipeline (A→B trip)

Order matters. Implemented in `web/src/lib/routing/directions.ts`, `carriageway.ts`, `planRoute.ts`.

```
1. Request Mapbox walking candidates
2. Dedupe similar geometries
3. Detour gate (Mapbox only): drop if longer than 1.3 × shortest Mapbox
4. Carriageway gate: drop if Streets samples say “on road”
5. Merge distinct score-aware challenger (if off-carriageway)
6. Cap ~3 cards → preference / match ranking for Recommended
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
- Mapbox detour: reject candidates longer than **1.3 × shortest Mapbox** distance (ADR-001). Challenger is **not** capped by that Mapbox ratio.

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
4. **Challenger paint gets the same nudge (16 Aug 2026):** OSM ways without separate sidewalk geometry draw at the road centreline (OD-12 Homestead Rd west of Bellevue Dr), so the merged challenger geometry runs through the same sidewalk/edge nudge after the path-safe gate. Distance/duration stay graph truth; genuinely offset footways are untouched by the on-path guard, and centreline stretches without clear side evidence stay on the centreline per the side-certainty guard. OD-12 challenger after guards: Liara 2.8→6.7 m mean off centreline (clear side), Homestead unchanged ~3.5 m (ambiguous → honest centreline), Bellevue footpath leg unchanged (11.1 m). Weave check: 0 side flips on OD-12 / OD-05 across both engines (`scripts/verify-no-weave.ts`).

Evidence (OD-12, 16 Aug 2026): Liara Blvd samples were **on** the road centreline (`road@0`, no mapped sidewalk, cycleway ~9 m); Homestead Rd samples sat on a Streets `footway` only 5–9 m from a secondary centreline with the real north path mostly beyond the 35 m probe radius. After the nudge: Liara mean centreline distance 1.1 → 6.7 m (on-road probes 8/9 → 2/9), Homestead 7.4 → 9.6 m, max departure from the routed line capped at ~9 m.

This does **not** invent a second fake option, and it does **not** replace T1EAM-native routing (north star). It closes the “teal line down the middle of Liara / Homestead” trust gap for the pilot hybrid.

**QA:** `web/scripts/smoke-carriageway-truth.ts` (OD-12 + OD-CARRIAGE-01) · `web/scripts/verify-nudge-edges.ts` (before/after edge distances; writes `pipeline/data/qa/nudge_before_after.geojson`).

### 5. Challenger merge

Unchanged intent from ADR-001: add when geometrically distinct and now also off-carriageway. Shorter challenger paths remain eligible.

### 6. Ranking (not geometry)

After the card set is fixed:

- Day / Night mode selects which Casey stream pills matter.
- Importance sliders + efficiency shape **match** / Recommended.
- **Prefer away from roads** adds a soft bonus from `shared_use_ratio` on the scored corridor. It cannot fix a carriageway geometry; the gate must already have removed those lines.

## Outing mode (Around here)

Waypoint walks use Mapbox with **positive** `walkway_bias`. The **hard carriageway gate is trip A→B only** — not applied to Loop / There and back. Suburban circuits necessarily use street-adjacent footpaths; treating them like mid-road trip options rejected nearly all Montpelier / Berwick loops (`no_route` after tilequery). Loop quality rules (circuit revisit, reverse-overlap, spur demote, ±5 min band) remain in `planOuting.ts`.

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
| Preference ranking / shared-use soft bias | `web/src/lib/routing/preferences.ts` |
| A→B funnel diagnostics | `web/src/lib/routing/tripFunnel.ts` · `web/scripts/smoke-trip-funnel.ts` |
| Prefs-in-pathfinding smoke | `web/scripts/smoke-prefs-pathfinding.ts` |
| Challenger service | `pipeline/bakeoff/serve_challenger.py` |

## Changelog

| Date | Change |
|------|--------|
| **12 Aug 2026** | P1 gate + P2 pref costs: challenger Dijkstra blends Acc/Heat&Shade (or Lighting); resident Find passes prefs. OD-01/OD-12 shade≠footpaths geometries. |
| **10 Aug 2026** | Outing waypoint routes: disable hard carriageway gate (trip-only). Restores Loop finds in street-grid suburbs. |
| **8 Aug 2026** | Carriageway product rule; remove negative `walkway_bias`; Streets tilequery gate (share &gt; 0.28); restore unbiased `alternatives` + `walkway_prefer` for path-safe diversity (OD-CARRIAGE-01) |
| 30 Jul 2026 | Hybrid trip mode + challenger (ADR-001) |
