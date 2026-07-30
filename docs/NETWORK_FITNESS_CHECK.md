# Casey walking-network fitness check

**Status:** Active stress test (20 Jul 2026)  
**Why:** Make routing choices defensible before we lean harder into hybrid / score-aware.  
**Related:** [`SCORE_AWARE_ROUTING_BAKEOFF.md`](SCORE_AWARE_ROUTING_BAKEOFF.md) · [`BAKEOFF_RESULTS_2026-07-17.md`](BAKEOFF_RESULTS_2026-07-17.md) · ADR-001

## Plain-language purpose

We need a clear answer to:

> For City of Casey pilot walking routes, is an OSM-style walk network (Mapbox + our OSM graph) good enough to **draw** paths, while Casey T1EAM footpaths **score** them  -  or are the gaps large enough that we must treat Council footpaths as the routing network next?

This check does **not** change the scoring methodology. It stress-tests the **geometry we route on**.

## Three networks (do not conflate)

| Network | Source | Job today |
|---------|--------|-----------|
| **A. Mapbox walk** | Mapbox Directions (`walking`) ≈ processed OSM | Draws resident trip geometries |
| **B. OSM foot extract** | Overpass Casey ways (bake-off graph) | Draws score-aware challenger geometries |
| **C. T1EAM footpaths** | Casey Council polygons (~27k scored segments) | **Scores** corridors (Day/Night/Accessibility) |

Mapbox and OSM are cousins (both OSM-family). T1EAM is Council’s asset layer. Fitness = how well A/B align with C, and with each other, on real Casey trips.

## What Mapbox optimises vs what we add

| Mapbox walking typically cares about | Casey scoring fills |
|--------------------------------------|---------------------|
| Connected pedestrian-usable links | Local footpath quality (width, surface, continuity, …) |
| Short / efficient walks | Day: heat & shade mix |
| Optional walkway bias | Night: lighting / after-dark mix |
| Global graph processing (opaque) | Preference-relevant streams locked in v1.1 |

Mapbox: *“Can you walk there efficiently?”*  
YourWalk scores: *“What are walking conditions like on Casey’s network?”*

## Method

### Inputs

- Bake-off OD sample: [`fixtures/bakeoff_od_sample.json`](fixtures/bakeoff_od_sample.json)
- Latest Mapbox + challenger geometries: `pipeline/data/bakeoff/results/bakeoff_*_day.geojson`
- OSM ways: `pipeline/data/bakeoff/casey_osm_footways.geojson`
- T1EAM scores: `pipeline/data/bakeoff/casey_scores_lean.geojson` (or `segment_scores.parquet`)

### Script

```bash
cd pipeline && source .venv/bin/activate
python bakeoff/network_fitness.py
```

Writes:

- `pipeline/data/bakeoff/results/network_fitness_YYYYMMDD.csv` (per OD metrics)
- `docs/NETWORK_FITNESS_RESULTS.md` (summary table + verdict draft)

### Per-OD metrics

| ID | Metric | Pass heuristic |
|----|--------|----------------|
| M1 | **T1EAM coverage of Mapbox best**  -  share of Mapbox length within 20 m of a scored T1EAM polygon | ≥ 0.70 “ok”, ≥ 0.85 “strong” |
| M2 | **T1EAM coverage of score-aware**  -  same for challenger | same |
| M3 | **OSM coverage of Mapbox**  -  share of Mapbox length within 12 m of an OSM way | ≥ 0.85 (else Mapbox using links our OSM extract lacks) |
| M4 | **Length ratio**  -  OSM graph-shortest / Mapbox shortest | 0.85-1.20 “aligned”; \>1.25 “OSM gap / longer network” (see OD-05) |
| M5 | **Corridor mean Day**  -  Mapbox vs challenger (from bake-off) | Context only; not a fitness pass/fail |

### LGA / extract metrics

| ID | Metric | Intent |
|----|--------|--------|
| G1 | Share of T1EAM segment length within 15 m of any OSM way | “Can OSM see Council footpaths?” |
| G2 | Share of OSM footway/path/pedestrian length within 15 m of any T1EAM polygon | “Is OSM inventing walks Council doesn’t asset?” |

### Qualitative checklist (human, `/lab`)

For each OD (especially OD-01 park, OD-05 Hampton Park, OD-09 RBG):

- [ ] Does Mapbox use a reserve/park path?
- [ ] Is that path visible in OSM (violet score-aware can follow it)?
- [ ] Is there a T1EAM polygon under that path?
- [ ] Any obvious missing crossing / fence / arterial barrier?

Record notes in the results doc.

## Decision criteria (defensible outcomes)

| Finding pattern | Implication |
|-----------------|-------------|
| M1 strong, M3 strong, M4 aligned on most ODs | **OSM/Mapbox fit for pilot routing**; keep T1EAM as scoring; proceed to hybrid UI |
| M1 weak on many ODs | Scoring coverage problem (join/buffer or Mapbox off network) - fix scoring corridor before hybrid claims |
| M3 weak or M4 much greater than 1.25 on important ODs | **OSM extract / topology gap** - do not over-claim score-aware until fixed or documented |
| G1 low especially in reserves/schools | Council paths missing from OSM - known risk; document; consider T1EAM graph later |
| G2 high with low G1 | Many Council segments sit off OSM foot links - scoring coverage can drop on some corridors |

**Pilot-defensible bar:** Most residential ODs M1 ≥ 0.70 and M3 ≥ 0.85; flag and explain any OD that fails (do not hide). Hybrid shipping is OK if failures are **documented edge cases**, not silent.

## Out of scope

- Replacing Mapbox in production this sprint  
- Full T1EAM centreline router (follow-on if fitness fails)  
- Changing Day/Night weights  
- Outing mode

## Communication lines

- *“We route on an OSM-family walk network (Mapbox). We score with Casey’s footpath layer.”*  
- *“This check measures whether that split is honest for Casey  -  where the networks agree, and where they don’t.”*  
- *“Gaps become confidence notes or backlog (Council graph), not hidden assumptions.”*
