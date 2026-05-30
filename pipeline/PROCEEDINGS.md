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
| 6 | Casey Asset Lights (parks/reserves) | — | Night Index enrichment | 📋 |

**Notes:**

- Crash ingestion filters `LGA_NAME = CASEY`, `PEDESTRIAN > 0`, tags `light_category` and `night_index_eligible`. Segment crash density is a **scoring** step, not ingestion.
- CrashDash (`../crashdash/etl/vic/`) is reference for field mapping only — do not import GeoJSON artifacts into YourWalk.

---

### Wave 3 — Day Index (Heat & Shade) — discovery first

| # | Dataset | Script | Stream | Status |
|---|---------|--------|--------|--------|
| 7 | **Discovery:** heat + canopy products and segment join method | — | — | 🔍 |
| 8 | Metro Melbourne Urban Heat 2018 | TBD | Day Index 40% | 🔍 |
| 9 | Vicmap Vegetation Tree Urban / Tree Density | TBD | Day Index 40% | 🔍 |
| 10 | Drinking Fountains (T1EAM) | TBD | Day Index comfort | 📋 |
| 11 | Benches and Seats (T1EAM) | TBD | Day Index comfort | 📋 |

**Discovery questions (validate before ingest):**

1. **Heat:** Which product and attributes — mesh block LST, HVI, or both? DataShare SHP/GDB download vs alternative. Casey coverage within Greater Melbourne boundary.
2. **Canopy:** Tree Density polygons vs Tree Urban points vs REST API — trade-off between coverage simplicity and file size for ~27k segments.
3. **Segment join:** Centroid sample vs buffer mean for LST; canopy distance/buffer rule for shade along footpath segments.
4. **Vintage:** Document 2018 heat + 2019/2020 canopy in `data_vintage` JSON per methodology.

---

### Wave 4 — Accessibility enrichment and overlays

| # | Dataset | Script | Stream | Status |
|---|---------|--------|--------|--------|
| 12 | School Crossings (T1EAM) | TBD | Accessibility enrichment | 📋 |
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
| Harmonise all layers to T1EAM segment network | Snap/join points and lines; derive segment attributes | Not started |
| Scoring algorithm | `day_index_score`, `night_index_score` + sub-scores | Not started |
| PostGIS / Supabase load | GeoParquet → production layer | Not started |
| Confidence model (ADR-005) | Per-component high/medium/low | Not started |

---

## What not to build yet

- Next.js app, Mapbox UI, routing engine (ADR-001)
- OSM footway gap-fill until ODbL licensing review
- Combined day/night crash scoring in index (methodology: night crashes in Night Index only)

---

## Related docs

- [`README.md`](README.md) — runbook and per-dataset detail
- [`docs/DATA_SET_REGISTER.md`](../docs/DATA_SET_REGISTER.md) — full inventory
- [`docs/meeting-prep/nikki-29-may-pipeline.html`](../docs/meeting-prep/nikki-29-may-pipeline.html) — pipeline visual
