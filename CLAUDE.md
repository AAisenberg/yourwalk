# YourWalk — Agent Guide

City of Casey Connecting Grant pilot. CrowdLab delivery with Monash XYX Lab methodology input.

**Repo:** https://github.com/AAisenberg/yourwalk  
**Pilot LGA:** City of Casey only  
**Current phase:** Phase B — data pipeline (June 2026). No Next.js app yet.

## Source of truth

Documentation and methodology live in this repo. Notion tracks status summaries only — link to repo paths, do not duplicate full methodology into Notion.

| Doc | Purpose |
|-----|---------|
| `docs/VULNERABILITY_INDEX.md` | **Methodology gate v1.1** — read before any scoring or ingestion |
| `docs/DATA_SET_REGISTER.md` | Dataset inventory and layer classification |
| `docs/DECISIONS.md` | ADRs — ADR-008 (segments), ADR-009 (day/night) |
| `docs/DELIVERY_PLAN.md` | Sprint plan |
| `docs/PHASES.md` | MVP / Beta / v1 scope |
| `pipeline/README.md` | What is downloaded, where it lives, how to run ingestion |

## Methodology v1.1 (locked — do not revert)

- **Day Index** = Footpath Accessibility 60% + Heat & Shade 40%
- **Night Index** = Footpath Accessibility 60% + Lighting / After Dark 40%
- **Accessibility (shared 60%):** surface, width, continuity, gradient, crossings, speed zones, graffiti proxy
- **Day only (40%):** heat, canopy, drinking fountains, benches/seats
- **Night only (40%):** street lighting, night pedestrian crashes
- **Overlays only (not in index):** public toilets, dog bag dispensers, YourGround perception, SEIFA
- **Segment network:** Footpaths (T1EAM) ~27k segments — primary scoring unit per ADR-008
- **Pending Council data:** general pedestrian crossings, kerb ramps — score with reduced confidence until received; do not impute as zero

## Tech stack

| Layer | Choice |
|-------|--------|
| Data processing | DuckDB → GeoParquet → PostGIS / Supabase |
| App (later, Q3) | Next.js App Router, TypeScript strict, Tailwind + shadcn/ui |
| Maps | Mapbox GL JS (ADR-002 accepted) |
| Database | Supabase / PostGIS |
| Hosting | Vercel |

## Pipeline layout

```
pipeline/
  README.md              # Runbook + dataset inventory
  pyproject.toml         # Python deps (duckdb, httpx, pyarrow)
  scripts/               # One script per dataset ingestion
  yourwalk_pipeline/     # Shared download, QA, export helpers
  data/
    raw/                 # Downloaded source files (gitignored)
    intermediate/        # GeoParquet outputs (gitignored)
    qa/                  # QA reports (gitignored)
```

**Run ingestion** (from repo root):

```bash
cd pipeline
python -m venv .venv && source .venv/bin/activate
pip install -e .
python scripts/ingest_footpaths_t1eam.py
```

## Conventions

- Australian English in docs and comments
- No em dashes in documentation
- Minimise scope — pipeline work only until Phase B complete
- Record architecture decisions in `docs/DECISIONS.md`
- Do not invent requirements — use Open Questions in REQS docs
- Higher score = better walking conditions (lower vulnerability)
- Transparency: provenance, confidence, and data vintage must be traceable

## What not to build yet

- Next.js app, Supabase migrations, routing UI
- Scoring algorithm (after base datasets ingested and QA'd)
- OSM gap-fill until licensing review complete

## Open ADRs (block Q3 app build)

ADR-001 routing, ADR-003 versioning, ADR-004 privacy, ADR-005 confidence, ADR-006 moderation, ADR-007 transparency
