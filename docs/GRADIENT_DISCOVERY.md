# Gradient / steepness — discovery findings

**Version:** 1.0  
**Status:** Discovery complete — **recommend defer from v1.1 scoring**  
**Date:** 1 July 2026  
**Methodology gate:** [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
**QA artefact:** `pipeline/data/qa/gradient_discovery.json`

---

## 1. Question

Should footpath **gradient / steepness** be included in the v1.1 Accessibility stream before methodology sign-off and app build?

Methodology v1.1 lists gradient as a candidate Accessibility input. It is **not** currently harmonised or scored in `harmonise_segments.py` / `score_segments.py`.

---

## 2. Sources evaluated

| Source | Access | Casey coverage (discovery) | Fit for segment gradient |
|--------|--------|---------------------------|---------------------------|
| **Metro ground surface points 1–5 m** | Open CC-BY — [ArcGIS REST](https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Elevation_METRO_1_to_5_metre/FeatureServer/0) | 6,726 points in Casey bbox | **Poor** — sparse spot heights, not a continuous surface |
| **Metro contours 1–5 m** | Same service, layer 1 | 81,717 lines in Casey bbox | **Partial** — ~55% of segments have contours within 40 m; range is local relief, not path grade |
| **Statewide 1:25k contours** | Same REST stack, layer 6 | 530 lines in Casey bbox | **Poor** — too sparse for footpath-scale slope |
| **Vicmap 1 m DEM** | Government subscription / Data Service Providers | ~99% populated areas (statewide product) | **Best** — raster sampling along path centreline; **not open to CrowdLab without license** |

Raw downloads (gitignored): `pipeline/data/raw/vicmap_elevation_metro_contours_casey.geojson`, `vicmap_elevation_metro_ground_points_casey.geojson`.

---

## 3. Discovery method

1. Clip Vicmap metro elevation layers to Casey footpaths envelope.
2. Sample **500 stratified segments** (top 10 suburbs × 50) and **2,000 random segments** from T1EAM footpaths.
3. For each segment: seven sample points along the **longest axis of the minimum rotated rectangle** (proxy for path direction — not true network centreline).
4. **Ground points:** nearest spot height within **75 m**; grade = elevation change / horizontal distance.
5. **Contours:** max − min altitude of contour lines within **40 m** buffer of footpath polygon.

---

## 4. Results (summary)

Full numbers: `pipeline/data/qa/gradient_discovery.json`.

| Metric | Result |
|--------|--------|
| Ground point coverage (≥3 of 7 samples within 75 m) | **10.4%** stratified; **7.8%** network sample |
| Ground point coverage (any sample) | **12.2%** |
| Segments with usable grade estimate from points | **55 / 500** (11%) |
| Grade > 8% (AS 1428 ramp trigger) in sample | **1** segment (likely MRR artefact) |
| Contour coverage (any contour in 40 m) | **55.2%** stratified; **63.2%** network sample |
| Median contour altitude range in 40 m buffer | **3.0 m** (p90 **11.0 m**) — local hilliness, not path slope |

**Interpretation:** Open metro spot heights are **too sparse** for reliable per-segment gradient. Contours give regional relief context but **do not measure slope along the walk path** and miss ~40% of segments entirely. A defensible gradient score needs a **continuous DEM** (1 m preferred).

---

## 5. Licensing constraint (1 m DEM)

The Vicmap 1 m DEM is the appropriate production source (±10 cm vertical, GDA2020/AHD). Web services are available to **government subscribers** under the Vicmap Elevation Subscription Program. Private sector access is via authorised Data Service Providers.

**Implication for YourWalk:** CrowdLab cannot treat 1 m DEM as a confirmed open pipeline input for the Casey pilot without either:

- Casey Council providing slope/gradient as an asset layer or DEM extract under the grant, or  
- A licensed data path (DSP / Monash institutional access), or  
- Explicit acceptance of a coarse, low-coverage open proxy (not recommended for sign-off).

---

## 6. Recommendation for v1.1 sign-off

| Decision | Recommendation |
|----------|------------------|
| Include gradient in v1.1 Accessibility weights? | **No — defer to v1.2** |
| Methodology text | Keep gradient as a **documented planned input**; Accessibility v1.1 scores on **width, surface, speed, graffiti**, plus school-crossing bonus |
| Confidence | No gradient-specific penalty in v1.1; crossing/kerb gaps already reduce confidence via `coverage_flags.crossing = gap` |
| Council action | Ask Casey whether they hold slope/gradient attributes or can supply Vicmap 1 m DEM clip as government subscriber |
| Future implementation | Centreline extraction → sample 1 m DEM at 5–10 m intervals → `max_grade_pct` per segment → AS 1428–aligned rubric (e.g. ≤5% good, 5–8% moderate, >8% poor) |

This aligns with methodology rule: **do not impute missing data as zero**. Omitting gradient is preferable to scoring on a 12%-coverage proxy.

---

## 7. Nikki sign-off ask (Friday)

> We investigated open elevation sources. They are not sufficient for footpath-grade scoring at pilot quality. We recommend **locking v1.1 without gradient**, documenting the gap, and pursuing Council or licensed 1 m DEM for v1.2. Do you agree?

If Nikki requires gradient in v1.1 for grant narrative, the honest fallback is **dashboard context only** (contour density / relief band) — **not** a weighted Accessibility component.

---

## 8. Related documents

- [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) — gradient out of scope until method confirmed
- [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) — Accessibility weights without gradient
- [`pipeline/PROCEEDINGS.md`](../pipeline/PROCEEDINGS.md) — Wave 4 status
- [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md) — Vicmap Elevation entries
