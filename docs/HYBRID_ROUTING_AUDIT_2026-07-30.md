# Hybrid routing audit — 2026-07-30

Focused check after OD-11 Fairmead → Hopwood (Mapbox road loop vs Google/Casey cut-through).

## Verdict

**Ship hybrid trip mode.** Mapbox alone fails when neighbourhood links are tagged `cycleway`/`service` (or missing as `footway`) but Casey T1EAM scores them. Score-aware OSM+Casey Dijkstra already finds the efficient walk on OD-11 (~282 m vs ~486 m).

True **Casey-only** gaps (T1EAM with no nearby OSM walkable way) need a later T1EAM-native edge track — do not block hybrid on a full LGA freeze.

## OD sample (day)

| OD | Mapbox m | Challenger m | Ratio | Flags |
|----|----------|--------------|-------|-------|
| OD-01 | 1044.4 | 1040.4 | 0.996 | — |
| OD-02 | 5767.1 | 6253.8 | 1.084 | — |
| OD-03 | 1697.0 | 1692.3 | 0.997 | — |
| OD-04 | 1507.5 | 1412.9 | 0.937 | — |
| OD-05 | 984.7 | 1230.8 | 1.25 | challenger_longer |
| OD-06 | 856.2 | 829.0 | 0.968 | — |
| OD-07 | 3428.1 | 3383.4 | 0.987 | — |
| OD-08 | 1888.7 | 1934.8 | 1.024 | — |
| OD-09 | 6625.5 | 5373.3 | 0.811 | challenger_much_shorter |
| OD-10 | 2221.0 | 2174.1 | 0.979 | — |
| OD-11 | 486.2 | 282.5 | 0.581 | challenger_much_shorter, mapbox_missed_cutthrough_verified |
| OD-12 | 1796.0 | 1751.0 | 0.975 | — |

## Casey-only share (straight OD corridor)

Share of T1EAM segments in the OD corridor whose centroid has no OSM way within 20 m.

| OD | T1EAM n | No-OSM n | Share |
|----|---------|----------|-------|
| OD-01 | 26 | 2 | 0.077 |
| OD-02 | 25 | 1 | 0.04 |
| OD-03 | 13 | 0 | 0.0 |
| OD-04 | 15 | 0 | 0.0 |
| OD-05 | 24 | 1 | 0.042 |
| OD-06 | 21 | 0 | 0.0 |
| OD-07 | 71 | 3 | 0.042 |
| OD-08 | 36 | 0 | 0.0 |
| OD-09 | 34 | 0 | 0.0 |
| OD-10 | 45 | 0 | 0.0 |
| OD-11 | 9 | 0 | 0.0 |
| OD-12 | 46 | 7 | 0.152 |

## OD-11 detail

- Mapbox: ~486 m via Raleigh Drive (road loop).
- Challenger: ~282 m via mid-block cycleway/service; Night display ~8.3.
- T1EAM mid-strip: 9 scored segments (~659 m, mean Acc ~83).
- Live Overpass: 0 `footway`/`path` in mid-strip — basemap draws paths; routing graph under-represents them as dedicated footways.

## Next

1. Keep hybrid in resident `/` (challenger service + Mapbox).
2. Preference-weighted edge costs later.
3. T1EAM-native edges only where `casey_only_share` stays high on important ODs.

Machine copy: `pipeline/data/qa/hybrid_od_audit_2026-07-30.json` (under gitignored `pipeline/data/`).
