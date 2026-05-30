# Phase B pipeline — order of proceedings

City of Casey pilot. Methodology gate: [`docs/VULNERABILITY_INDEX.md`](../docs/VULNERABILITY_INDEX.md) v1.1.

This document tracks ingestion order, dependencies, and what is blocked on discovery or Council input. The repo is the source of truth; update this file when a dataset is ingested or priorities change.

## Status key

| Symbol | Meaning |
|--------|---------|
| ✅ | Ingestion script exists and has been run |
| 🔄 | In progress or next up |
| 🔍 | Discovery / validation required before ingest |
| ⏸ | Blocked (Council data, licensing, or methodology sign-off) |
| 📋 | Planned — straightforward Casey Open Data or state API |

---

## Order of proceedings

### Wave 1 — Segment network and shared Accessibility (complete)

| # | Dataset | Script | Stream | Status |
|---|---------|--------|--------|--------|
| 1 | Footpaths (T1EAM) | `ingest_footpaths_t1eam.py` | Segment network (ADR-008) | ✅ |
| 2 | Speed Zones | `ingest_speed_zones.py` | Accessibility 60% | ✅ |
| 3 | Graffiti Locations | `ingest_graffiti.py` | Accessibility 60% | ✅ |

**Dependency:** Footpaths first — used as Casey clip envelope for speed zones.

---

### Wave 2 — Night Index inputs

| # | Dataset | Script | Stream | Status |
|---|---------|--------|--------|--------|
| 4 | AusNet / United Energy street lights | `ingest_streetlights.py` | Night Index 40% | ✅ |
| 5 | Victoria Road Crash Data (Casey pedestrian) | `ingest_vic_crashes.py` | Night Index 40% | ✅ |
| 6 | Casey Asset Lights (parks/reserves) | `ingest_park_lights.py` | Night Index enrichment | ✅ |

**Notes:**

- Crash ingestion filters `LGA_NAME = CASEY`, `PEDESTRIAN > 0`, tags `light_category` and `night_index_eligible`. Segment crash density is a **scoring** step, not ingestion.
- CrashDash (`../crashdash/etl/vic/`) is reference for field mapping only — do not import GeoJSON artifacts into YourWalk.

---

### Wave 3 — Day Index (Heat & Shade)

**Confirmed approach (May 2026):** ingest **Casey Council Trees** for local inventory/maturity/proximity; ingest **Vicmap Tree Density** polygons as **primary canopy/shade** for Day Index scoring; **Metro Melbourne Urban Heat 2018** for LST.

| # | Dataset | Script | Stream | Status |
|---|---------|--------|--------|--------|
| 7 | Casey Council Trees (T1EAM) | `ingest_council_trees.py` | Day Index enriching | ✅ |
| 8 | Vicmap Vegetation Tree Density | `ingest_vicmap_tree_density.py` | Day Index canopy (primary) | ✅ |
| 9 | Metro Melbourne Urban Heat 2018 | `ingest_metro_urban_heat_2018.py` | Day Index heat | ✅ |
| 10 | Drinking Fountains (T1EAM) | `ingest_drinking_fountains.py` | Day Index comfort | ✅ |
| 11 | Benches and Seats (T1EAM) | `ingest_benches_seats.py` | Day Index comfort | ✅ |

**Casey Council Trees** — [council_trees_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/council_trees_pt_t1eam/): ~203k Council-owned assets. Use for proximity, `tree_age`, `tree_height_m`, street vs reserve type. Portal `canopyewwidth_m` / `canopynswidth_m` fields are usually zero — not primary canopy.

**Vicmap Tree Density** — [DataVic](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon): polygon layer with **Dense / Medium / Sparse** tree cover classes (2019/2020). Ingested via DEECA open-data WFS (`open-data-platform:tree_density`), clipped to Casey footpaths envelope + buffer.

**Discovery resolved (May 2026):** WFS GeoJSON ~15 MB / ~4k polygons for Casey; attributes `tree_density`, `feature_subtype` (forest), source dates 2019-12-17 → 2020-04-28. Segment join rule: area-weighted overlap — see [`docs/SEGMENT_HARMONISATION.md`](../docs/SEGMENT_HARMONISATION.md) §5.5.

**Metro Melbourne Urban Heat 2018** — [DataVic](https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018): 2016 ABS **mesh blocks** with **`UHI18_M`** (urban heat island, °C above non-urban baseline from Landsat-8 LST). Ingested via Plan Melbourne ArcGIS REST (`Vegetation_and_heat_mapping/MapServer/6`), clipped to Casey footpaths envelope.

**Urban heat discovery resolved (May 2026):**

| Item | Finding |
|------|---------|
| **Primary metric** | `UHI18_M` — not absolute LST; deviation from native-vegetation baseline |
| **Geography** | Mesh block polygons (~30 m landscape); 2016 ABS codes |
| **Casey coverage** | ~3,400 mesh blocks in pilot envelope; ~2,970 tagged `Casey (C)` LGA |
| **Access** | ArcGIS REST GeoJSON (paginated); DataShare SHP/GDB also available |
| **Capture** | Summer Landsat-8, ~10:50 AM; 2018 vintage |
| **Scoring** | Lower `UHI18_M` = better; segment join: area-weighted intersection — [`SEGMENT_HARMONISATION.md`](../docs/SEGMENT_HARMONISATION.md) §5.4 |
| **Optional enrichment** | HVI 2018 at SA1 (MapServer layer 4); co-located `PERANYVEG` on mesh blocks |

**Discovery still open:**

1. **Segment join:** area-weighted mesh-block intersection (primary); 50 m nearest fallback — [`SEGMENT_HARMONISATION.md`](../docs/SEGMENT_HARMONISATION.md) §5.4.
2. **Vintage:** document 2018 heat + 2019/2020 canopy in scoring output.

---

### Wave 4 — Accessibility enrichment and overlays

| # | Dataset | Script | Stream | Status |
|---|---------|--------|--------|--------|
| 12 | School Crossings (T1EAM) | `ingest_school_crossings.py` | Accessibility enrichment | ✅ |
| 13 | Vicmap Elevation (gradient derivation) | TBD | Accessibility | 🔍 |
| 14 | General pedestrian crossings | — | Accessibility | ⏸ Council request drafted |
| 15 | Kerb ramps | — | Accessibility | ⏸ Council request drafted |
| 16 | Public toilets, dog bags (T1EAM) | TBD | Dashboard overlays only | 📋 |
| 17 | SEIFA / demographics (Casey portal) | TBD | Community Need overlay | 📋 |
| 18 | YourGround perception | TBD | Separate layer (not index) | ⏸ XYX Lab access |

---

### Wave 5 — Scoring and production load

| Step | Description | Status |
|------|-------------|--------|
| Harmonise all layers to T1EAM segment network | Snap/join points and lines; derive segment attributes — see [`docs/SEGMENT_HARMONISATION.md`](../docs/SEGMENT_HARMONISATION.md) | ✅ `harmonise_segments.py` |
| Scoring algorithm | `day_index_score`, `night_index_score` + sub-scores — see scoring spec (TBD) | Not started |
| PostGIS / Supabase load | GeoParquet → production layer | Not started |
| Confidence model (ADR-005) | Per-component high/medium/low | Not started |

---

## What not to build yet

- Next.js app, Mapbox UI, routing engine (ADR-001)
- OSM footway gap-fill until ODbL licensing review
- Combined day/night crash scoring in index (methodology: night crashes in Night Index only)

**Local QA map** (`pipeline/viewer/`) is allowed — Leaflet layer toggles, suburb/ward filters, coverage stats; not production UI.

### Geographic scope (locked for pilot)

| Scope | Policy |
|-------|--------|
| **Index scoring** | City of Casey LGA — T1EAM footpath segments + harmonised layers |
| **Routing graph** (Phase C) | OSM clip, Casey LGA **+ 2 km buffer**; segments outside LGA scored with **reduced confidence** |
| **MVP origin/destination** | Both endpoints **within Casey LGA** |
| **Council dashboard filters** | **Suburb** (primary), **ward** (secondary), **SA2** (hotspot reporting aggregate) |

---

## Related docs

- [`README.md`](README.md) — runbook and per-dataset detail
- [`docs/DATA_SET_REGISTER.md`](../docs/DATA_SET_REGISTER.md) — full inventory
- [`docs/SEGMENT_HARMONISATION.md`](../docs/SEGMENT_HARMONISATION.md) — Wave 5 join rules and `segment_features.parquet` schema
- [`docs/meeting-prep/nikki-29-may-pipeline.html`](../docs/meeting-prep/nikki-29-may-pipeline.html) — pipeline visual
