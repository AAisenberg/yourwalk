# Score-aware routing bake-off (L2c)

**Status:** Brief locked - ready to implement 
**Date:** 17 Jul 2026 
**Backlog:** [`BACKLOG.md`](BACKLOG.md) L2c · ADR: [`DECISIONS.md`](DECISIONS.md) ADR-001 
**Fixture:** [`fixtures/bakeoff_od_sample.json`](fixtures/bakeoff_od_sample.json)

## Purpose

Decide whether YourWalk’s **north star** - pathfinding that uses Casey Day / Night / Accessibility scores as edge costs - is worth adopting over (or hybridising with) the current **Mapbox post-hoc** trip mode.

This is an evidence exercise, not a rewrite of the resident app. Mapbox trip mode stays the shipping control until this bake-off says otherwise.

## Locked defaults (17 Jul 2026)

| Choice | Decision |
|--------|----------|
| Control | Current resident trip mode: Mapbox Directions → post-hoc Casey scores → rank by prefs + time/distance |
| Challenger | **GraphHopper** walking / custom model on **OSM footways**, costs enriched with Casey segment scores |
| Graph base (v1) | OSM foot network + Casey score join (proximity / buffer) |
| Graph base (later check) | T1EAM-native edges if OSM join looks wrong on Casey reserves / paths |
| Scope | Same fixed OD sample; same Day/Night mode; same preference defaults for fair compare |
| Delivery | Offline / script or `/lab` bake-off panel - not required on `/` for first pass |

### Why GraphHopper + OSM first

- GraphHopper custom models let us turn “prefer better Day Index” into edge weights without inventing a full router.
- OSM already has a connected walking graph (footways, paths through reserves, crossings). T1EAM polygons are the **scoring** network, not a ready routing graph (centerline experiments already failed once).
- Fastest path to “does score-aware pathfinding find better corridors Mapbox misses?”

## What this means for methodology

**Unchanged (methodology gate still holds):**

- Day Index = Accessibility 60% + Heat/Shade 40%
- Night Index = Accessibility 60% + Lighting/After Dark 40%
- Segment scores stay on Footpaths T1EAM (~27k). Higher score = better walking conditions.
- Overlays stay overlays. Missing Council data is never imputed as zero.
- Resident language: walking conditions / confidence - not safety guarantees.

**What changes in the bake-off only:**

| Layer | Mapbox post-hoc (control) | GraphHopper + OSM (challenger) |
|-------|---------------------------|--------------------------------|
| Who proposes the path | Mapbox (distance / walk network heuristics) | GraphHopper (cost = time/distance ± Casey score) |
| What gets scored | Casey T1EAM scores aggregated along the chosen geometry | Same aggregation on the challenger geometry |
| Role of scores | Rank / label candidates after the fact | Steer pathfinding **during** search |
| Network geometry | Mapbox walk graph | OSM footways / paths |

So: **methodology defines the scores; routing decides whether those scores choose the path or only rank Mapbox’s paths.** The bake-off tests the second question. It does not invent a third index.

**Join caveat (document in results):** OSM edges are not T1EAM segments. We transfer scores by spatial join (e.g. buffer / nearest T1EAM polygon within ~20 m, length-weighted). Where OSM walks through a reserve with no T1EAM polygon, confidence drops - same transparency rule as today. If join quality is poor, that is a finding (favour T1EAM-native graph next), not a silent fix.

## Success criteria

We are confident enough to reopen ADR-001 when we can answer:

1. On the OD sample, does score-aware routing **systematically** find higher Day/Night/Accessibility corridors that Mapbox never proposes?
2. What is the typical **time / distance detour** for those gains (acceptable vs silly)?
3. Is OSM↔Casey join **good enough** for pilot, or do we need T1EAM edges before shipping score-aware?
4. Recommendation: **stay post-hoc** · **hybrid** (Mapbox candidates + score-aware alternative) · **switch** challenger into trip mode.

## Comparison metrics (per OD)

Record for control and challenger (and for each alternative if >1):

| Metric | Notes |
|--------|-------|
| Geometry | GeoJSON LineString |
| Distance (m) / duration (s) | From router |
| Detour vs shortest | Challenger length / control shortest |
| `day_index` / `night_index` / `accessibility` | Length-weighted along corridor (reuse `scoreRouteAgainstSegments`) |
| Display /10 | Same as resident cards |
| Coverage ratio + confidence | Reduced if join thin |
| Missed corridor? | Qualitative: Y/N + note (e.g. “Promenade Reserve”) |
| Pref blend rank | Optional: same prefs as resident defaults |

Aggregate: win rate on score, median detour %, count of “missed corridor = Y”, join failure rate.

## OD sample (n = 12)

Coords are WGS84 `[lng, lat]`. **OD-01**, **OD-11**, and **OD-12** are verified from live resident QA. Others are approximate Casey anchors - snap/confirm in Mapbox or field before formal results.

| ID | From | To | Why |
|----|------|-----|-----|
| **OD-01** | 1 Carranya Court, Narre Warren South | 88 Robinswood Parade, Narre Warren South | **Verified QA.** Mapbox already offers Promenade Reserve (~12 min / 1.1 km, ~8.0/10) vs a street option (+1 min). Good control where post-hoc looks strong - check whether score-aware agrees or finds a third path. |
| OD-02 | Hillsmeade Primary School area | Fountain Gate / Narre Warren activity centre | School → shops; arterial vs local paths |
| OD-03 | Narre Warren station precinct | Fountain Gate | Station → mall; lighting/night relevant |
| OD-04 | Berwick station precinct | Berwick Village / High Street | Activity centre walk |
| OD-05 | Hampton Park residential | Hampton Park shops | Mid-suburb local trip |
| OD-06 | Endeavour Hills residential | Endeavour Hills shops | Similar local trip, different suburb |
| OD-07 | Clyde North residential | Casey Central / Cranbourne East shops | Growth-area network / heat |
| OD-08 | Cranbourne residential | Cranbourne Park / town centre | Longer local trip |
| OD-09 | Near RBG Cranbourne entry | Cranbourne town centre | Park/edge network join stress test |
| OD-10 | Berwick residential (north of Princes Hwy) | Berwick station | Highway barrier / crossing quality |
| **OD-11** | 7 Fairmead Place, Narre Warren South | 8 Hopwood Court, Narre Warren South | **Verified QA 30 Jul 2026.** Mapbox road loop via Raleigh; Streets basemap shows cul-de-sac cut-throughs. T1EAM has scored segments on the mid-block strip Mapbox skipped (Casey can score the gap). |
| **OD-12** | 66 Cupples Crescent, Berwick | 2 Ashfield Drive, Berwick | **Verified QA 30 Jul 2026.** Two Mapbox options both on roads; park paths unused. Candidate-diversity + score-aware stress test. |

Machine-readable copy: [`fixtures/bakeoff_od_sample.json`](fixtures/bakeoff_od_sample.json) (also served at `/bakeoff/od_sample.json` for the lab OD jumper).

Add ODs if a resident or Nikki flags a “Mapbox missed the good path” story - those are gold for the bake-off.

### T1EAM probe notes (OD-11 / OD-12, 30 Jul 2026)

| OD | Finding |
|----|---------|
| OD-11 | Mid-block east–west strip (cut-through zone): **9** scored segments, ~659 m, mean Acc ~83. North strip (Raleigh road loop): 17 segments. **Casey network covers the walkthroughs Mapbox did not propose.** Gap is routing geometry, not missing Council scores. |
| OD-12 | Mid-corridor has many scored T1EAM segments. Gap is Mapbox proposing only road-centreline alternatives, not whether Casey can score a park/path corridor if one is drawn. |

Raw probe: `pipeline/data/qa/od11_od12_t1eam_probe.json` (gitignored under `pipeline/data/`).

## Implementation plan (thin vertical)

1. **Brief + OD fixture** - this doc (done).
2. **Export Casey scores for join** - `pipeline/bakeoff/export_scores.py`.
3. **Casey OSM extract + score join** - `pipeline/bakeoff/fetch_and_join_osm.py` (Overpass).
4. **Score-aware graph** - `pipeline/bakeoff/build_graph.py` (NetworkX Dijkstra). Cost model matches the GraphHopper custom-model sketch; Docker GraphHopper scaffold under `pipeline/bakeoff/docker-compose.yml` for later swap.
5. **Harness** - `pipeline/bakeoff/run_bakeoff.py` → Mapbox control + OSM/Casey challenger → corridor scores → `pipeline/data/bakeoff/results/`.
6. **Review** - table + map overlays in `/lab` or QGIS; write recommendation into ADR-001.

Runbook: [`pipeline/bakeoff/README.md`](../pipeline/bakeoff/README.md).

### Suggested cost sketch (challenger)

Not final - tune after first OD-01 run:

- Base: GraphHopper foot / hiking profile time.
- Multiplier: map Casey score (0-1 or display/10) so **higher score → lower cost** (e.g. cost × `(a + b * (1 - score_norm))` with soft bounds so we never forbid a path).
- Cap detour implicitly via cost weights; still record 1.3×-style ratios vs shortest for comparison with trip-mode policy.
- Night mode: use `night_index_score` in the cost; Day mode: `day_index_score`. Optional later: preference blend inside cost (after pure Day/Night bake-off).

## Out of scope for first pass

- Replacing `/` trip mode in production
- Outing / loop mode (L2b)
- Council dashboard
- Weighted-cost inside Mapbox (not available the way we need)
- Perfect T1EAM centerlines (follow-up if OSM join fails)

## Decision log (fill after results)

| Date | Finding | ADR-001 lean |
|------|---------|--------------|
| 17 Jul 2026 | OD-01 smoke: harness live. Mapbox 1044 m day≈5.65; score-aware 1017 m day≈5.73. | pending |
| 17 Jul 2026 | Full LGA v1: Day C5/M4/T1; Night C2/M5/T3. Night underperformed because scores are high+compressed and absolute costs flattened. | hybrid lean |
| 17 Jul 2026 | v2 percentile costs + 1.15× cap. Night C7/M3; Day C5/M5. Day≠Night puzzle explained. Lab compare at `/lab`. See [`BAKEOFF_RESULTS_2026-07-17.md`](BAKEOFF_RESULTS_2026-07-17.md). | **hybrid lean** (keep Mapbox ship; score-aware alternative) |
| 30 Jul 2026 | OD-11 Fairmead→Hopwood: Mapbox ~486 m road loop; challenger ~282 m cut-through; T1EAM scores mid-strip. Hybrid shipped in resident `/` via `serve_challenger.py`. See [`HYBRID_ROUTING_AUDIT_2026-07-30.md`](HYBRID_ROUTING_AUDIT_2026-07-30.md). | **hybrid shipping** (ADR-001 updated) |

---

**Owner:** CrowdLab eng · **Methodology contact:** Nikki / XYX as needed for join interpretation · **Pilot LGA:** City of Casey only
