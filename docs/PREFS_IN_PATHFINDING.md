# Preference-weighted pathfinding — north star spec

**Status:** Proposed — implement after challenger ops are reliable  
**Date:** 12 August 2026  
**Product:** YourWalk · City of Casey pilot  
**Related:** [`DECISIONS.md`](DECISIONS.md) ADR-001 · [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md) · [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md) §13 · `web/src/lib/routing/tripFunnel.ts`

This document locks the **fork decision** XYX Lab feedback implies: importance sliders should change **which walks are proposed**, not only which card is Recommended among a fixed Mapbox set.

It does **not** reopen Day/Night Index maths (Accessibility 60% + Heat & Shade / Lighting 40%). Segment scores stay Casey T1EAM. Preferences weight **pathfinding cost** and **ranking**.

---

## 1. Problem (evidence in hand)

### Stakeholder expectation (XYX / demo trust)

> As I change what matters (shade, footpaths, lighting), I should see **different route options**, and the Recommended walk should look obviously better on that dimension.

### Shipping behaviour today (post-hoc hybrid)

```
Mapbox candidates (+ optional Day/Night challenger)
        → carriageway / detour filters
        → fixed card set (often 1)
        → preference sliders only re-rank / re-score match
```

Segment pills do not change with prefs (correct). Match does. **Geometry usually does not.**

### Funnel evidence — 12 Aug 2026

Challenger **down** (local + production 503): 6/7 demo ODs → **1 final card**.

Challenger **up** on localhost (`serve_challenger.py` :8790):

| OD | Mapbox raw | Challenger | Final cards |
|----|------------|------------|-------------|
| OD-01 | 1 | not distinct | 1 |
| OD-03 | 1 | not distinct | 1 |
| OD-08 | 1 | failed carriageway gate | 1 |
| OD-11 Fairmead→Hopwood | 1 (on-road last-resort) | failed carriageway gate | **1** |
| OD-12 | 1 | **kept** | **2** |
| OD-CARRIAGE-01 | 2 | not distinct | 2 |
| Montpelier sample | 1 | failed carriageway gate | 1 |

**Read:** Turning the challenger on is necessary but **not sufficient** for demo trust. It adds a second geometry when distinct and path-safe (OD-12). It does **not** yet respond to Heat & Shade vs Footpaths importance, and several key ODs (including OD-11) still collapse to one card because the challenger fails the Streets carriageway gate.

Replay: `cd web && npx tsx scripts/smoke-trip-funnel.ts` (challenger must be on `:8790`).

---

## 2. Decision (recommended fork)

| Option | Verdict |
|--------|---------|
| A. Stay post-hoc + better copy | Reject as sole path to Casey/XYX trust — explainers help, they do not show a shadier line |
| B. Prefs-in-pathfinding (hybrid+) | **Accept as north star** — generate preference-aware challenger (and outing) geometries; keep Mapbox as candidate source + geocode |
| C. Full Casey-only router now | Defer — T1EAM-native edges remain a later track (ADR-001 open question) |

**Decision:** Pursue **B**. ADR-001 already names this as product north star (“Preference-weighted score-aware pathfinding”). This spec turns that sentence into an implementation contract.

---

## 3. Target resident behaviour

### A→B (trip)

Given two or more path-safe candidates can exist for an OD:

- When the resident sets **Heat & Shade** high and **Accessible footpaths** lower, Then at least one proposed geometry (usually the score-aware card) should favour higher Heat & Shade corridor score vs a footpaths-max variant, within soft detour bounds.
- When they flip importance the other way, Then the score-aware geometry (or Recommended among challenger variants) should move toward higher Footpaths.
- When Night mode + **Lighting after dark** high, Then pathfinding uses lighting / Night stream costs, not Day Heat & Shade.

Pills remain length-weighted Casey streams on whatever line is drawn. Match still blends prefs + soft efficiency for Recommended among the final set.

### Around here (outing)

Given Loop / There and back within the ±5 min band:

- Via / turn selection (or challenger legs between vias) should bias toward high-importance streams **before** Mapbox draws the waypoint walk — not only re-rank after the fact.
- Moving shade from low → high and **Edit walk → Find again** should be able to produce a **different circuit** when the local network allows, not only a different match number on the same loop.

### Honesty when the network cannot diversify

If only one path-safe geometry exists after gates, keep one card and say so (existing rerank note). Do not invent fake alts or impute missing scores as zero.

---

## 4. Cost model (streams, not composite only)

Today the graph stores `cost_day` / `cost_night` from Day/Night **Index** only (`build_graph.py`). Edges lack explicit Accessibility / Heat & Shade / Lighting attributes for Dijkstra.

### 4.1 Graph join (prerequisite)

On each OSM walkable edge, join length-weighted Casey streams (same join spirit as today):

| Attribute | Use |
|-----------|-----|
| `accessibility_score` | Footpaths importance |
| `heat_shade_score` (or derive from Day − 0.6×Acc / 0.4) | Day Heat & Shade importance |
| `lighting_after_dark_score` (or Night lighting stream) | Night Lighting importance |
| Keep `day_index_score` / `night_index_score` | Fallback / lab compare |

Never impute missing stream as zero; missing → neutral length cost (distance-only multiplier) with coverage tracked.

### 4.2 Preference blend at request time

Resident importance (floored 10–100, same as `preferences.ts`):

**Day**

```
w_acc, w_shade = effective prefs
stream = (w_acc * accessibility + w_shade * heat_shade) / (w_acc + w_shade)
cost = length_m * f(stream)   # same percentile swing family as edge_cost today
```

**Night**

```
w_acc, w_light = effective prefs
stream = (w_acc * accessibility + w_light * lighting) / (w_acc + w_light)
cost = length_m * f(stream)
```

**Soft biases (optional v1)**

- Prefer away from roads: mild multiplier from OSM highway class / shared-use — ranking bonus today; may also nudge cost. Must not override carriageway product rule.
- Efficiency: keep soft detour cap vs graph-shortest (today ~1.15×). Do not let shade chase unbounded detours.

### 4.3 Candidate set strategy (trip)

To make slider changes **visible** even when Mapbox returns one line:

1. Keep Mapbox path-safe pool (0–2 cards after gates).
2. Request **one preference-weighted challenger** with current slider blend (primary).
3. Optionally request a second challenger at **complementary** weights (e.g. shade-max vs footpaths-max) when geometrically distinct — cap total cards at 3.
4. Rank with existing match logic so Recommended stays preference-true.

Minimum shippable: step 1 + 2. Step 3 is the trust amplifier for demos (“here is the shadier option vs the smoother option”).

### 4.4 Outing

1. Score candidate via points / segments with the same blended stream.
2. Prefer vias in the top quartile of that blend within the duration annulus.
3. Draw Mapbox waypoint geometry; apply loop quality gates (±5 min, revisit).
4. Rank with outing match (prefs dominate inside the band).

---

## 5. Carriageway gate (blocking for OD-11)

Product rule stands: **no mid-carriageway walk lines**.

Funnel shows preference-aware search will still fail demos if the challenger is dropped by Streets tilequery on `service` / `cycleway` cut-throughs (OD-11 pattern).

**Required companion work (same epic, not optional):**

- Classify challenger edges using **OSM highway class on the graph** (or a pathish allow-list) before or instead of Streets tilequery for challenger-only merges; or
- Relax tilequery for challenger when OSM class is pathish and Casey coverage is present; keep Streets gate for Mapbox candidates.

Acceptance: OD-11 returns a distinct off-road (or pathish) challenger card when the graph finds the cut-through, without reintroducing Epsom→Arubi centreline options.

Regression: OD-CARRIAGE-01 still shows no mid-carriageway Mapbox alt.

---

## 6. Ops prerequisite

Hybrid is dead in production today (`CHALLENGER_URL` → nothing).

| Environment | Requirement |
|-------------|-------------|
| Local demo / funnel | `python bakeoff/serve_challenger.py --port 8790` while Next runs |
| Preview / production | Hosted challenger URL in `CHALLENGER_URL`, or document Mapbox-only degraded mode in the tester brief |

Do not promise prefs-in-pathfinding on Vercel until the challenger is reachable from that deployment.

---

## 7. Phased delivery

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **P0 — Ops** | Challenger process + env docs; funnel smoke in CI-ish script | Local funnel `challenger health: OK`; prod plan documented |
| **P1 — Gate fix** | Challenger pathish classification so OD-11 can merge | OD-11 final ≥2 when graph path exists; OD-CARRIAGE-01 unchanged |
| **P2 — Pref costs (trip)** | Join streams; `/route` accepts prefs; one blended challenger | Same OD, shade-high vs footpaths-high → distinct challenger geometries **or** documented network-impossibility |
| **P3 — Dual challenger (trip)** | Shade-max + footpaths-max variants when distinct | Demo script: slider flip changes Recommended **line**, not only match |
| **P4 — Outing bias** | Via selection uses blended stream | Montpelier-class loop: Find again after shade max changes circuit when network allows |

UI copy (Slice 1/2) stays complementary: “Edit walk and search again” remains true because pathfinding runs at Find time, not on every thumb move (unless we later add debounced live re-plan — out of scope for P2).

---

## 8. Acceptance criteria (Given / When / Then)

### Trip — prefs change geometry

- Given OD-12 (or a listed fixture OD with known dual corridors)
- When the resident plans A→B with Heat & Shade at max and Footpaths at floor, then Find
- Then the score-aware geometry’s Heat & Shade pill is ≥ the footpaths-max variant’s Heat & Shade pill (or a single challenger beats Mapbox on shade)
- When they invert prefs and Find again
- Then Recommended geometry changes **or** an explicit “only one path-safe walk” note is shown

### Trip — OD-11 hybrid credibility

- Given challenger service up and P1 gate fix
- When planning Fairmead → Hopwood
- Then at least one card uses the neighbourhood cut-through (not only the Raleigh road loop)
- And no card is a mid-carriageway centreline

### Methodology guardrails

- Given any preference blend
- When corridors are scored
- Then pills remain Casey stream aggregates; overlays (toilets, dog bags, etc.) stay out of the index
- And missing crossings / kerb ramps still reduce confidence, never imputed as zero

---

## 9. Explicit non-goals (this epic)

- Turn-by-turn navigation / Open in Maps (separate slice)
- Transit stops / baby-change toilets as routing costs
- Replacing Mapbox geocoding or basemap
- Changing v1.1 Day/Night 60/40 index definition
- Live re-route on every slider tick without Find (optional later)

---

## 10. Open questions

1. **Hosted challenger:** Fly.io / Railway / always-on VM vs “local only for lab, Mapbox-only prod” for Casey staff test?
2. **Dual challenger cost:** Always two Dijkstra calls vs only when Mapbox pool size is 1?
3. **Heat & Shade on graph:** Persist `heat_shade_score` in parquet join vs derive at build time from Day/Acc?
4. **Thumb vs Find:** Keep Find-to-search (recommended for P2) or debounced re-plan on results?

---

## 11. Recommendation (landing)

1. **Treat prefs-in-pathfinding as the committed north star** for pre-Casey trust — not optional polish.
2. **Sequence:** P0 ops (done locally when challenger is running) → **P1 gate fix for OD-11** → **P2 preference costs** → P3 dual variant if demos still feel flat → P4 outing.
3. Pause further preference **UI** work until P1–P2 are scoped into the backlog; Slice 1 explainers remain valid scaffolding.
4. Update ADR-001 open question “Preference weights inside edge costs” to **Accepted lean — see this spec** when P2 starts.

---

## Changelog

| Date | Note |
|------|------|
| 12 Aug 2026 | Spec opened from XYX feedback + trip funnel (challenger down vs up). |
