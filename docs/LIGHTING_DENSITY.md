# Lighting density — length-normalised Night Index (3 Aug 2026)

**Status:** Specced and implemented as scoring patch **v1.1.3** (local rescore).  
**Gate docs:** [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) §6.1 · [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) §6.3  
**Code:** `pipeline/yourwalk_pipeline/scoring.py`

## Problem

v1.1.2 lighting used **nearest distance + absolute count** in a buffer. A single streetlight on the edge of a long polygon could put the whole segment in the **good** tier (score mid-90s), even when most of the path had no poles.

**Worked example — segment 92240 (Narre Warren, creek / priority corridor):**

| Signal | Value |
|--------|--------|
| `length_m` | ~1,606 m |
| `streetlight_nearest_m` | ~7.5 m (AusNet 150 W, Cranbourne Road) |
| `streetlight_count_30m` | 1 |
| Lights per 100 m | **~0.06** |
| `score_lighting` (v1.1.2) | **96** |
| `score_lighting` (v1.1.3 density) | **35** (poor tier) |

Occlusion (light behind houses) is **out of scope** for this patch. Length-blind nearest is the first-order bug.

## Rule (v1.1.3)

Same spirit as night **crash density** (already length-normalised):

```
combined_nearest_m = min(streetlight_nearest_m, park_light_nearest_m)
combined_count     = streetlight_count_30m + coalesce(park_light_count_50m, 0)
density_per_100m   = combined_count / max(length_m / 100, 0.5)
```

| Tier | Condition | Score behaviour |
|------|-----------|-----------------|
| **Good** | nearest ≤ 25 m **and** density ≥ **1.0** / 100 m | Curve: proximity + density (sat at 2.0 / 100 m ≈ 1 pole / 50 m) |
| **Poor** | nearest > 40 m **or** count = 0 **or** density < **0.3** / 100 m | Cap **35** |
| **Moderate** | otherwise | Blend nearest + density, max 84 |

Threshold intent (Casey street spacing, calibrated offline 3 Aug 2026):

- **1.0 / 100 m** — about one pole per 100 m; minimum for “good”
- **0.3 / 100 m** — worse than ~one pole per 333 m → poorly covered for length
- **Example:** one pole on a **200 m** segment → density 0.5 → **moderate**, not good

Stream assembly unchanged: `lighting_after_dark = 0.70 × lighting + 0.30 × crash`.

## Why not max-gap yet

[`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) §5.8 already names `streetlight_max_gap_m` as the highest-value lighting metric (ordered lights along the path). Defer to **v1.2** — density fixes the mega-segment / single-pole failure mode with columns we already have.

## Council audit angle — creek / recreational corridors

Casey has flagged **off-road creek / recreational walks** as priority corridors to evolve. Segment 92240 sits on one of those. Length-normalised lighting makes Night Index a usable **audit signal** for sparse lighting on long trail polygons, not only residential footpaths.

**Follow-up (not this patch):** document the two priority creek corridors from Council (names, extents, segment IDs) and run a Night Index lighting-density extract for those corridors once extents are captured.

## Local test

```bash
cd pipeline && source .venv/bin/activate
python scripts/score_segments.py
python scripts/compare_lighting_density.py   # before/after QA JSON
# Refresh QA map layers if inspecting in the viewer:
python scripts/serve_viewer.py --rebuild --open
```

## Sign-off note

Delivery refinement under **v1.1.x** change control (rubric tweak; aligns VI §6.3 “coverage along segment”). Not a methodology reopen with XYX for this pass — documented for transparency and later discussion.
