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

### Planned (not yet implemented)

| Dataset | Source | Stream | Priority |
|---------|--------|--------|----------|
| AusNet / United Energy Street Lights | Casey Open Data | Night Index | High |
| Speed Zones | DataVic / Transport Victoria | Accessibility (shared) | High |
| Graffiti Locations | Casey Open Data | Accessibility (shared) | High |
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
