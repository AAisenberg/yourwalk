# Nikki sign-off decisions — v1.1

**Meeting:** Nicole Kalms (XYX Lab) · 3 July 2026  
**Status:** Methodology v1.1 **Accepted** (locked 15 Jul 2026 for Phase C app build)  
**Specs:** [`SCORING_SPEC_v1.1.md`](../SCORING_SPEC_v1.1.md) (v1.1.2), [`VULNERABILITY_INDEX.md`](../VULNERABILITY_INDEX.md) v1.1  

**Phase C unlocked:** PostGIS load + Next.js / Mapbox — see [`DELIVERY_PLAN.md`](../DELIVERY_PLAN.md) Sprint A.

---

## Locked at sign-off

| Topic | Decision |
|-------|----------|
| Day/Night 60/40 index model | Accepted |
| Harmonisation join rules (25 m corridor speed/crash/graffiti; 30 m lights) | Accepted |
| Missing crossings / kerb ramps / gradient | Gap + reduced confidence; no imputation |
| School crossings | +5 points on Accessibility; static; no school-hours logic |
| Day pedestrian crashes in Accessibility | **Not included** — night crashes stay in Night Index only; all crashes as dashboard overlay |
| Traffic signal phasing (OpSheets) | **Deferred v1.2+** — see [`TRAFFIC_SIGNAL_PHASING.md`](../TRAFFIC_SIGNAL_PHASING.md) |
| 2018 heat vintage | Accepted with documented limitation |
| Minor rubric tweaks | v1.1.x patch only, not methodology reopen |

---

## Amendments (v1.1.2)

### Moderate surface bucket → 50

**Nikki feedback:** Brick paving and other moderate materials should score **50**, not 65. Crushed rock and timber share the same moderate bucket.

**Rationale:** Co-design flagged brick as ambiguous — heritage streetscape value vs uneven joints and trip hazard. Without segment-level condition data, moderate is a neutral midpoint on the 0–100 scale, not a partial penalty.

**Implementation:**

- [`pipeline/yourwalk_pipeline/scoring.py`](../pipeline/yourwalk_pipeline/scoring.py) — `SURFACE_MODERATE` includes Brick Paving; score **50**
- [`SCORING_SPEC_v1.1.md`](../SCORING_SPEC_v1.1.md) §4.4 — version **1.1.2**
- Re-run `score_segments.py` when refreshing production scores

**Surface buckets after v1.1.2:**

| Bucket | Score | Materials |
|--------|-------|-----------|
| Smooth / firm | 90 | Concrete, asphalt, spray seal, etc. |
| Moderate | **50** | **Brick paving**, crushed rock classes, timber |
| Rough / loose | 35 | Gravel, rubber, not applicable |
| Unknown / unmapped | 50 | TBD, NULL |

---

## Deferred to v1.2+

| Item | Doc |
|------|-----|
| Gradient / steepness | [`GRADIENT_DISCOVERY.md`](../GRADIENT_DISCOVERY.md) |
| Traffic signal phasing / ped walk times | [`TRAFFIC_SIGNAL_PHASING.md`](../TRAFFIC_SIGNAL_PHASING.md) |
| General crossings + kerb ramps | Council request pending |
| Victorian Traffic Signals overlay | Ingest before OpSheet parse |

---

## After sign-off

1. Re-run `python scripts/score_segments.py` (moderate-surface segments will shift)
2. PostGIS load of `segment_scores.parquet`
3. `reflect to Notion` when ready
