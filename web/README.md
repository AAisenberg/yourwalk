# YourWalk web (Phase C)

Next.js App Router + Mapbox GL JS + Supabase PostGIS.

## Setup

```bash
cd web
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_MAPBOX_TOKEN
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data dependency

1. **PostGIS** (routing / SQL later): `python scripts/load_segment_scores_postgis.py`
2. **Static GeoJSON** (map paint — required for fast loads):

```bash
cd ../pipeline
# pipeline/.env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
python scripts/upload_segment_scores_geojson.py
```

Set `NEXT_PUBLIC_SEGMENTS_GEOJSON_URL` in `.env.local` to the gzip public URL the script prints (or rely on the default `…/map-data/segment_scores.geojson.gz` path).

### Local fallback (no Supabase Storage)

If Storage is unavailable, symlink viewer GeoJSON into `web/public/map-data/` and use **same-origin** paths (any port — avoid hardcoding `localhost:3000`):

```bash
mkdir -p public/map-data
ln -sf ../../pipeline/data/viewer/segment_scores_map.geojson public/map-data/segment_scores.geojson
ln -sf ../../pipeline/data/viewer/casey_lga_boundary.geojson public/map-data/casey_lga_boundary.geojson
```

```env
NEXT_PUBLIC_SEGMENTS_GEOJSON_URL=/map-data/segment_scores.geojson
NEXT_PUBLIC_LGA_BOUNDARY_URL=/map-data/casey_lga_boundary.geojson
```

Preview/Production without Storage: `/api/map-data/segment_scores.geojson` (GitHub release proxy).

Restart `npm run dev` after changing `.env.local`.

### Hybrid routing (score-aware challenger)

Trip planning merges Mapbox walking candidates with an OSM+Casey score-aware path (ADR-001 hybrid). Start the local graph service:

```bash
cd ../pipeline && source .venv/bin/activate
python bakeoff/serve_challenger.py --port 8790
```

Optional in `.env.local`: `CHALLENGER_URL=http://127.0.0.1:8790`.

See [`pipeline/README.md`](../pipeline/README.md).
