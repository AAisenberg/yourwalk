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
2. For each point, Mapbox Streets **tilequery** (`mapbox.mapbox-streets-v8`, layer `road`, radius ~22 m).
3. Classify nearest feature:
   - **Pathish:** `path`, `footway`, `sidewalk`, `pedestrian`, `crossing`, `steps`, `cycleway`, `track`, `bridleway`, `corridor` (class or type).
   - **Road / carriageway:** everything else with a street class (e.g. `street`, `primary`, `secondary`, `tertiary`, links).
4. **Reject** if road share of known samples **> 0.28**.
5. If tilequery fails (network / API): fail **open** for that candidate only when we already used path-preferring Mapbox strategies; still never reintroduce negative `walkway_bias`.
6. If every candidate fails the gate: keep the single lowest carriageway-share candidate as last resort (should be rare).

The same gate applies to the **score-aware challenger** before it is merged into the card list.

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
| Challenger service | `pipeline/bakeoff/serve_challenger.py` |

## Changelog

| Date | Change |
|------|--------|
| **12 Aug 2026** | Trip funnel + P1: challenger OSM pathish OR Streets gate. OD-11 and OD-12 keep dual cards; prefs-in-pathfinding spec opened for P2. |
| **10 Aug 2026** | Outing waypoint routes: disable hard carriageway gate (trip-only). Restores Loop finds in street-grid suburbs. |
| **8 Aug 2026** | Carriageway product rule; remove negative `walkway_bias`; Streets tilequery gate (share &gt; 0.28); restore unbiased `alternatives` + `walkway_prefer` for path-safe diversity (OD-CARRIAGE-01) |
| 30 Jul 2026 | Hybrid trip mode + challenger (ADR-001) |
