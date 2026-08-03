# Segment harmonisation specification

**Version:** 0.3 (draft)  
**Status:** Draft — pending CrowdLab / XYX Lab validation  
**Last updated:** 30 May 2026  
**Methodology gate:** [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
**Pipeline status:** Ingestion complete (Waves 1–4 core datasets); harmonisation implemented (walk network includes shared-use paths)

This document defines **how ingested layers are joined to the T1EAM footpath segment network** to produce `segment_features.parquet` — one row per segment with derived attributes ready for scoring.

It does **not** define score weights or rubrics (see [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md)). It **does** define spatial join rules, output column names, null semantics, and QA checks.

---

## 1. Purpose

Harmonisation answers:

> For each footpath segment, what do we know from every ingested layer?

Outputs feed:

- Scoring algorithm (`day_index_score`, `night_index_score` and sub-scores)
- QA viewer (optional segment choropleth extension)
- PostGIS / Supabase production load

**In scope:** City of Casey pilot; T1EAM segment network; layers listed in §4.  
**Out of scope:** OSM gap-fill, Vicmap elevation gradient, general crossings / kerb ramps (until Council data received), route-level aggregation, score computation.

### 1.1 Locked decisions (May 2026)

| Topic | Decision |
|-------|----------|
| **Graffiti** | Accessibility stream proxy — applies to **both Day and Night Index** (shared 60% Accessibility), not Night-only |
| **Street lighting** | **No lux.** Harmonise **counts and distances** only for v1 scoring |
| **Urban heat** | **2018 vintage** — document limitation in outputs; area-weighted mesh-block join |
| **Crash buffer** | **25 m** corridor (either side of footpath polygon) — aligned with CrashDash practice; 50 m optional for sensitivity analysis |
| **Speed exposure** | **25 m corridor** around footpath — captures **parallel** high-speed roads (80–100 km/h), not only lines that geometrically cross the path |

---

## 2. Master walk network

| Item | Value |
|------|--------|
| **Source** | `data/intermediate/footpaths_ply_t1eam.parquet` (Footpaths T1EAM — **full** walk network) |
| **Validation** | `data/intermediate/sharedusepaths_ply_t1eam.parquet` + `data/qa/sharedusepaths_ply_t1eam_crosswalk.json` |
| **Primary key** | `segment_id` (portal `gisfid`) |
| **Geometry** | Polygon (27,458 segments: ~24,219 footpath + ~3,239 shared use) — not centreline |
| **CRS (storage)** | EPSG:4326 (WGS 84) |
| **CRS (metric ops)** | EPSG:7855 (GDA2020 / MGA zone 55) for buffers, distances, overlap lengths |

### 2.1 Pass-through segment attributes

Copied unchanged from footpaths ingest:

| Column | Type | Notes |
|--------|------|--------|
| `segment_id` | string/int | Primary key |
| `walk_path_class` | string | `footpath` \| `shared_use` \| `other` — from portal `feature_type`; see §2.3 |
| `geometry` | polygon | WGS 84 |
| `surface_material` | string | Portal `pathsfmat` |
| `width_m` | float | QA flag separate |
| `width_qa_flag` | string | `ok`, `missing`, `zero`, `too_narrow`, `too_wide` |
| `length_m` | float | From source; prefer over computed geodesic for consistency |
| `function_use` | string | |
| `ownership` | string | |
| `suburb` | string | May include edge mis-tags (e.g. Dandenong); see §8 |
| `ward` | string | |
| `postcode` | string | |
| `gis_modified_date` | date/string | |

### 2.2 Derived segment geometry (optional, recommended)

| Column | Derivation | Use |
|--------|------------|-----|
| `centroid` | Point centroid of polygon in 7855 → 4326 | Point-in-polygon tests, map display |
| `segment_area_m2` | Area in 7855 | Polygon overlap weighting |

**v1 rule:** Use **walk network polygon** directly for polygon–polygon and polygon–line intersections. Do not require centreline extraction in v1.

### 2.3 Shared use paths (Council export)

Council publishes [Shared Use Paths (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/sharedusepaths_ply_t1eam/) as a **view extracted from Footpaths** (~3,239 rows). It is **not** unioned into the master network (that would double-count segments).

| Rule | v1 |
|------|-----|
| **Master** | All rows in `footpaths_ply_t1eam` (both `Footpath` and `Shared Use Path` `feature_type` values) |
| **Class column** | `walk_path_class` derived at ingest from `feature_type` |
| **Shared-use export** | Ingested for provenance; crosswalk QA on stable asset key `t1key` |
| **Scoring** | Same harmonisation joins and scoring pass for all classes; filters/QA may subset by `walk_path_class` |

---

## 3. Harmonisation principles

1. **One row per segment** — left join from walk network master; no duplicate `segment_id` rows.
2. **Metric accuracy** — all distances, buffers, and overlap lengths in EPSG:7855; store distances in metres.
3. **No false zeros** — missing join → `NULL`, not `0`, unless the metric is explicitly a count (then `0` is valid).
4. **Conservative proxies** — document when a layer is proximity/count only (lights, amenities, graffiti).
5. **Separate day/night crash fields** — all pedestrian crashes for context; night-eligible subset for Night Index inputs.
6. **Enriching vs primary** — council tree *points* are enriching; Vicmap tree *density polygons* are primary canopy.
7. **Reproducibility** — script `pipeline/scripts/harmonise_segments.py` (to be created); log join parameters in `data/qa/segment_harmonisation.json`.

---

## 4. Source layers and join methods

Summary table:

| Layer | Parquet | Geometry | Join method | Scoring stream |
|-------|---------|----------|-------------|----------------|
| Footpaths | `footpaths_ply_t1eam.parquet` | Polygon | Master | Accessibility (base) |
| Speed zones | `speed_zones_casey_2026-02.parquet` | Line | **25 m corridor** + line overlap | Accessibility |
| Graffiti | `graffiti-locations.parquet` | Point | Buffer count + recency | Accessibility |
| School crossings | `school_crossings_pt_t1eam.parquet` | Point | Nearest / within threshold | Accessibility (enrichment) |
| Urban heat 2018 | `metro_urban_heat_2018_casey.parquet` | Polygon | Area-weighted intersection | Day — heat |
| Tree density | `vicmap_tree_density_casey.parquet` | Polygon | Area-weighted intersection | Day — shade |
| Drinking fountains | `drinkingfountains_pt_t1eam.parquet` | Point | Nearest distance | Day — comfort |
| Benches / seats | `benches_seats_pt_t1eam.parquet` | Point | Count in buffer | Day — comfort |
| Street lights | `ausnet_unitedenergy_mvp4_streetlights.parquet` | Point | Nearest + count in buffer | Night — lighting |
| Park / reserve lights | `parkreserve_light_pt_t1eam.parquet` | Point | Nearest + count in buffer | Night — lighting |
| Ped crashes | `vic_crashes_casey_pedestrian.parquet` | Point | Count in buffer (all + night) | Night — crashes |
| Council trees | `council_trees_pt_t1eam.parquet` | Point | Count in buffer (optional v1) | Day — enriching |

---

## 5. Per-layer join rules

### 5.1 Speed zones (Accessibility)

**Input:** LineString/MultiLineString, `speed_limit_kmh`, `zone_length_m`, `road_name`.

**Design intent:** Footpaths often run **parallel** to carriageways. A walker on a path beside an 80–100 km/h road experiences traffic stress even when the speed-zone centreline never crosses the footpath polygon. **Intersection-only joins miss this.** Most crash risk concentrates at intersections, but **comfort and traffic stress** follow corridor exposure along the whole segment.

**Method:**

1. Reproject speed lines and footpath polygons to EPSG:7855.
2. Build a **25 m corridor** around each footpath polygon (`buffer(25)` — same corridor width as crashes and graffiti).
3. For each segment, find all speed-zone line segments that intersect the corridor.

| Output column | Rule |
|---------------|------|
| `speed_corridor_max_kmh` | **Maximum** `speed_limit_kmh` among zone lines in the 25 m corridor — primary **parallel exposure / comfort** metric |
| `speed_corridor_dominant_kmh` | Speed limit with the **longest line length** inside the corridor |
| `speed_corridor_line_m` | Total length (m) of speed-zone lines inside the corridor |
| `speed_nearest_line_m` | Minimum distance (m) from footpath polygon to any speed-zone line |
| `speed_nearest_line_kmh` | `speed_limit_kmh` on the nearest line |
| `speed_intersect_overlap_m` | Length (m) where zone line **directly intersects** the footpath polygon (crossings / on-reserve paths) |
| `speed_intersect_max_kmh` | Max speed among lines with direct polygon intersection |

**Scoring guidance (for future spec):**

- Use `speed_corridor_max_kmh` for **along-path traffic stress** (parallel arterial discomfort).
- Use `speed_intersect_*` to enrich **intersection-adjacent** segments where available.
- Do not treat “no intersection” as “no speed exposure” if `speed_corridor_max_kmh` is populated.

**Confidence:** `low` if no zone lines in corridor and `speed_nearest_line_m > 50` m; `ok` if corridor contains any line.

---

### 5.2 Graffiti (Accessibility)

**Input:** Point, `graffiti_type`, `created_date`, `days_to_remove`, `area_removed_m2`.

**Method:**

1. Build segment buffer **25 m** in 7855 (each side of footpath polygon ∪ 25 m outward buffer — use `buffer(25)` on polygon).
2. Count points within buffer:

| Output column | Rule |
|---------------|------|
| `graffiti_count_25m` | Count of records with point in buffer |
| `graffiti_offensive_count_25m` | Where `graffiti_type` = Offensive |
| `graffiti_days_since_last` | Days from harmonisation run date to most recent `created_date` in buffer; `NULL` if none |
| `graffiti_mean_days_to_remove` | Mean `days_to_remove` in buffer (completed jobs only); `NULL` if none |

**Recency window (optional):** Also compute `graffiti_count_25m_365d` — count where `created_date` within last 365 days. Helps scoring emphasise active maintenance pressure.

**Note:** Not crime data — density/recency proxy only ([`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) §6.1). Feeds **Accessibility** (shared 60%), so it affects **both** Day and Night Index scores.

---

### 5.3 School crossings (Accessibility enrichment)

**Input:** Point, `school_name`, `street_name`.

**Method:**

| Output column | Rule |
|---------------|------|
| `school_crossing_nearest_m` | Distance (m) to nearest crossing point |
| `school_crossing_within_20m` | Boolean — nearest ≤ **20 m** |
| `school_crossing_within_50m` | Boolean — nearest ≤ **50 m** |

Assign nearest crossing to segment by minimum distance from point to **footpath polygon** (not centroid).

**Does not** fill general crossing gap — flag segments with `school_crossing_within_20m = false` and no other crossing data at scoring stage.

---

### 5.4 Urban heat 2018 (Day Index — heat)

**Input:** Mesh block polygon, `uhi18_m`, `mesh_block_code`, `per_any_veg`.

**Method:** Area-weighted intersection with footpath polygon.

For each segment:

```
weight_i = area(segment ∩ mesh_block_i) / area(segment)
mean_uhi18_m = Σ (uhi18_m_i × weight_i)   -- only blocks with weight_i > 0
dominant_mesh_block = block with largest intersection area
```

| Output column | Rule |
|---------------|------|
| `uhi18_m` | Area-weighted mean UHI (°C above baseline); lower = better |
| `uhi_mesh_block_code` | Dominant mesh block code |
| `uhi_overlap_pct` | Sum(intersection area) / segment area — should ≈ 100% in urban areas |
| `per_any_veg_pct` | Area-weighted mean of `per_any_veg` where present |

**Fallback:** If no intersection (rural edge), use nearest mesh block centroid within 50 m and set `uhi_join_method = 'nearest'` + reduced confidence.

**Vintage:** 2018 — store in `data_vintage` JSON at scoring stage.

---

### 5.5 Vicmap tree density (Day Index — shade, primary canopy)

**Input:** Polygon, `tree_density` (`dense` / `medium` / `sparse`).

**Method:** Same area-weighted intersection as §5.4.

| Output column | Rule |
|---------------|------|
| `canopy_dense_pct` | % of segment area overlapping `dense` polygons |
| `canopy_medium_pct` | % overlapping `medium` |
| `canopy_sparse_pct` | % overlapping `sparse` |
| `canopy_class_dominant` | Class with largest overlap share (`dense` > `medium` > `sparse` tie-break) |
| `canopy_cover_pct` | `canopy_dense_pct + canopy_medium_pct + canopy_sparse_pct` |

**Scoring spec** will map classes to numeric shade score — harmonisation only exposes percentages.

---

### 5.6 Drinking fountains (Day Index — comfort)

**Input:** Point, `fountain_type`, `condition`.

| Output column | Rule |
|---------------|------|
| `fountain_nearest_m` | Nearest distance (m) point → footpath polygon |
| `fountain_within_100m` | Boolean — nearest ≤ **100 m** |
| `fountain_within_200m` | Boolean — nearest ≤ **200 m** |

Walking-comfort buffers; exact scoring threshold TBD in scoring spec.

---

### 5.7 Benches and seats (Day Index — comfort)

**Input:** Point, `amenity_type` — ignore `quantity` / `capacity` ([`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) §6.2).

| Output column | Rule |
|---------------|------|
| `bench_count_50m` | Count within **50 m** buffer of footpath polygon |
| `bench_nearest_m` | Nearest distance (m) |

---

### 5.8 Street lights — AusNet / United Energy (Night Index)

**Input:** Point, `wattage_w`, `globe_type`, `provider`, `wattage_qa_flag`.

| Output column | Rule |
|---------------|------|
| `streetlight_nearest_m` | Nearest distance (m) to footpath polygon |
| `streetlight_count_30m` | Count within **30 m** buffer |
| `streetlight_count_50m` | Count within **50 m** buffer |
| `streetlight_nearest_wattage_w` | Wattage of nearest light (if known) |
| `streetlight_max_gap_m` | **Derived (v1.2 stretch):** Along segment polygon, estimate max distance between consecutive lights within 50 m buffer |

**Gap length** remains the highest-value lighting metric but needs ordered lights along the path — defer to v1.2.

**Scoring (v1.1.3):** Harmonised nearest + counts are unchanged. Scoring normalises count by `length_m` → `lighting_density_per_100m` so one pole cannot light an entire long segment. See [`LIGHTING_DENSITY.md`](LIGHTING_DENSITY.md) and [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) §6.1.

#### 5.8a Light-type attributes in source data (v1 — not harmonised)

We **do** have technology/type fields, but v1 Night Index lighting uses **proximity + length-normalised density** only. No lux.

**AusNet / United Energy street lights** (42,258 points):

| Field | Population | Values (top) |
|-------|------------|--------------|
| `globe_type` | 100% | LED (23.5k), CC Mercury Vapour (8.1k), HP Sodium (8.0k), T5 Fluorescent (1.4k), Compact Fluorescent (1.2k) |
| `wattage_w` | 100% non-null | Median varies by type (e.g. LED ~18 W, HP Sodium ~150 W) — **proxy only**, not illumination |
| `provider` | 100% | AusNet Services (37.4k), United Energy (4.8k) |
| `globe_usage` | ~11% populated | Too sparse for v1 — ignore |

**Park / reserve lights** (3,162 points):

| Field | Population | Notes |
|-------|------------|--------|
| `luminaire_type` | High | LED (1.9k), Metal Halide (714), Mercury Vapour (367), … |
| `location_type` | High | Park (1.3k), Car Park (1.0k), Sport (851) |
| `light_type` | Mostly `To be determined` (2.3k/3.2k) | Sport floodlight subtypes where populated — not reliable for v1 |
| `wattage_w` | **74% zero or missing** | QA flag `zero_wattage` dominant — do not weight by wattage for park lights in v1 |

**Future scoring enrichment (post-v1):** e.g. `streetlight_led_share_30m`, `nearest_globe_type` — only after methodology sign-off on technology weighting.

---

### 5.9 Park / reserve lights (Night Index enrichment)

Same pattern as §5.8 with prefix `park_light_`:

| Output column | Rule |
|---------------|------|
| `park_light_nearest_m` | Nearest distance (m) |
| `park_light_count_50m` | Count within **50 m** buffer |

Combine with street lights at scoring stage (`combined_light_count_50m` optional derived column).

---

### 5.10 Pedestrian crashes — Casey (Night Index)

**Input:** Point, `light_category`, `night_index_eligible`, `injury_severity`, `crash_date`.

#### What “25 m crash attribution” means

For **each footpath segment**, we draw a **25 metre buffer** around the footpath polygon (roughly the walkable corridor either side of the path — consistent with CrashDash buffer practice). We then **count pedestrian crash points** inside that buffer.

```
     [crash ●]                    [crash ●]
          \                            |
           \  25 m corridor            |  inside buffer
            \  around footpath         v
    =========[====footpath segment====]=========
                    |
              [crash ●]  ← counted for this segment
```

- **`crash_ped_count_25m`** — all pedestrian crashes in Casey, ever, within 25 m of this segment  
- **`crash_ped_count_25m_5y`** — same, but crash date within the **last 5 years**  
- **`crash_night_count_25m`** — subset where lighting was dark (`night_index_eligible = true`)  
- **`crash_night_count_25m_5y`** — night-eligible, last 5 years — **primary Night Index crash input**

These are **raw counts**, not the final score. Scoring will typically convert to **density** (e.g. crashes per km of segment length) so a long shared path doesn’t automatically look worse than a short one.

**Overlap:** One crash near the junction of two segments may appear in **both** segments’ buffers. That is intentional for v1.

| Output column | Rule |
|---------------|------|
| `crash_ped_count_25m` | All pedestrian crashes within **25 m** buffer |
| `crash_ped_count_25m_5y` | Same, `crash_date` within last **5 years** |
| `crash_night_count_25m` | Where `night_index_eligible = true` |
| `crash_night_count_25m_5y` | Night-eligible, last 5 years |
| `crash_days_since_last` | Days since most recent crash in 25 m buffer; `NULL` if none |

Use harmonisation run date as reference for rolling windows.

**Normalisation for scoring:** Crash density per km segment length — computed at scoring stage using `length_m`.

---

### 5.11 Council trees (Day Index enriching — optional v1)

**Input:** ~203k points; `tree_type`, `tree_age`, `tree_height_m`.

Large volume — compute lightweight proximity only:

| Output column | Rule |
|---------------|------|
| `council_tree_count_25m` | Count within **25 m** buffer |
| `council_tree_street_count_25m` | Where `tree_type = 'Street Tree'` |
| `council_tree_nearest_m` | Nearest distance (m) |

**Not** primary canopy — Vicmap density (§5.5) takes precedence. Council trees support maturity/street-tree context only.

**Performance note:** Spatial index required; expect minutes not seconds for 203k points × 27k polygons.

---

## 6. Output artefact

### 6.1 File

| Path | Format |
|------|--------|
| `data/intermediate/segment_features.parquet` | GeoParquet, one row per `segment_id` |
| `data/qa/segment_harmonisation.json` | Join stats, null rates, parameter log |

### 6.2 Schema (minimum columns)

```
-- Identity & geometry
segment_id
geometry                    -- footpath polygon, EPSG:4326

-- Footpath (pass-through)
surface_material, width_m, width_qa_flag, length_m
function_use, ownership, suburb, ward, postcode
gis_modified_date

-- Accessibility joins
speed_corridor_max_kmh, speed_corridor_dominant_kmh, speed_corridor_line_m
speed_nearest_line_m, speed_nearest_line_kmh
speed_intersect_overlap_m, speed_intersect_max_kmh
graffiti_count_25m, graffiti_offensive_count_25m, graffiti_days_since_last
graffiti_count_25m_365d
school_crossing_nearest_m, school_crossing_within_20m, school_crossing_within_50m

-- Day Index joins
uhi18_m, uhi_mesh_block_code, uhi_overlap_pct, per_any_veg_pct, uhi_join_method
canopy_dense_pct, canopy_medium_pct, canopy_sparse_pct, canopy_class_dominant, canopy_cover_pct
fountain_nearest_m, fountain_within_100m, fountain_within_200m
bench_count_50m, bench_nearest_m
council_tree_count_25m, council_tree_street_count_25m, council_tree_nearest_m  -- optional

-- Night Index joins
streetlight_nearest_m, streetlight_count_30m, streetlight_count_50m, streetlight_nearest_wattage_w
park_light_nearest_m, park_light_count_50m
crash_ped_count_25m, crash_ped_count_25m_5y
crash_night_count_25m, crash_night_count_25m_5y, crash_days_since_last

-- Harmonisation metadata
harmonised_at                 -- ISO timestamp
methodology_version           -- "1.1"
harmonisation_spec_version    -- "0.1"
join_params                   -- JSON blob: buffer distances, CRS, speed vintage, etc.
coverage_flags                -- JSON: per-component present/missing/low_overlap
```

### 6.3 `coverage_flags` JSON (per segment)

Example structure for scoring confidence (ADR-005 precursor):

```json
{
  "speed": "ok",
  "uhi": "ok",
  "canopy": "ok",
  "streetlight": "ok",
  "crash": "missing",
  "crossing": "gap",
  "graffiti": "ok"
}
```

| Flag | Meaning |
|------|---------|
| `ok` | Join succeeded with sufficient overlap/count |
| `low` | Weak join (e.g. no speed lines in 25 m corridor, UHI nearest fallback) |
| `missing` | No features in range |
| `gap` | Known methodology gap (no general crossings / kerb ramps) |

---

## 7. Geographic scope and exclusions

Aligned with [`pipeline/PROCEEDINGS.md`](../pipeline/PROCEEDINGS.md):

| Rule | Implementation |
|------|----------------|
| **Scoring boundary** | City of Casey LGA |
| **Harmonisation** | Join all segments in T1EAM footpath layer |
| **Scoring exclusion** | Segments with `suburb` in exclude list OR centroid outside Casey LGA boundary → `score_eligible = false` |

**Proposed exclude suburbs** (edge mis-tags, confirmed low segment count outside pilot intent):

- `Dandenong` — adjacent LGA

**Validation needed:** Confirm exclude list with Council / Nikki. Option: clip to official LGA polygon instead of suburb name.

Store `score_eligible` boolean on each segment row.

---

## 8. QA checks

Run after harmonisation; write to `segment_harmonisation.json`:

| Check | Expectation |
|-------|-------------|
| Row count | = 27,458 (matches footpaths) |
| Duplicate keys | 0 |
| `uhi18_m` null rate | < 5% inside urban Casey |
| `canopy_cover_pct` null / zero | Document by suburb |
| `streetlight_nearest_m` median | < 50 m for urban segments |
| `speed_corridor_max_kmh` null rate | Document — expect low in urban Casey if corridor join works |
| Spot checks | Berwick CBD, Clyde North growth area, coastal Tooradin — manual viewer compare |

Compare aggregate counts to QA viewer suburb/ward stats ([`build_viewer_layers.py`](../pipeline/scripts/build_viewer_layers.py) `filters.json`) — totals should align within join tolerance.

---

## 9. Implementation plan

| Step | Task |
|------|------|
| 1 | Create `harmonise_segments.py` + `yourwalk_pipeline/harmonise/` helpers |
| 2 | Load master footpaths; reproject to 7855 for ops |
| 3 | Run joins in dependency order: polygons (UHI, canopy) → lines (speed) → points (batch by layer) |
| 4 | Write `segment_features.parquet` + QA report |
| 5 | Extend QA viewer with optional segment layer (top-N worst/best by raw `uhi18_m` or null flags) |
| 6 | [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) + `score_segments.py` |

**Estimated runtime:** 5–15 minutes on laptop for full Casey (dominated by council trees + graffiti spatial joins).

---

## 10. Understanding join parameters (plain language)

Each letter below is a **spatial rule** for attaching external data to a footpath segment. Harmonisation produces **numbers per segment**; the scoring spec decides how those numbers become 0–100 scores.

| ID | What we're asking | Plain language | Example on one segment |
|----|-------------------|----------------|------------------------|
| **A** | UHI / heat join | How do we assign 2018 heat to a footpath **polygon**? | Segment overlaps three mesh blocks → weighted average `uhi18_m` (lower °C = cooler = better later) |
| **B** | Speed zones | What traffic speed are walkers exposed to **along** this path? | Path runs parallel to 80 km/h arterial → `speed_corridor_max_kmh = 80` even if the centreline doesn’t cross the footpath polygon |
| **C** | Streetlights | How do we measure lighting **coverage** without lux? | 4 street lights within 30 m; nearest is 12 m away |
| **D** | Crashes | How do we link crash history to this path? | **2 night-time pedestrian crashes within 25 m in the last 5 years** → `crash_night_count_25m_5y = 2` |
| **E** | LGA edge cases | Do we score paths outside Casey? | Dandenong-tagged segments → `score_eligible = false` |
| **F** | Graffiti | How close must graffiti be to “belong” to this segment? | 3 graffiti records within 25 m of the footpath polygon |
| **G** | School crossings | When is a crossing “at” this segment? | Nearest school crossing 15 m away → `school_crossing_within_20m = true` |
| **H** | Fountains / benches | How close is “walking distance” for comfort? | Nearest fountain 80 m; 2 benches within 50 m |
| **I** | Council trees | Do we bother counting 203k trees near each segment? | Optional enriching column — 12 street trees within 25 m |

**Technical default (A):** All buffer distances are measured in **metres** after reprojecting to EPSG:7855 — standard for Victoria spatial work.

---

## 11. Parameters still open

**Locked (no further input needed):** graffiti → Accessibility (day + night); lighting → counts/distances only; heat → 2018 vintage documented.

| # | Parameter | Proposed default | Status |
|---|-----------|------------------|--------|
| 1 | Metric CRS | EPSG:7855 | Technical default — proceed unless objection |
| 2 | Graffiti buffer | 25 m | **Locked** (Accessibility proxy) |
| 3 | Graffiti recency | 365-day count column | Open — useful for scoring recency? |
| 4 | School crossing flag | 20 m | Open |
| 5 | Fountain buffers | 100 m / 200 m | Open |
| 6 | Bench buffer | 50 m | Open |
| 7 | Streetlight buffers | 30 m / 50 m | **Locked** (counts/distances; no lux) |
| 8 | Crash buffer | **25 m**; 5-year window | **Locked** (CrashDash-aligned corridor) |
| 9 | UHI join | Area-weighted intersection | **Locked** |
| 10 | Canopy join | Area-weighted % cover | **Locked** |
| 11 | Speed zone | **25 m corridor max + intersection overlap** | **Locked** — corridor max for parallel comfort; intersect for crossings |
| 12 | Council trees | Include count_25m | Open — compute cost vs value |
| 13 | LGA exclusion | Dandenong + LGA clip | Open |
| 14 | `score_eligible` | Boolean | Open |

---

## 12. Related documents

- [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) — methodology v1.1
- [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md) — dataset inventory
- [`pipeline/PROCEEDINGS.md`](../pipeline/PROCEEDINGS.md) — ingestion status
- [`pipeline/README.md`](../pipeline/README.md) — ingest runbook
- [`DECISIONS.md`](DECISIONS.md) — ADR-008 (spatial unit), ADR-005 (confidence, TBD)

---

## 13. Version history

| Version | Date | Changes |
|---------|------|---------|
| 0.3 | 30 May 2026 | Speed: 25 m **corridor** join for parallel exposure; crashes: **25 m** buffer (CrashDash-aligned) |
| 0.2 | 30 May 2026 | Locked graffiti/lighting/heat decisions; lighting attribute inventory; plain-language parameter guide; crash buffer explainer |
| **0.1** | **30 May 2026** | Initial draft — join rules, output schema, open validation items |
