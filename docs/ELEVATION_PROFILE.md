# Route elevation profile (resident disclosure)

**Status:** Pilot slice — UI only  
**Date:** 9 September 2026  
**Methodology gate:** [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
**Related:** [`GRADIENT_DISCOVERY.md`](GRADIENT_DISCOVERY.md), Flow 02 Results

This is **not** a Vulnerability Index input. Gradient remains deferred from Accessibility v1.1 scoring.

---

## 1. Why this exists

A walk can score well on Footpaths, Heat and Shade, or Lighting and still be a poor choice for someone who cannot manage a steep grade (older residents, prams, some mobility aids). Residents need to see hilliness **before** they start the walk, not halfway up the hill.

Council-grade slope on every T1EAM segment is still blocked: open Vicmap metro layers cover about 12% of the network, and the Vicmap 1 m DEM needs a licence (see gradient discovery). We can still show an **approximate elevation profile along the planned line** using Mapbox Terrain, which the app already uses (ADR-002).

---

## 2. What ships in this slice

| Surface | Behaviour |
|---------|-----------|
| Every result card | Hilliness line as soon as Terrain samples return: Mostly flat / Gentle hills / Some hills / Steep sections, plus climb in metres |
| Selected walk | Sparkline elevation profile, climb, estimated steepest stretch, provenance sentence |
| Peek sheet | Mentions steep sections when the highlighted walk is steep |
| Day / Night / Footpaths pills | **Unchanged** |

**Prefer flatter walks** lives under plan-sheet **Options** with Prefer away from roads. Same ritual: set Options, tap Find. It re-orders those cards toward gentler Terrain profiles. It does not hide steep walks, change pills, or request new geometry. Missing elevation is treated as unknown, not steep. Results show a quiet Options hint only.

---

## 3. Source and method

1. Densify the drawn walk line every 20 m (cap 220 samples).
2. Sample [Mapbox Terrain-RGB](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/) tiles at zoom 14.
3. Smooth heights, then estimate grade over a 40 m window.
4. Band using AS 1428-style language only: about 3% gentle, 5% hilly, 8% steep. This is **not** an accessibility compliance claim.

**Known limits**

- Terrain-RGB is roughly 10-30 m, not a surveyed footpath centreline.
- Building pads and bridges can flatten or invent short wiggles.
- Missing tiles or thin coverage: show nothing. Do not impute a flat walk.

Resident copy: *Approximate hilliness from Mapbox Terrain. Not a surveyed footpath grade, and not part of the Footpaths score.*

---

## 4. What this is not

- Not `max_grade_pct` on `segment_scores` and not a v1.1.x scoring patch.
- Not a hard filter that hides steep walks.
- Not a “safe for older people” badge.
- Not a substitute for Vicmap 1 m DEM or a Council slope layer when those arrive.

---

## 5. Prefer flatter vs hide steep

| Option | Role | Status |
|--------|------|--------|
| **A. Disclosure** | Cards + selected profile | Shipped |
| **B. Prefer flatter walks** | Soft rank among found cards | Shipped. Options + Find. Same chrome as away from roads. Does not change pathfinding |
| **C. Avoid steep grades** | Hard filter | Later. Needs licensed 1 m DEM or Council grade layer |

Pathfinding that searches for a flatter corridor (not only re-ranks Mapbox / Casey cards) waits on per-segment grade from the 1 m DEM.

Production index gradient, when licensed, still follows discovery: centreline sample, `max_grade_pct` per segment, AS 1428-aligned rubric, reduced confidence until coverage is high. Do not score the open 12% proxy.
