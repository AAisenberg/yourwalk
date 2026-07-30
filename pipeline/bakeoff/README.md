# L2c score-aware routing bake-off

See [`docs/SCORE_AWARE_ROUTING_BAKEOFF.md`](../../docs/SCORE_AWARE_ROUTING_BAKEOFF.md).

**Control:** Mapbox Directions (same lean as resident `/`)  
**Challenger v1:** OSM foot network + Casey T1EAM score join + Dijkstra with Day/Night edge costs  
(GraphHopper Docker scaffold included; same cost model — swap when weights stabilize.)

## Quick start

```bash
cd pipeline
source .venv/bin/activate
pip install -e ".[bakeoff]"

# 1. Export lean scores from segment_scores.parquet
python bakeoff/export_scores.py

# 2. Fetch Casey OSM footways (Overpass) and join scores
#    Smoke test (OD-01 Promenade Reserve bbox):
python bakeoff/fetch_and_join_osm.py --od01-bbox
#    Full LGA (slower; may need Overpass retries):
# python bakeoff/fetch_and_join_osm.py

# 3. Build score-aware graph
python bakeoff/build_graph.py

# 4. Run bake-off (needs Mapbox token from web/.env.local)
python bakeoff/run_bakeoff.py --od OD-01
# Full sample (incl. OD-11 Fairmead cut-through):
# python bakeoff/run_bakeoff.py --mode day && python bakeoff/run_bakeoff.py --mode night
# python bakeoff/export_lab_compare.py
```

Outputs: `data/bakeoff/results/bakeoff_YYYYMMDD_HHMM.csv` + route GeoJSON.

### Hybrid trip mode (resident + lab)

Serve the score-aware graph for the Next.js app (required for cul-de-sac cut-throughs Mapbox misses):

```bash
python bakeoff/serve_challenger.py --port 8790
```

Web proxies via `POST /api/challenger-route` (`CHALLENGER_URL`, default `http://127.0.0.1:8790`). Without this service, `/` and `/lab` fall back to Mapbox-only.

### Network fitness check

```bash
python bakeoff/network_fitness.py
```

Method: [`docs/NETWORK_FITNESS_CHECK.md`](../../docs/NETWORK_FITNESS_CHECK.md)  
Results: [`docs/NETWORK_FITNESS_RESULTS.md`](../../docs/NETWORK_FITNESS_RESULTS.md)

### Results (17 Jul 2026)

Full write-up: [`docs/BAKEOFF_RESULTS_2026-07-17.md`](../../docs/BAKEOFF_RESULTS_2026-07-17.md)

- Day: challenger **5** / mapbox **4** / tie **1**
- Night: challenger **2** / mapbox **5** / tie **3**
- Interim lean: **hybrid** (Mapbox ships; score-aware as alternative)

```bash
python bakeoff/summarise_results.py day
python bakeoff/summarise_results.py night
python bakeoff/hybrid_od_audit.py   # Mapbox vs challenger + Casey-only share
python bakeoff/export_lab_compare.py
```

Audit write-up: [`docs/HYBRID_ROUTING_AUDIT_2026-07-30.md`](../../docs/HYBRID_ROUTING_AUDIT_2026-07-30.md)

## Optional GraphHopper

```bash
cd bakeoff
docker compose up -d
# then: python run_bakeoff.py --od OD-01 --challenger graphhopper
```

Requires tagged OSM PBF from `fetch_and_join_osm.py --write-osm-xml` and import into the GH volume (see `docker-compose.yml`).
