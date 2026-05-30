# YourWalk Pipeline

Phase B data pipeline for the City of Casey pilot. Stack: **DuckDB → GeoParquet → PostGIS/Supabase**.

Methodology gate: [`docs/VULNERABILITY_INDEX.md`](../docs/VULNERABILITY_INDEX.md) v1.1  
Dataset inventory: [`docs/DATA_SET_REGISTER.md`](../docs/DATA_SET_REGISTER.md)

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

### Planned (not yet implemented)

| Dataset | Source | Stream | Priority |
|---------|--------|--------|----------|
| Casey Asset Lights (parks/reserves) | Casey Open Data | Night Index enrichment | Medium |
| Vicmap Tree Urban | DataVic REST | Day Index (Heat & Shade) | High |
| Metro Melbourne Urban Heat 2018 | DataVic | Day Index (Heat & Shade) | High |
| Victoria Road Crash Data | Transport Victoria | Night Index | Medium |
| Drinking Fountains, Benches (T1EAM) | Casey Open Data | Day Index | Medium |
| School Crossings (T1EAM) | Casey Open Data | Accessibility enrichment | Medium |
| Public toilets, Dog bags (T1EAM) | Casey Open Data | Dashboard overlays | Low |

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
   [future] PostGIS / Supabase load + scoring
        ↓
   Resident app + Council dashboard (Q3 2026)
```

See also: [`docs/meeting-prep/nikki-29-may-pipeline.html`](../docs/meeting-prep/nikki-29-may-pipeline.html)
