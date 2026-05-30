# YourWalk Pipeline

Phase B data pipeline for the City of Casey pilot. Stack: **DuckDB → GeoParquet → PostGIS/Supabase**.

Methodology gate: [`docs/VULNERABILITY_INDEX.md`](../docs/VULNERABILITY_INDEX.md) v1.1  
Dataset inventory: [`docs/DATA_SET_REGISTER.md`](../docs/DATA_SET_REGISTER.md)  
**Ingestion order:** [`PROCEEDINGS.md`](PROCEEDINGS.md)

## Setup

```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

Requires Python 3.11+. DuckDB spatial extension is installed automatically on first run.

## Directory layout

| Path | Purpose | Git |
|------|---------|-----|
| `data/raw/` | Downloaded source files (GeoJSON, CSV, etc.) | Ignored |
| `data/intermediate/` | Cleaned GeoParquet ready for PostGIS load | Ignored |
| `data/qa/` | QA reports (JSON) per dataset | Ignored |
| `scripts/` | One ingestion script per dataset | Tracked |
| `yourwalk_pipeline/` | Shared download, QA, and path helpers | Tracked |

## Ingestion scripts

### Footpaths (T1EAM) — segment network ✅

Primary scoring unit (ADR-008). ~27,458 segments.

```bash
python scripts/ingest_footpaths_t1eam.py
python scripts/ingest_footpaths_t1eam.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Casey Open Data — Footpaths (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/) |
| **API export** | `https://data.casey.vic.gov.au/api/explore/v2.1/catalog/datasets/footpaths_ply_t1eam/exports/geojson` |
| **Raw file** | `data/raw/footpaths_ply_t1eam.geojson` |
| **Output** | `data/intermediate/footpaths_ply_t1eam.parquet` |
| **QA report** | `data/qa/footpaths_ply_t1eam_width_qa.json` |
| **Key fields** | `segment_id` (gisfid), `surface_material` (pathsfmat), `width_m`, `length_m`, `function_use`, `ownership`, geometry |
| **QA** | Width outlier flags: `ok`, `missing`, `zero`, `too_narrow` (<0.5 m), `too_wide` (>6.0 m). Outliers retained with flag for reduced-confidence scoring. |

### AusNet / United Energy street lights ✅

Primary Night Index lighting source. ~42,258 point assets (no lux data).

```bash
python scripts/ingest_streetlights.py
python scripts/ingest_streetlights.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Casey Open Data — AusNet / United Energy Street Lights](https://data.casey.vic.gov.au/explore/dataset/ausnet_unitedenergy_mvp4_streetlights) |
| **API export** | `https://data.casey.vic.gov.au/api/explore/v2.1/catalog/datasets/ausnet_unitedenergy_mvp4_streetlights/exports/geojson` |
| **Raw file** | `data/raw/ausnet_unitedenergy_mvp4_streetlights.geojson` |
| **Output** | `data/intermediate/ausnet_unitedenergy_mvp4_streetlights.parquet` |
| **QA report** | `data/qa/ausnet_unitedenergy_mvp4_streetlights_qa.json` |
| **Key fields** | `light_id`, `globe_type`, `wattage_w`, `provider`, `suburb`, `street_name`, `source_extracted_date`, geometry (Point) |
| **QA** | Wattage flags: `ok`, `missing_wattage`, `zero_wattage`, `high_wattage` (>400 W). Duplicate `light_id` flagged. Proxies only — no lux in source. |

### Speed Zones (Transport Victoria) ✅

Road speed exposure for shared Accessibility stream (v1.1). Clipped to City of Casey from Victoria-wide monthly extract.

**Prerequisite:** run `ingest_footpaths_t1eam.py` first (Casey clip envelope).

```bash
python scripts/ingest_speed_zones.py
python scripts/ingest_speed_zones.py --force-download
python scripts/ingest_speed_zones.py --vintage 2026-02
```

| Item | Detail |
|------|--------|
| **Source** | [DataVic — Speed Zones](https://discover.data.vic.gov.au/dataset/speed-zones) / [Transport Victoria open data](https://opendata.transport.vic.gov.au/dataset/speed-zones) |
| **Default vintage** | April 2026 (`--vintage 2026-04`); February 2026 also available (`2026-02`) |
| **Raw file** | `data/raw/speed_zones_victoria_{vintage}.geojson` (~500–670 MB Victoria-wide) |
| **Output** | `data/intermediate/speed_zones_casey_{vintage}.parquet` |
| **QA report** | `data/qa/speed_zones_casey_{vintage}_qa.json` |
| **Key fields** | `zone_id`, `speed_limit_kmh`, `zone_length_m`, `zone_conditions`, `travel_direction`, `road_name`, `lga`, geometry (LineString/MultiLineString) |
| **Casey clip** | Footpaths envelope + ~400 m buffer; `Casey (C)` LGA tag or null LGA (non-Casey LGA tags excluded) |
| **QA** | Speed limit flags: `ok`, `missing_limit`, `below_range` (<10 km/h), `above_range` (>110 km/h). Zone length `missing_length` / `invalid_length`. DTP documents lowest 24h limit per segment. |

### Graffiti Locations ✅

Environmental order / maintenance proxy for shared Accessibility stream (v1.1). Not crime data — use density and recency when scoring.

```bash
python scripts/ingest_graffiti.py
python scripts/ingest_graffiti.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Casey Open Data — Graffiti Locations](https://data.casey.vic.gov.au/explore/dataset/graffiti-locations) |
| **API export** | `https://data.casey.vic.gov.au/api/explore/v2.1/catalog/datasets/graffiti-locations/exports/geojson` |
| **Raw file** | `data/raw/graffiti-locations.geojson` |
| **Output** | `data/intermediate/graffiti-locations.parquet` |
| **QA report** | `data/qa/graffiti-locations_qa.json` |
| **Key fields** | `record_id`, `graffiti_type` (Offensive / Non-Offensive), `created_date`, `completed_date`, `days_to_remove`, `area_removed_m2`, `suburb`, `ward`, geometry (Point) |
| **QA** | Type, date, and area flags. `high_area` (>500 m²), `completed_before_created`, `unknown_type`. Portal field `response_times` holds graffiti type. |

### Casey Council Trees (T1EAM) ✅

Council-owned tree inventory (~203k assets). **Enriching** Day Index input — proximity, maturity, street vs reserve. **Not** primary canopy (use Vicmap Tree Density).

```bash
python scripts/ingest_council_trees.py
python scripts/ingest_council_trees.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Casey Open Data — Council Trees (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/council_trees_pt_t1eam/) |
| **Raw file** | `data/raw/council_trees_pt_t1eam.geojson` |
| **Output** | `data/intermediate/council_trees_pt_t1eam.parquet` |
| **QA report** | `data/qa/council_trees_pt_t1eam_qa.json` |
| **Key fields** | `asset_number`, `tree_type`, `tree_age`, `tree_height_m`, `suburb`, `ward`, geometry (Point) |
| **QA** | `canopy_width_unpopulated` expected for most records; height and age flags. |
| **Canopy scoring** | Use [`Vicmap Tree Density`](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon) (planned) — Dense/Medium/Sparse polygons, 2019/2020 |

### Vicmap Tree Density — Casey clip ✅

Primary canopy/shade layer for Day Index Heat & Shade (40%). Dense / Medium / Sparse forest polygons via DEECA WFS.

```bash
python scripts/ingest_vicmap_tree_density.py
python scripts/ingest_vicmap_tree_density.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [DataVic — Vicmap Vegetation Tree Density](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon) |
| **Access** | WFS `open-data-platform:tree_density` on opendata.maps.vic.gov.au |
| **Raw file** | `data/raw/vicmap_tree_density_casey.geojson` |
| **Output** | `data/intermediate/vicmap_tree_density_casey.parquet` |
| **QA report** | `data/qa/vicmap_tree_density_casey_qa.json` |
| **Requires** | Footpaths raw (Casey envelope clip) |
| **Key fields** | `tree_density` (dense/medium/sparse), `area_m2`, source dates, geometry (EPSG:4326) |
| **Vintage** | Source imagery 2019-12-17 → 2020-04-28 |

### Metro Melbourne Urban Heat 2018 — Casey clip ✅

Primary heat exposure layer for Day Index Heat & Shade (40%). Mesh-block UHI (°C above baseline).

```bash
python scripts/ingest_metro_urban_heat_2018.py
python scripts/ingest_metro_urban_heat_2018.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [DataVic — Urban Heat Islands and Urban Vegetation 2018](https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018) |
| **Access** | ArcGIS REST `Radius/Vegetation_and_heat_mapping/MapServer/6` |
| **Raw file** | `data/raw/metro_urban_heat_2018_casey.geojson` |
| **Output** | `data/intermediate/metro_urban_heat_2018_casey.parquet` |
| **QA report** | `data/qa/metro_urban_heat_2018_casey_qa.json` |
| **Requires** | Footpaths raw (Casey envelope clip) |
| **Key field** | `uhi18_m` — lower is cooler (better for walking) |
| **Vintage** | 2018 Landsat-8; document limitation in UI |

### Victoria Road Crash Data — Casey pedestrian ✅

Night Index crash history (methodology v1.1 §6.3). Pedestrian-involved crashes in City of Casey with day/night light tags. Segment density scoring is deferred.

```bash
python scripts/ingest_vic_crashes.py
python scripts/ingest_vic_crashes.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Transport Victoria — Victoria Road Crash Data](https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data) |
| **CSV URL** | `victorian_road_crash_data.csv` (statewide; filtered in pipeline) |
| **Raw file** | `data/raw/victorian_road_crash_data.csv` (~70 MB) |
| **Output** | `data/intermediate/vic_crashes_casey_pedestrian.parquet` |
| **QA report** | `data/qa/vic_crashes_casey_pedestrian_qa.json` |
| **Filter** | `LGA_NAME = CASEY`, `PEDESTRIAN > 0` |
| **Key fields** | `crash_id`, `crash_date`, `crash_time`, `light_condition`, `light_category`, `night_index_eligible`, `injury_severity`, `road_name`, geometry (Point) |
| **Light categories** | `daylight`, `dawn_dusk`, `dark_lighted`, `dark_not_lighted`, `other`, `missing` |
| **Night Index** | `night_index_eligible = true` when `light_category` is `dark_lighted` or `dark_not_lighted` |
| **Reference** | CrashDash field mapping: `crashdash/etl/vic/VIC_FIELD_MAPPING_VERIFICATION.md` |

### Drinking Fountains (T1EAM) ✅

Day Index comfort input — heat/shade stream amenity proximity.

```bash
python scripts/ingest_drinking_fountains.py
python scripts/ingest_drinking_fountains.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Drinking Fountains (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/drinkingfountains_pt_t1eam/) |
| **Output** | `data/intermediate/drinkingfountains_pt_t1eam.parquet` |
| **Records** | 199 |
| **Key fields** | `fountain_type`, `material`, `condition`, `suburb`, `ward`, geometry (Point) |

### Benches and Seats (T1EAM) ✅

Day Index comfort input — score on **presence/location only** (quantity/capacity unreliable).

```bash
python scripts/ingest_benches_seats.py
python scripts/ingest_benches_seats.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Benches and Seats (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/benches_seats_pt_t1eam/) |
| **Output** | `data/intermediate/benches_seats_pt_t1eam.parquet` |
| **Records** | 3,411 |
| **QA** | ~64% have `quantity=0`; `capacity` mostly `TBD` — documented, not used in scoring |

### Casey Asset Lights — parks/reserves (T1EAM) ✅

Night Index lighting enrichment for off-road paths and reserves.

```bash
python scripts/ingest_park_lights.py
python scripts/ingest_park_lights.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [Park/Reserve Lights (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/parkreserve_light_pt_t1eam/) |
| **Output** | `data/intermediate/parkreserve_light_pt_t1eam.parquet` |
| **Records** | 3,162 |
| **Combine with** | `ausnet_unitedenergy_mvp4_streetlights` for full lighting picture |

### School Crossings (T1EAM) ✅

Accessibility enrichment — school crossings only (not general crossings).

```bash
python scripts/ingest_school_crossings.py
python scripts/ingest_school_crossings.py --force-download
```

| Item | Detail |
|------|--------|
| **Source** | [School Crossings (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/school_crossings_pt_t1eam/) |
| **Output** | `data/intermediate/school_crossings_pt_t1eam.parquet` |
| **Records** | 142 |

### Planned (not yet implemented)

| Dataset | Source | Stream | Priority |
|---------|--------|--------|----------|
| Public toilets, Dog bags (T1EAM) | Casey Open Data | Dashboard overlays | Low |
| Vicmap Elevation | DataVic | Accessibility gradient | 🔍 discovery |

## Pending Council data

General pedestrian crossings and kerb ramp presence are **not** on the Casey open data portal. Draft request: [`docs/comms/casey-council-data-request-crossings-kerb-ramps.md`](../docs/comms/casey-council-data-request-crossings-kerb-ramps.md) (not yet sent).

Until received, score accessibility on available footpath attributes with **reduced confidence** — do not impute missing crossing or ramp data as zero.

## Pipeline flow

```
Casey Open Data + DataVic + Transport Victoria
        ↓
   scripts/ingest_*.py  (download → DuckDB → QA)
        ↓
   data/intermediate/*.parquet  (GeoParquet)
        ↓
   scripts/build_viewer_layers.py  (optional local QA map)
        ↓
   [future] PostGIS / Supabase load + scoring
        ↓
   Resident app + Council dashboard (Q3 2026)
```

## Local QA map viewer

Inspect ingested layers on a Leaflet map centred on the Casey pilot area — **not** the production app.

```bash
cd pipeline
source .venv/bin/activate

# Build lightweight GeoJSON from intermediate Parquet (first time, or after re-ingest)
python scripts/build_viewer_layers.py

# Serve at http://127.0.0.1:8765/viewer/index.html
python scripts/serve_viewer.py --open

# Rebuild GeoJSON then serve
python scripts/serve_viewer.py --rebuild --open
```

| Item | Detail |
|------|--------|
| **UI** | `viewer/index.html` |
| **Export script** | `scripts/build_viewer_layers.py` → `data/viewer/*.geojson` |
| **Council trees** | Random sample of 8,000 points for browser performance |
| **Speed zones** | Casey clip only (`speed_zones_casey_2026-02.parquet`) |
| **Git** | `data/viewer/` is gitignored — generated locally from your Parquet files |

Toggle layers in the sidebar to check alignment (footpaths vs heat/canopy vs lights/points) before Wave 5 harmonisation.

See also: [`docs/meeting-prep/nikki-29-may-pipeline.html`](../docs/meeting-prep/nikki-29-may-pipeline.html)
