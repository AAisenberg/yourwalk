# Crossing and kerb ramp harmonisation — draft specification

**Version:** 0.1 (draft)  
**Status:** Draft — not a v1.1 pipeline gate; for future reference  
**Last updated:** 3 June 2026  
**Methodology gate:** [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
**Parent spec:** [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) (proposed §5.9 extension)  
**Scoring:** [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) (proposed §4.8 extension)

This document defines how **pedestrian crossings, kerb ramps, and intersection accessibility** could be joined to the T1EAM footpath segment network when Council asset data is missing or incomplete.

It also records a **broader strategic hypothesis**: councils often lack systematic crossing and kerb ramp inventories, and a **desktop AI audit service** (no field crews) may be a viable product line for CrowdLab beyond the YourWalk pilot.

**v1.1 position (unchanged):** general crossings and kerb ramps remain a documented gap. Score on available footpath attributes with `coverage_flags.crossing = gap`. Do not impute missing ramp data as zero.

---

## 1. Problem statement

### 1.1 YourWalk pilot gap

Co-design participants flagged **pedestrian crossings** and **kerb ramps** as top accessibility pain points. Methodology v1.1 includes both in the shared Accessibility stream (60%), but Casey open data provides:

- Footpaths (T1EAM): geometry, surface, width — **no kerb ramp attribute**
- School crossings only (142 records) — **not general crossings**
- Traffic signals (~203 assets in LGA) — **context only**, not ramp or crossing quality

Draft Council request: [`comms/casey-council-data-request-crossings-kerb-ramps.md`](comms/casey-council-data-request-crossings-kerb-ramps.md) (not yet sent).

### 1.2 Broader council data gap (strategic)

The Casey gap is typical. Most Australian councils hold footpath **geometry and maintenance** assets but not a complete, queryable layer of:

- Kerb ramp location and type (flush, dropped, tactile paving present/absent)
- Legal pedestrian crossing locations (zebra, signalised, refuge)
- **Intersection accessibility** (which approaches have compliant ramps, missing ramps, or barriers)

Physical accessibility audits are expensive (wheelchair pilots, consultants such as Briometrix or Fedasen). Councils want the evidence for investment prioritisation but rarely have budget for city-wide inspection.

**Hypothesis (CrowdLab service opportunity):**

> A **desktop-first AI audit** using street-level imagery, OSM/footpath network context, and human QA sampling could produce a **crossing and kerb ramp inventory** deliverable to councils without deploying field teams — as a standalone data product or upsell from YourWalk-style vulnerability mapping.

This spec supports YourWalk scoring if imagery or crowd data is adopted. The same pipeline could be productised as **Crossing & Kerb Intelligence** (working name) for other LGAs.

| YourWalk pilot | Potential service line |
|----------------|------------------------|
| Segment Day/Night index | Full kerb ramp + crossing point layer |
| Reduced confidence when data missing | Council-facing completeness report |
| Resident route scoring | Investment prioritisation heatmap (SA2 / ward) |
| Grant deliverable | Paid scope: LGA-wide desktop audit |

**Not in scope for this doc:** pricing, sales, or build commitment. Recorded so engineering choices stay compatible with a future product.

---

## 2. Design principles

Aligned with methodology v1.1 and [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md):

1. **Unknown ≠ absent.** Segments without crossing or ramp data receive neutral treatment in scoring, not a zero penalty.
2. **Authoritative beats inferred.** Council asset data outranks computer vision and crowdsourcing.
3. **Points harmonise to segments.** External tools (Project Sidewalk, RampNet, Mapillary) produce **points or pano labels**; YourWalk scores **T1EAM polygons**.
4. **Provenance is mandatory.** Every derived field carries `source`, `vintage`, and `confidence`.
5. **Intersection logic is explicit.** Kerb ramps matter at **road interfaces**, not along mid-block path geometry.

---

## 3. Reference implementations

| Source | What it provides | License / constraint | Fit for Casey |
|--------|------------------|----------------------|---------------|
| **Casey Council** | Asset points or footpath attributes | Open data / sharing agreement | Primary if held |
| **Project Sidewalk** | Crowdsourced GSV labels (curb ramp, missing curb, surface, obstruction) | GSV redistribution limits; label coords shareable | Taxonomy + QA patterns; heavy to deploy per city |
| **RampNet** | GSV curb ramp detector (ConvNeXt V2); bootstrapped from US gov metadata | GSV ToS blocks bulk pipeline use without agreement | Model architecture reference; needs seed coords or manual QA set |
| **Mapillary** | Imagery (CC BY-SA) + `curb-cut` detections | ODbL questions for derived features in Council products | Best imagery fallback candidate |
| **MOVE** | Australian crowd accessibility barriers | Open contributions | Coverage in Casey unknown |
| **YourWalk audits** | Resident submissions ([`FLOWS/03_accessibility_audit_submit.md`](FLOWS/03_accessibility_audit_submit.md)) | Project-owned | Overlay + moderated harmonisation |

Deep dive on Project Sidewalk org: crowdsourcing on GSV → ResNet/DINOv2 validators → RampNet auto-labelling. See [Project Sidewalk GitHub](https://github.com/ProjectSidewalk).

---

## 4. Data architecture

### 4.1 Two-layer model

```text
[ Sources ]  →  accessibility_points.parquet  →  harmonisation §5.9  →  segment_features.parquet
                      (point layer)                  (segment joins)         (existing artefact)
```

External labels never land directly on segments without the staging layer and join rules below.

### 4.2 Staging: `accessibility_points.parquet`

**Path:** `pipeline/data/intermediate/accessibility_points.parquet`  
**Grain:** one row per label or detection

| Column | Type | Description |
|--------|------|-------------|
| `point_id` | string | Stable UUID |
| `geometry` | POINT (EPSG:4326) | WGS84 location |
| `label_type` | enum | See §4.3 |
| `source` | enum | `council` \| `projectsidewalk` \| `rampnet` \| `mapillary` \| `move` \| `yourwalk_audit` \| `osm` |
| `confidence` | enum | `high` \| `medium` \| `low` |
| `imagery_vintage` | date | Capture date of source imagery, if known |
| `agree_count` | int | Crowd validation (PS / MOVE) |
| `disagree_count` | int | Crowd validation |
| `qa_flag` | string | e.g. `driveway_suspect`, `validator_rejected`, `moderation_pending` |
| `attributes` | JSON | Type-specific payload (tactile, severity, crossing_type) |
| `created_at` | timestamp | Ingest time |
| `methodology_version` | string | e.g. `crossing_kerb_0.1` |

### 4.3 Label type enum

| `label_type` | Origin examples | Use in harmonisation |
|--------------|-----------------|----------------------|
| `kerb_ramp` | PS, RampNet, Mapillary, Council | Positive signal at interface |
| `missing_curb` | PS, audits ("high kerb") | Penalty only if confirmed |
| `no_kerb_ramp` | PS (confirmed absence) | Penalty only if high confidence |
| `general_crossing` | Council, OSM, signals QA | Crossing proximity bonus |
| `tactile_present` | PS tagger, audit | Modifier when ramp confirmed |
| `tactile_absent` | PS tagger, audit | Modifier when ramp confirmed |
| `surface_problem` | PS, audits | Overlay / QA (not primary surface in v1) |
| `obstruction` | PS, audits | Overlay |

### 4.4 Kerb interface candidates

Kerb ramps are assessed at **road-adjacent segment endpoints**, not along entire polygons.

**Derivation (per segment):**

1. Extract candidate endpoints from T1EAM footpath geometry (start/end of longest axis or network nodes).
2. Filter to endpoints within **15 m** of road responsibility geometry ([`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md) — adjacent road join).
3. Store candidate count in QA report; expect **~30k–80k** candidates across Casey (estimate — validate in spike).

Each candidate endpoint gets a stable `interface_id` for per-endpoint scoring before segment rollup.

---

## 5. Harmonisation rules (proposed §5.9)

Extends [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md). **Not implemented in v1.1.**

### 5.1 Join method

| Output column | Rule | Notes |
|---------------|------|-------|
| `kerb_ramp_nearest_m` | Min distance from any **kerb interface candidate** on segment to nearest `label_type = kerb_ramp` point | Same pattern as `school_crossing_nearest_m` |
| `kerb_ramp_within_15m` | Boolean — nearest ≤ **15 m** | Threshold open for QA |
| `kerb_ramp_confirmed_count_25m` | Count of ramp points within **25 m** of segment polygon where `confidence = high` and `disagree_count ≤ agree_count` | |
| `missing_curb_within_15m` | Boolean — confirmed `missing_curb` or `no_kerb_ramp` at any interface ≤ **15 m** | Requires confirmation |
| `crossing_general_nearest_m` | Nearest `general_crossing` point to segment polygon | Council or OSM when available |
| `crossing_general_within_25m` | Boolean | |
| `tactile_present_at_ramp` | `true` / `false` / `NULL` | Only when ramp confirmed at interface |
| `crossing_data_source` | Dominant source enum for segment crossing/kerb fields | Provenance |
| `crossing_data_vintage` | Newest `imagery_vintage` among contributing points | |

**Segment rollup for endpoints:** when a segment has two road-adjacent interfaces, compute per-endpoint scores then take the **mean** for segment-level fields. Document endpoints with no imagery as **unknown (neutral)**, not absent.

### 5.2 Source priority (conflicts)

| Priority | Source | Trust |
|----------|--------|-------|
| 1 | Casey Council asset layer | Authoritative |
| 2 | Crowd + validator AI agree (PS, MOVE) | High |
| 3 | RampNet / Mapillary CV | Medium — requires QA sample |
| 4 | YourWalk moderated audit | Medium |
| 5 | OSM crossing tags | Low — licensing and completeness TBD |
| — | No data | Neutral; `coverage_flags.crossing` remains `gap` or `partial` |

### 5.3 `coverage_flags.crossing` (extended)

| Value | Meaning |
|-------|---------|
| `gap` | **v1.1 default.** No Council, imagery, or crowd data |
| `partial` | Some interfaces have inferred data; not LGA-complete or not authoritative |
| `low` | Data present but stale imagery (>3 years) or low detection confidence |
| `ok` | Council authoritative data, or all relevant interfaces confirmed at high confidence |

Scoring confidence ([`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) §8): `gap` or `partial` → −1 tier on accessibility until ADR-005 finalised.

---

## 6. Label mapping tables

### 6.1 Project Sidewalk → staging

| PS label | `label_type` | `source` |
|----------|--------------|----------|
| Curb ramp | `kerb_ramp` | `projectsidewalk` |
| Missing curb | `missing_curb` | `projectsidewalk` |
| No curb ramp | `no_kerb_ramp` | `projectsidewalk` |
| Surface problem | `surface_problem` | `projectsidewalk` |
| Obstruction | `obstruction` | `projectsidewalk` |

### 6.2 sidewalk-tagger-ai (selected classes) → staging

| Tagger class | `label_type` | In index? |
|--------------|--------------|-----------|
| Missing tactile warnings on curb ramps | `tactile_absent` | Yes (modifier) |
| Bumpy, cracks, uneven, narrow | `surface_problem` | Overlay v1 |
| Pole / sign obstruction | `obstruction` | Overlay v1 |

### 6.3 RampNet → staging

| RampNet output | Transform |
|----------------|-----------|
| Heatmap peak (x, y) in pano | Project to lat/lng; `label_type = kerb_ramp`, `source = rampnet` |
| Peak confidence ≥ 0.5 | `confidence = medium`; promote to `high` after QA |
| Driveway false positive | Set `qa_flag = driveway_suspect`; exclude from harmonisation until cleared |

### 6.4 YourWalk audit form → staging

| Audit field ([`FLOWS/03`](FLOWS/03_accessibility_audit_submit.md)) | `label_type` |
|---------------------------------------------------------------------|--------------|
| High kerb (obstacle) | `missing_curb` |
| Crossing quality Poor / Needs improvement | `attributes.crossing_quality` |
| Tactile present / absent | `tactile_present` / `tactile_absent` |
| Surface quality Cracked / Broken | `surface_problem` |

---

## 7. Scoring extension (proposed §4.8)

**Not active in v1.1.** When crossing/kerb data is available, renormalize Accessibility sub-components:

| Component | Proposed weight | Logic |
|-----------|-----------------|-------|
| Width | 27% | Unchanged rubric |
| Surface | 22% | Unchanged rubric |
| Speed exposure | 22% | Unchanged rubric |
| Graffiti proxy | 14% | Unchanged rubric |
| **Kerb interface** | **10%** | Per-interface: confirmed ramp → 100; confirmed missing → 20; **unknown → 50** |
| School crossing bonus | +5 max | Unchanged |
| General crossing bonus | +5 max | `crossing_general_within_25m` |

**Tactile modifier** (when ramp confirmed): present +10, absent −15, unknown 0 — applied to kerb interface sub-score, not as a separate weight.

---

## 8. Desktop AI audit service (product sketch)

Working outline for a council-facing offer distinct from but adjacent to YourWalk.

### 8.1 Deliverables

1. **Kerb ramp point layer** (GeoJSON / GeoParquet) with confidence and source
2. **General crossing point layer** (where inferable from signals, OSM, CV)
3. **Intersection accessibility summary** — per intersection node: count of approaches with confirmed ramp, missing ramp, or unknown
4. **Completeness report** — % of kerb interfaces covered by imagery; QA sample accuracy
5. **Optional:** import into YourWalk `segment_features` for index scoring

### 8.2 Processing pipeline (all desktop)

```text
1. Ingest council footpath + road network (or OSM fallback)
2. Derive kerb interface candidates
3. Fetch street-level imagery metadata (Mapillary API; GSV only where licensed)
4. Run CV detection (RampNet-class model + Mapillary map features)
5. Apply driveway / geometry filters
6. Human QA on stratified sample (e.g. 5% per suburb)
7. Publish point layers + confidence + methodology PDF
```

No field crews. Wheelchair-user validation recommended on **sample only** for credibility, not full LGA push.

### 8.3 Differentiators vs consultants

| Traditional mobility mapping | Desktop AI audit |
|------------------------------|------------------|
| Wheelchair pilot, 360° capture | Imagery + network geometry |
| High accuracy, limited coverage | Broader coverage, confidence-tiered |
| Higher cost per km | Lower marginal cost per LGA |
| Effort-based route maps | Asset inventory + optional index scoring |

### 8.4 Risks to disclose to councils

- Imagery staleness and parked-car occlusion
- Driveway vs kerb ramp false positives
- Tactile paving not visible from carriageway angle
- Not a compliance certification — **decision support** only
- GSV bulk use requires legal review; Mapillary preferred for productised pipeline

---

## 9. Implementation phases (YourWalk repo)

| Phase | Work | Gate |
|-------|------|------|
| **0 — v1.1** | Council request sent; `coverage_flags.crossing = gap` | Current pipeline |
| **1 — spike** | Casey bbox Mapillary coverage + kerb interface candidate count | Footpaths ingested |
| **2 — staging** | `ingest_accessibility_points.py` + schema | Spike pass/fail |
| **3 — harmonisation** | §5.9 columns in `segment_features.parquet` | Nikki / methodology sign-off |
| **4 — scoring** | §4.8 weights in `SCORING_SPEC` | Partial or Council data available |
| **5 — product** | Package desktop audit as standalone SOW template | Business decision |

---

## 10. Example segment records

### 10.1 v1.1 (today)

```json
{
  "segment_id": "FP-12345",
  "school_crossing_within_20m": false,
  "coverage_flags": { "crossing": "gap" },
  "accessibility_score": 72,
  "confidence_tier": "medium"
}
```

### 10.2 Future — partial imagery

South interface: ramp detected (RampNet). North interface: no imagery.

```json
{
  "segment_id": "FP-12345",
  "kerb_ramp_within_15m": true,
  "kerb_ramp_confirmed_count_25m": 1,
  "crossing_data_source": "cv_rampnet",
  "crossing_data_vintage": "2024-06",
  "coverage_flags": { "crossing": "partial" },
  "score_kerb_interface": 75,
  "accessibility_score": 74,
  "confidence_tier": "medium"
}
```

`score_kerb_interface = mean(100, 50)` — confirmed south, unknown north.

### 10.3 Future — Council authoritative

```json
{
  "segment_id": "FP-12345",
  "kerb_ramp_within_15m": true,
  "tactile_present_at_ramp": true,
  "crossing_general_within_25m": true,
  "crossing_data_source": "council",
  "coverage_flags": { "crossing": "ok" },
  "score_kerb_interface": 100,
  "confidence_tier": "high"
}
```

---

## 11. Open questions

| # | Question | Owner |
|---|----------|-------|
| 1 | Does Casey hold kerb ramps as asset data? | Council (pending request) |
| 2 | Mapillary coverage % of Casey kerb interface candidates? | CrowdLab spike |
| 3 | ODbL / CC BY-SA obligations for CV-derived points in Council product? | Legal + ADR |
| 4 | Endpoint vs full polygon join — 15 m or 20 m threshold? | Pipeline QA |
| 5 | Productise desktop audit under CrowdLab brand or YourWalk upsell? | Business |
| 6 | Nikki sign-off on neutral (50) vs penalty for confirmed missing ramp | XYX Lab |

---

## 12. Related documents

- [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) — methodology gate; crossing/kerb in Accessibility 60%
- [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) — parent harmonisation spec
- [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) — current scoring (crossing gap)
- [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md) — dataset inventory and gaps
- [`comms/casey-council-data-request-crossings-kerb-ramps.md`](comms/casey-council-data-request-crossings-kerb-ramps.md) — Council request draft
- [`FLOWS/03_accessibility_audit_submit.md`](FLOWS/03_accessibility_audit_submit.md) — resident audit flow

---

## 13. Version history

| Version | Date | Changes |
|---------|------|---------|
| **0.1** | **3 Jun 2026** | **Initial draft — harmonisation mapping, PS/RampNet/Mapillary sources, desktop AI service hypothesis** |
