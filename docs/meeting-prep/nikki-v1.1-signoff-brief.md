# YourWalk — v1.1 methodology sign-off brief

**Meeting:** Nikki Hedge · Friday July 2026  
**Purpose:** Sign off scoring methodology v1.1 (harmonisation + rubrics). Unlocks PostGIS load and Q3 app build.  
**HTML (print):** [`nikki-v1.1-signoff-brief.html`](nikki-v1.1-signoff-brief.html)  
**Demo:** [`casey-scoring-map.html`](casey-scoring-map.html)

---

## What we are signing off

| In scope | Out of scope today |
|----------|-------------------|
| Day/Night Index weights and sub-scores | Next.js app, routing, submissions |
| Spatial join rules (harmonisation) | Council dashboard build |
| Scoring rubrics and gap handling | PostGIS load (after sign-off) |

---

## Index model

- **Day Index** = Footpath Accessibility **60%** + Heat & Shade **40%**
- **Night Index** = Footpath Accessibility **60%** + Lighting / After Dark **40%**
- **Unit:** T1EAM footpath segment (~27,458). Higher score = better conditions.

**Flow:** Datasets → ingest/QA → GeoParquet → harmonise → score → PostGIS → app

---

## How the maths works (plain language)

### Two layers of “percent” — do not mix them up

**Layer 1 — the final index**

Accessibility is **60%** of both Day Index and Night Index. The other stream (heat/shade or lighting) is **40%**.

**Layer 2 — inside Accessibility**

Each segment first gets one **Accessibility score from 0 to 100**. Width, surface, speed, and graffiti each get their own 0–100 sub-score, then blend into that single number.

### Why 30 + 25 + 25 + 15 = 95%?

Those numbers are **relative weights**, not a mistake. The pipeline **renormalises** them so they always sum to 100% of the base Accessibility score (divides by 0.95 when all four are present).

| Component | Nominal weight | Effective share of Accessibility base |
|-----------|----------------|--------------------------------------|
| Width | 30% | ≈ 31.6% |
| Surface | 25% | ≈ 26.3% |
| Speed exposure | 25% | ≈ 26.3% |
| Graffiti | 15% | ≈ 15.8% |

If speed data is missing (~18% of segments), speed drops out and the other three re-scale automatically.

### School crossing “+5” = five points, not 5%

- **Not** 5% of the index  
- **Not** a fifth weighted component  
- **+5 points** on the 0–100 Accessibility scale, added **after** the weighted blend  
- Only when a school crossing is within **20 m**  
- No crossing nearby → **+0** (no penalty)

On the final Day or Night Index, +5 Accessibility points ≈ **+3 index points** (because Accessibility is 60% of the index).

**Visual flow:** see [`nikki-v1.1-signoff-brief.html`](nikki-v1.1-signoff-brief.html) — section *How the maths works* (pipeline steps A + scoring fork B).

**Worked example**

- Width 70, surface 90, speed 85, graffiti 100 → Accessibility base ≈ **83**
- School crossing nearby → **88** (+5 pts). No school crossing → stays **83**
- If Heat & Shade = 75: Day Index ≈ 0.60 × 88 + 0.40 × 75 = **83** (shown as **8.3/10** in the app)

---

## Harmonisation → scoring

| Dataset | Join rule | Score | Weight |
|---------|-----------|-------|--------|
| Footpaths | Master segment | Width bands (footpath vs shared use) | 30% of Accessibility base |
| Footpaths | Master segment | Surface: smooth 90 / **moderate 50** (brick paving, crushed rock, timber) / rough 35 / unknown 50 | 25% of Accessibility base |

**Surface buckets (v1.1.2):** Smooth 90 · **Moderate 50** (brick paving, crushed rock, timber) · Rough 35 · Unknown 50 — Nikki 3 Jul 2026. See [`NIKKI_SIGNOFF_DECISIONS.md`](NIKKI_SIGNOFF_DECISIONS.md).
| Speed zones | **25 m corridor** around path; max parallel road speed | Speed exposure 0–100 | 25% of Accessibility base |
| Graffiti | **25 m** buffer; density + recency | Maintenance proxy 0–100 | 15% of Accessibility base |
| School crossings | Nearest ≤ **20 m** | **+5 points** (after blend) | not a weight |
| Urban heat 2018 | Area-weighted mesh blocks | Percentile rank | 45% of Heat & Shade |
| Tree density | Area-weighted canopy class | Dense/medium/sparse blend | 40% of Heat & Shade |
| Fountains + benches | Nearest / 50 m count | Comfort presence | 15% of Heat & Shade |
| Street + park lights | Nearest; count in **30 m**; no lux | Proximity tiers 0–100 | 70% of Night stream |
| Night crashes | **25 m**, 5 yr, night-eligible; per km | Percentile rank | 30% of Night stream |

Heat & Shade = **40% of Day Index only**. Night stream = **40% of Night Index only**. The same Accessibility score feeds both indexes.

---

## Deferred from v1.1 (documented gaps)

- General crossings, kerb ramps — reduced confidence; Council request pending
- Gradient — [`../GRADIENT_DISCOVERY.md`](../GRADIENT_DISCOVERY.md)
- Traffic signal phasing — [`../TRAFFIC_SIGNAL_PHASING.md`](../TRAFFIC_SIGNAL_PHASING.md)
- School crossing hours — not in data; static +5 pt bonus only
- YourGround, toilets, dog bags — overlays only

---

## Sign-off checklist

- [ ] Day/Night 60/40 model accepted
- [ ] Accessibility weight maths understood (95% renormalised; school crossing +5 **points**)
- [ ] Join rules (25 m corridor speed/crash/graffiti; 30 m lights) confirmed
- [ ] Gaps = reduced confidence, not zero imputation
- [ ] Moderate surface = **50** (brick paving, crushed rock, timber) — Nikki 3 Jul 2026
- [ ] Sign-off log: [`NIKKI_SIGNOFF_DECISIONS.md`](NIKKI_SIGNOFF_DECISIONS.md)
- [ ] 2018 heat vintage acceptable for pilot
- [ ] v1.1 locked; tweaks → v1.1.x patch only

**Sign-off:** Name _________________ Date _________ Notes _________________
