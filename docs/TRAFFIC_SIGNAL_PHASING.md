# Traffic signal phasing — dataset assessment

**Version:** 1.0  
**Status:** Documented — **deferred from v1.1** scoring; v1.2+ crossing enrichment  
**Date:** 3 July 2026  
**Methodology gate:** [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
**Register:** [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md) §2.2  
**Companion dataset:** [Victorian Traffic Signals](https://discover.data.vic.gov.au/dataset/victorian-traffic-signals)

---

## 1. Question

Is [Traffic Signal Configuration Data Sheets](https://discover.data.vic.gov.au/dataset/traffic-signal-configuration-data-sheets) (OpSheets) useful for YourWalk crossing accessibility — specifically **enough time to cross** at signalised intersections?

---

## 2. Summary

| | Assessment |
|---|------------|
| **Useful?** | **Yes** — one of few open sources for pedestrian walk/clearance times at signals |
| **Possible?** | **Yes, but specialist** — ZIP OpSheets, parse, join via `SITE_NO`, manual QA |
| **v1.1 index?** | **No** — context / overlay / v1.2+ enrichment only |

**Nikki / methodology position (3 July 2026):** Document and defer. Do not add to Accessibility weights at v1.1 sign-off.

---

## 3. What the dataset contains

DTP site-level operation sheets (Victoria-wide), published as **redacted ZIP** resources by site-number range.

| Field | Relevance |
|-------|-----------|
| **Site Number** | Join key to `Victorian Traffic Signals.SITE_NO` |
| **Time Settings** | Phase and **pedestrian time settings (seconds)** |
| **Signal Groups** | Includes pedestrian groups |
| **Phasing** | Sequence text |
| **Operation Notes** | Site-specific behaviour |

Pedestrian timing typically includes **Walk**, **Clearance 1**, **Clearance 2** (see DTP OpSheet conventions; walking speed assumptions often ~1.2–1.5 m/s in engineering tools).

**Licence:** CC-BY 4.0  
**Vintage:** Resource metadata last updated **February 2022** — treat as configuration snapshot, not live SCATS runtime.

---

## 4. Casey coverage

From spatial review in [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md):

| Asset type | Approx. count in Casey LGA |
|------------|----------------------------|
| Intersections (`INT`) | ~156 |
| Pedestrian-operated (`POS`) | ~34 |
| Flashing pedestrian (`FLASH PX`) | ~13 |
| **Total signal assets** | **~203** |

OpSheets must be extracted from the ZIP range(s) covering those `SITE_NO` values (numbers span multiple bundles, e.g. 203–32079).

---

## 5. Limitations

1. **No geometry** — must join through Victorian Traffic Signals points, then to footpath segments (25–50 m).
2. **Parsing effort** — not a single CSV; OpSheet extract + pedestrian field QA per site.
3. **Approach ambiguity** — one intersection, multiple pedestrian crossings; footpath segment may not map cleanly to one ped phase.
4. **Adaptive SCATS** — configured times ≠ experienced wait; measured delay needs **IDM** data (DTP request), not in this open package.
5. **Partial crossing picture** — zebras, refuges, kerb ramps still missing; OpSheets only cover signalised sites.
6. **Overlap with speed exposure** — arterial intersections already scored via 25 m speed corridor.

---

## 6. Recommended pipeline (v1.2+)

| Step | Action |
|------|--------|
| 1 | Ingest **Victorian Traffic Signals** (CSV) — Casey clip; overlay on viewer |
| 2 | Harmonise: `traffic_signal_nearest_m`, `traffic_signal_type` on segments |
| 3 | Extract OpSheets for Casey `SITE_NO` only; parse ped walk + clearance |
| 4 | Benchmark vs crossing width / AS 1428–style walking speeds (1.2 m/s, 0.9 m/s slow) |
| 5 | **Dashboard / hotspot layer** — “tight ped clearance” flags; manual QA sample |
| 6 | Scoring use only after Nikki review of parse quality — not before |

**Do not** replace general crossing or kerb ramp Council request with OpSheets alone.

---

## 7. v1.1 position (locked at sign-off)

- Traffic signals + OpSheets → **Council dashboard context / future enrichment**
- **Not** in Accessibility, Day, or Night Index weights for pilot v1.1
- See [`pipeline/PROCEEDINGS.md`](../pipeline/PROCEEDINGS.md) meeting readiness checklist

---

## 8. Related documents

- [`GRADIENT_DISCOVERY.md`](GRADIENT_DISCOVERY.md) — another deferred v1.1 input
- [`CROSSING_KERB_HARMONISATION.md`](CROSSING_KERB_HARMONISATION.md) — crossing/kerb gap strategy
- [`SEGMENT_HARMONISATION.md`](SEGMENT_HARMONISATION.md) — §5.3 school crossings only in v1.1
