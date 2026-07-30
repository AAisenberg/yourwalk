# Casey network fitness results

**Date:** 2026-07-20  
**Method:** [`NETWORK_FITNESS_CHECK.md`](NETWORK_FITNESS_CHECK.md)  
**Bake-off geometries:** `bakeoff_20260717_0650_day.geojson`  
**CSV:** `pipeline/data/bakeoff/results/network_fitness_20260720.csv` (gitignored)

## Verdict draft

**Provisional: OSM/Mapbox fit for pilot routing** with T1EAM as scoring.  
Document flagged ODs (station–mall, RBG edge); proceed toward hybrid with those as known confidence limits.

### Reading the split

| Signal | What it means |
|--------|----------------|
| M3 = 10/10 strong | Our OSM extract **sees** Mapbox walks - fair to compare Mapbox vs score-aware on the same OD set |
| M1 = 8/10 ok/strong | Most Mapbox trips sit on Council-scored footpaths - **scoring is meaningful** for typical residential trips |
| M4: none > 1.25× | No OD where OSM graph-shortest is wildly longer than Mapbox (OD-05 is 1.15× - mild, not a hard gap) |
| G1 ≈ 58% | Many T1EAM polygons are **not** near OSM footways LGA-wide - Council has assets OSM does not walk as foot links |
| G2 ≈ 90% | OSM footways/paths are usually near *some* T1EAM - OSM is not inventing a totally separate city |

**Defensible story:** For ordinary Casey residential A→B trips, routing on OSM/Mapbox and scoring with T1EAM is honest. Weak spots are **activity-centre / park-edge** corridors (OD-03, OD-09) where Mapbox walks links with thin T1EAM coverage - show reduced confidence, do not pretend full Casey scoring.

## Headline counts

- M1 T1EAM-on-Mapbox ok/strong: **8/10**
- M3 Mapbox-on-our-OSM ok/strong: **10/10**
- M4 OSM shortest >1.25× Mapbox: **0/10**
- G1 T1EAM features near OSM (sample): **~58%**
- G2 OSM foot length near T1EAM (sample): **~90%**

## Per-OD table

| OD | M1 T1EAM⊃Mapbox | M2 T1EAM⊃Challenger | M3 OSM⊃Mapbox | M4 OSM/Mapbox len | Flags |
|----|----------------:|--------------------:|--------------:|------------------:|:------|
| OD-01 | 1.0 (strong) | 1.0 (strong) | 1.0 (strong) | 0.908 | - |
| OD-02 | 0.762 (ok) | 0.781 (ok) | 1.0 (strong) | 0.959 | - |
| OD-03 | 0.421 (weak) | 0.398 (weak) | 1.0 (strong) | 0.949 | low_t1eam_on_mapbox |
| OD-04 | 0.827 (ok) | 0.719 (ok) | 1.0 (strong) | 0.924 | - |
| OD-05 | 0.869 (strong) | 0.957 (strong) | 1.0 (strong) | 1.146 | - |
| OD-06 | 0.94 (strong) | 0.933 (strong) | 1.0 (strong) | 0.91 | - |
| OD-07 | 0.931 (strong) | 0.907 (strong) | 1.0 (strong) | 0.979 | - |
| OD-08 | 0.953 (strong) | 0.863 (strong) | 1.0 (strong) | 0.943 | - |
| OD-09 | 0.538 (weak) | 0.384 (weak) | 1.0 (strong) | 0.811 | low_t1eam_on_mapbox;osm_much_shorter |
| OD-10 | 0.934 (strong) | 0.868 (strong) | 1.0 (strong) | 0.887 | - |

## Flagged ODs (priority for `/lab` qualitative review)

- **OD-03** (Narre Warren station → Fountain Gate): `low_t1eam_on_mapbox` - M1=0.421, M3=1.0, M4=0.949
- **OD-09** (RBG Cranbourne → Cranbourne town centre): `low_t1eam_on_mapbox;osm_much_shorter` - M1=0.538, M3=1.0, M4=0.811

## Qualitative checklist (fill in `/lab`)

| OD | Mapbox uses park/reserve? | OSM can follow it? | T1EAM under path? | Notes |
|----|---------------------------|--------------------|-------------------|-------|
| OD-01 | | | | Promenade Reserve QA |
| OD-05 | | | | Hampton Park length gap |
| OD-09 | | | | RBG edge / join stress |
| _add_ | | | | |

## How to read this for stakeholders

- **M1 strong** = Mapbox walks are sitting on Council-scored footpaths (scoring is meaningful).
- **M3 strong** = Our OSM extract sees what Mapbox walked (fair score-aware compare).
- **M4 ≫ 1.25** = Our OSM graph’s shortest walk is much longer than Mapbox - network gap, not just scoring.
- **G1/G2** = LGA-level agreement between Council assets and OSM foot links.

## Next after this doc

1. Complete qualitative rows in `/lab` for flagged ODs.
2. If verdict stays provisional-fit → hybrid Mapbox + score-aware alt.
3. If gaps dominate → scope T1EAM/Council routing graph (or OSM gap-fill) before north-star claims.
