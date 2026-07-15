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

See [`pipeline/README.md`](../pipeline/README.md).
