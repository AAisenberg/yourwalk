# YourWalk Scoring Specification

**Version:** 1.1  
**Status:** Draft — CrowdLab implementation default; Nikki Hedge / XYX Lab refinement welcome  
**Last updated:** 3 June 2026  
**Methodology gate:** [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
**Harmonisation input:** [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) v0.3 → `segment_features.parquet`

This document defines **how harmonised segment attributes become index scores**. It does not redefine spatial joins (see harmonisation spec) or product UI (see PRD / REQS).

---

## 1. Purpose

Scoring answers:

> For each walk network segment, what are the Day and Night Vulnerability Index scores and sub-scores?

**Inputs:** one row per segment from `data/intermediate/segment_features.parquet`  
**Outputs:** `data/intermediate/segment_scores.parquet` + `data/qa/segment_scoring.json`

**Out of scope (v1):** route aggregation, PostGIS load, Next.js display, parks polygon ingest, council tree points in canopy, Vicmap gradient, general crossings / kerb ramps (until Council data received).

---

## 2. Index model (locked)

| Index | Formula | Scale |
|-------|---------|-------|
| **Day Index** | Accessibility **60%** + Heat & Shade **40%** | 0–100 internal; resident display ÷ 10 |
| **Night Index** | Accessibility **60%** + Lighting / After Dark **40%** | 0–100 internal; resident display ÷ 10 |

**Direction:** higher = better walking conditions (lower vulnerability).

**Accessibility** is identical in both indexes (same harmonised inputs, same rubric).

Segments with `score_eligible = false` (e.g. Dandenong suburb mis-tag) receive `NULL` index scores; sub-scores may still be computed for QA.

---

## 3. Score scale and display

| Layer | Range | Notes |
|-------|-------|-------|
| Internal storage | 0–100 (float, 1 decimal) | All sub-scores and index scores |
| Resident / route UI | 0–10 (1 decimal) | `display_score = round(index_score / 10, 1)` |
| Sub-score transparency | 0–100 | Exposed in Council dashboard breakdown |

Clamp all component scores to `[0, 100]` after computation.

---

## 4. Accessibility stream (shared 60%)

Combines footpath physical attributes and environmental-order proxy. Weights below apply **within** the accessibility sub-score (before the 60% index blend).

### 4.1 Component weights

| Component | Weight | Harmonised columns | Notes |
|-----------|--------|-------------------|-------|
| **Width** | 30% | `width_m`, `width_qa_flag`, `walk_path_class` | AS 1428–style graduated bands; separate rubrics for `footpath` vs `shared_use` |
| **Surface** | 25% | `surface_material` | Three buckets; brick paving provisional (§4.3) |
| **Speed exposure** | 25% | `speed_corridor_max_kmh` | Renormalise weights when NULL (~18% of segments) |
| **Graffiti proxy** | 15% | `graffiti_count_25m`, `graffiti_count_25m_365d`, `graffiti_days_since_last` | Log density + recency; not crime data |
| **School crossing bonus** | +5 pts max | `school_crossing_within_20m` | Additive bonus, not a penalty when absent |

When `speed_corridor_max_kmh` is NULL, drop speed from the denominator and renormalise width / surface / graffiti to sum to 100% of the non-bonus components.

**Missing width:** if `width_qa_flag` ∈ `{missing, zero}` or `width_m` is NULL, use neutral width score **50** and flag reduced confidence (do not impute as zero width).

### 4.2 Width rubric — `footpath`

Nominal range ~1.2–2.5 m (Casey median ~1.5 m). Linear interpolation within bands:

| `width_m` | Score |
|-----------|-------|
| < 0.8 | 15 |
| 0.8 – 1.0 | 15 → 35 |
| 1.0 – 1.2 | 35 → 50 |
| 1.2 – 1.5 | 50 → 70 |
| 1.5 – 1.8 | 70 → 85 |
| 1.8 – 2.5 | 85 → 100 |
| > 2.5 | 100 (cap; review if `too_wide` QA flag) |

### 4.3 Width rubric — `shared_use`

Nominal range ~2.5–4.0 m (Casey median ~2.8 m). Wider paths scored on a higher band scale:

| `width_m` | Score |
|-----------|-------|
| < 2.0 | 20 |
| 2.0 – 2.5 | 20 → 45 |
| 2.5 – 3.0 | 45 → 70 |
| 3.0 – 4.0 | 70 → 90 |
| 4.0 – 6.0 | 90 → 100 |
| > 6.0 | 100 (cap at 6 m unless `too_wide` QA triggers review) |

`walk_path_class = other` uses the footpath rubric.

### 4.4 Surface buckets

| Bucket | Score | Materials (Casey portal values) |
|--------|-------|-----------------------------------|
| **Smooth / firm** | 90 | Concrete, Reinforced Concrete, Condensed Silica Fume Treated Concrete, Condensed Silica Fume Treated Reinforced Concrete, Asphalt - DGA, Spray Seal |
| **Moderate** | 65 | Brick Paving, Class 2 Fine Crushed Rock, Class 2 Crushed Rock, Class 3 Fine Crushed Rock, Timber |
| **Rough / loose** | 35 | Gravel, Rubber, Not Applicable |
| **Unknown** | 50 | To be determined, NULL, unmapped |

**Open (Nikki):** Brick Paving — pleasant heritage surface vs rough trip hazard? v1 default: **moderate (65)**. Revisit after co-design spot checks.

### 4.5 Speed exposure

Uses `speed_corridor_max_kmh` (25 m corridor max — parallel arterial comfort). Lower speed = higher score:

| Max speed (km/h) | Score |
|------------------|-------|
| ≤ 40 | 100 |
| 50 | 85 |
| 60 | 70 |
| 70 | 55 |
| 80 | 40 |
| 90 | 30 |
| ≥ 100 | 20 |

Linear interpolation between knots. NULL → exclude from weighted mean (renormalise §4.1).

### 4.6 Graffiti proxy

Environmental order / maintenance signal only ([`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) §6.1).

```
density_score = 100 - min(100, 25 * log1p(graffiti_count_25m))
recency_score = 100 if graffiti_count_25m == 0
              else min(100, graffiti_days_since_last / 10)   -- older = better
active_penalty = min(30, 15 * graffiti_count_25m_365d)       -- recent tags
graffiti_score = clamp(0.6 * density_score + 0.4 * recency_score - active_penalty, 0, 100)
```

If no graffiti in buffer: score **100**.

### 4.7 School crossing bonus

| Condition | Adjustment |
|-----------|------------|
| `school_crossing_within_20m = true` | +5 to accessibility sub-score (after weighted mean, before clamp) |
| otherwise | +0 (no penalty — general crossing gap documented separately) |

---

## 5. Heat & Shade stream (Day Index 40%)

Sub-weights within the heat/shade sub-score:

| Component | Weight | Columns | Notes |
|-----------|--------|---------|-------|
| **Heat** | 45% | `uhi18_m` | 2018 vintage; percentile rank within `score_eligible` segments |
| **Canopy** | 40% | `canopy_dense_pct`, `canopy_medium_pct`, `canopy_sparse_pct` | Vicmap density only — **exclude** council tree points |
| **Comfort** | 15% | `fountain_nearest_m`, `bench_count_50m`, `bench_nearest_m` | Fountains + benches presence |

**Council trees:** harmonised columns (`council_tree_*`) are **not** used in v1 canopy scoring.

### 5.1 Heat (`uhi18_m`)

Area-weighted UHI from harmonisation. **Lower °C = better.**

```
heat_score = 100 * (1 - percentile_rank(uhi18_m among score_eligible))
```

NULL → neutral **50** with reduced confidence.

### 5.2 Canopy

Class weights on overlap percentages:

```
canopy_score = (dense_pct * 100 + medium_pct * 60 + sparse_pct * 20) / max(canopy_cover_pct, 1)
```

If `canopy_cover_pct = 0`: score **30** (open exposure default, not penalised as NULL).

### 5.3 Comfort (fountains + benches)

| Input | Rule | Partial score |
|-------|------|---------------|
| Fountain | nearest distance | ≤ 100 m → 100; 100–200 m → 70; 200–400 m → 40; > 400 m or NULL → 20 |
| Benches | count in 50 m + nearest | `bench_count_50m ≥ 2` → 100; `= 1` → 80; nearest ≤ 100 m → 60; else 30 |

```
comfort_score = 0.55 * fountain_partial + 0.45 * bench_partial
```

---

## 6. Lighting / After Dark stream (Night Index 40%)

Sub-weights:

| Component | Weight | Columns |
|-----------|--------|---------|
| **Lighting** | 70% | Merged street + park lights (below) |
| **Night crashes** | 30% | `crash_night_count_25m_5y`, `length_m` |

### 6.1 Merged lighting

Combine AusNet/United Energy street lights and Casey park/reserve lights:

```
combined_nearest_m = min(streetlight_nearest_m, park_light_nearest_m)   -- ignore NULL side
combined_count_30m = streetlight_count_30m + coalesce(park_light_count_50m, 0)
```

**Coverage rule (v1):**

| Condition | Lighting score |
|-----------|----------------|
| `combined_nearest_m ≤ 25` **and** `combined_count_30m ≥ 1` | **Good** — base 85–100 from distance/count curve |
| `combined_nearest_m > 40` **or** `combined_count_30m = 0` | **Poor** — cap at 35 |
| otherwise (25–40 m or sparse count) | **Moderate** — 36–84 linear blend |

Good-tier curve:

```
lighting_score = min(100, 70 + 30 * (1 - combined_nearest_m / 25) + 5 * min(combined_count_30m, 6))
```

No lux weighting in v1 ([`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) §5.8).

### 6.2 Night pedestrian crashes

Primary input: `crash_night_count_25m_5y` (night-eligible, 5-year window, 25 m buffer).

Normalise to density per km:

```
crash_density = crash_night_count_25m_5y / max(length_m / 1000, 0.05)
crash_score = 100 * (1 - percentile_rank(crash_density among score_eligible))
```

Zero crashes → score **100**. NULL counts treated as 0 crashes (valid count, not missing join).

---

## 7. Index assembly

```
accessibility_score = weighted_mean(width, surface, speed, graffiti) + school_crossing_bonus
accessibility_score = clamp(accessibility_score, 0, 100)

heat_shade_score = 0.45 * heat + 0.40 * canopy + 0.15 * comfort

lighting_after_dark_score = 0.70 * lighting + 0.30 * crash

day_index_score   = 0.60 * accessibility_score + 0.40 * heat_shade_score
night_index_score = 0.60 * accessibility_score + 0.40 * lighting_after_dark_score
```

Set `day_index_score` and `night_index_score` to NULL when `score_eligible = false`.

---

## 8. Confidence (ADR-005 precursor)

Per-index confidence: `high` | `medium` | `low`. Full ADR-005 model TBD; v1 uses coverage heuristics:

| Signal | Effect |
|--------|--------|
| `width_qa_flag != ok` | −1 tier on accessibility |
| `speed_corridor_max_kmh` NULL | −1 tier on accessibility |
| `coverage_flags.crossing = gap` | −1 tier on accessibility |
| `uhi_join_method = nearest` or `uhi18_m` NULL | −1 tier on day |
| `canopy_cover_pct = 0` | −1 tier on day (shade) |
| `streetlight_nearest_m > 40` or combined count 0 | −1 tier on night |
| Multiple −1 signals | floor at `low` |

Start at `high`; apply deductions; never below `low`.

---

## 9. Output schema

### 9.1 File

| Path | Format |
|------|--------|
| `data/intermediate/segment_scores.parquet` | GeoParquet |
| `data/qa/segment_scoring.json` | Distribution stats, null rates, methodology log |

### 9.2 Columns (minimum)

```
-- Identity (from harmonisation)
segment_id, geometry, walk_path_class, score_eligible, suburb, ward, length_m

-- Accessibility components
score_width, score_surface, score_speed, score_graffiti, score_school_crossing_bonus
accessibility_score

-- Day components
score_heat, score_canopy, score_comfort, heat_shade_score, day_index_score

-- Night components
score_lighting, score_crash, lighting_after_dark_score, night_index_score

-- Display helpers
day_index_display, night_index_display          -- index / 10

-- Confidence & provenance
confidence_day, confidence_night
data_vintage                                    -- JSON
scored_at, methodology_version, scoring_spec_version
```

`data_vintage` example:

```json
{
  "heat": "2018",
  "canopy": "2019/2020",
  "street_lights": "2024-06",
  "speed_zones": "2026-02",
  "crashes": "2012-present, 5y window"
}
```

---

## 10. QA checks

Written to `segment_scoring.json` after each run:

| Check | Expectation |
|-------|-------------|
| Row count | = harmonised segment count (27,458) |
| `score_eligible` scored | 27,446 with non-null index scores |
| Score range | All scores ∈ [0, 100] |
| Median day / night | Document; expect mid-60s to mid-70s for urban Casey |
| Null index rate | = count of `score_eligible = false` |
| Spot checks | Berwick CBD, Clyde North, poorly lit corridor, high-UHI growth area |

---

## 11. Implementation

| Item | Location |
|------|----------|
| Scoring module | `pipeline/yourwalk_pipeline/scoring.py` |
| CLI script | `pipeline/scripts/score_segments.py` |

```bash
cd pipeline
source .venv/bin/activate
python scripts/harmonise_segments.py    # if segment_features stale
python scripts/score_segments.py
```

---

## 12. Known limitations

| Limitation | Handling |
|------------|----------|
| 2018 heat vintage | Document in `data_vintage`; canopy partially mitigates |
| No lux / wattage weighting | Proximity + count only |
| General crossings / kerb ramps missing | School crossing bonus only; `coverage_flags.crossing = gap` |
| Brick paving ambiguity | Moderate bucket pending Nikki review |
| Parks overlap ≠ walkable | Parks layer viewer-only; no `in_park_reserve` in v1 |
| Royal Botanic Gardens Cranbourne paths | OSM/state gap; not a v1 scoring blocker |
| Shared-use width outliers | Cap at 6 m for rubric; retain QA flag |

---

## 13. Related documents

- [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) — methodology gate v1.1
- [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) — join rules and input columns
- [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md) — dataset inventory
- [`DECISIONS.md`](DECISIONS.md) — ADR-008, ADR-009, ADR-005 (confidence TBD)

---

## 14. Version history

| Version | Date | Changes |
|---------|------|---------|
| **1.1** | **3 Jun 2026** | Initial scoring spec — width class split, speed renormalisation, merged lighting rule, graffiti log+recency, council trees excluded from canopy |
