# Preference-weighted pathfinding — north star spec

**Status:** Accepted lean — P1–P3 shipped 16 Aug 2026. P4 outing bias locked 16 Aug 2026. Hosted challenger: Fly.io (ADR-010).  
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

- Turning points are chosen on Casey footpaths using the same preference blend as A→B **before** the circuit is drawn, not only re-ranked after the fact.
- When the Casey graph can connect start → turn → turn → home, use those legs so the line matches A→B. If a leg is missing, Mapbox draws the same turning points.
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

**Soft biases (shipped 16 Aug 2026)**

- Prefer away from roads: **generation-time**. Default graph already applies 1.5–2× per-metre cost on road classes. When the toggle is on, Dijkstra uses a stronger off-road multiplier, the challenger detour cap rises to ~1.6×, and Mapbox's 1.3× gate matches. Ranking still adds the shared-use bonus. Must not override the carriageway product rule.
- Efficiency: keep soft detour cap vs graph-shortest (1.15× default; 1.6× when Prefer away from roads is on). Do not let shade chase unbounded detours.

### 4.3 Candidate set strategy (trip)

To make slider changes **visible** even when Mapbox returns one line:

1. Keep Mapbox path-safe pool (0–2 cards after gates).
2. Request **one preference-weighted challenger** with current slider blend (primary).
3. Request a second challenger at **complementary** weights (the other pathish corridor: invert the dominant stream, no prefix penalty) when geometrically distinct. Mid/mid treats shade / lighting as dominant. Not both sliders at the floor. Cap total cards at 3.
4. Rank with existing match logic so Recommended stays preference-true.

Minimum shippable: step 1 + 2. Step 3 is the trust amplifier for demos (“here is the shadier option vs the smoother option”).

### 4.4 Outing (P4 lock, 16 Aug 2026)

**Intent:** Around here uses the same Casey scores and slider blend as A→B, so Find again after a slider change can propose a different circuit.

**How a loop is made (server `/loop`, 16–17 Aug 2026)**

1. One call to the challenger `/loop` planner with start, minutes, mode and the same preference sliders as A→B.
2. The planner picks turning points on **through-junctions** (degree 2 or more, never dead-ends) in the duration ring, scored with the day/night blend (Accessibility + Heat & Shade by day; Accessibility + Lighting by night, Night Index fallback). One best turn per 30 degree sector keeps a spread of directions. Turning points must touch the path network (an adjacent footway/path edge, not just a road junction) where OSM coverage allows.
3. A calibration probe measures how much the network wanders versus crow-fly at this start, then re-anchors the via ring so first draws land near the asked duration.
4. Three legs (start → A, A → B, B → home) are routed with a **cumulative reuse penalty** (x4 on edges already walked) so the way home does not retrace the way out. The quality swing is tempered versus trips because circuits have a fixed time budget.
5. If a circuit misses the ±5 min band, the vias are resized from measured length (damped) and redrawn, up to five times with a ping-pong guard. Low-road circuits often need the extra steps to converge.
6. Every candidate pair is drawn and pooled, then the planner returns the circuits with the **least road-centreline walking** first (in-band, revisit ≤ 0.20, distinct). Circuits over 45% road share can only fill a two-card set, never the third card. Road share rides along in the response (`road_share`) and in the QA strategy suffix (`_rd28`).
7. The app applies the existing loop quality gates unchanged (±5 min, same-path revisit, reverse-overlap, spur demote) and demotes roadier circuits in pool quality. Hard carriageway gate stays **off** for loops.
8. Mapbox waypoint drawing (Casey-scored turning points, P4) is the fallback when `/loop` returns nothing or the challenger is down.
9. Rank with outing match (prefs dominate inside the band). Prefer 2 cards; a third only if quality holds. One honest circuit if the network cannot diversify.

**Sidewalk-aware graph (ADR-011, 17 Aug 2026):** road edges with a Casey T1EAM pavement polygon alongside are converted at build time to `sidewalk` edges — footway cost, drawn geometry offset 4.5 m to the pavement side (side voted per OSM way, so lines do not flip mid-block). Loop `road_share` now means the honest residual: walking on roads with **no** Council footpath. Hobart Ave 25 min went from 49–60% road to three circuits at 0%; A→B pathish share there went 0.39 → 1.0, so Casey trip cards pass the funnel gate again. Park paths in T1EAM but missing from OSM remain unroutable pending the OSM gap-fill licensing review.

**There and back:** Same turning-point bias (Loop first). Optional Casey graph on the outbound leg when cheap.

**Not in this slice**

- A second “opposite preference” loop search (P3 invert-stream is A→B only).
- Prefer away from roads as a third loop search (ranking bonus only).
- Turning the carriageway hard gate on for loops (emptied Montpelier / Berwick).

**Acceptance fixture:** Montpelier start `[145.3485, -38.0405]`, 30 min, Loop, day. Shade max vs footpaths max, Find again each time: Recommended geometry changes **or** the existing one-circuit note. Night: same with lighting (Night Index fallback if the lighting join is missing).

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

Hybrid on Vercel needs a hosted Casey graph. Ops: [`HOSTING_CHALLENGER.md`](HOSTING_CHALLENGER.md) (Fly.io, ADR-010).

| Environment | Requirement |
|-------------|-------------|
| Local demo / funnel | `python bakeoff/serve_challenger.py --port 8790` while Next runs |
| Preview / production | Fly `CHALLENGER_URL` + matching `CHALLENGER_SHARED_SECRET` on Vercel (Production and Preview) |

Do not send Nikki to production until `/api/challenger-route` returns `"ok": true` on the live host.

---

## 7. Phased delivery

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **P0 — Ops** | Challenger process + env docs; funnel smoke in CI-ish script | Local funnel `challenger health: OK`; prod plan documented |
| **P1 — Gate fix** | Challenger pathish classification so OD-11 can merge | ✅ Done 12 Aug 2026 — OSM pathish OR Streets; OD-11 + OD-12 dual cards; OD-CARRIAGE-01 unchanged |
| **P2 — Pref costs (trip)** | Join streams; `/route` accepts prefs; one blended challenger | ✅ Done 12 Aug 2026 — Acc + derived Heat & Shade on graph; `smoke-prefs-pathfinding.ts` distinct on OD-01 + OD-12 (OD-11 single corridor) |
| **P3 — Dual challenger (trip)** | Shade-max + footpaths-max variants when distinct; Prefer away from roads now requests an off-road-biased second challenger | ✅ Done 16 Aug 2026 — other pathish corridor (invert stream, no prefix penalty, 1.20×) plus away-from-roads variant (1.6×) |
| **P4 — Outing bias** | Turning points use blended Casey stream; Casey graph legs when they connect | Montpelier 30 min Loop: Find again after shade max changes circuit when the network allows |

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

### Outing — prefs change the circuit

- Given Montpelier `[145.3485, -38.0405]`, Around here, Loop, 30 min, day
- When the resident plans with Heat & Shade at max and Footpaths at floor, then Find
- And they invert those sliders and Find again
- Then Recommended geometry changes **or** the existing one-circuit honesty note is shown
- And loop quality gates still apply (±5 min, revisit, no carriageway hard gate)
- And overlays stay out of the index

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

1. **Hosted challenger:** **Decided 16 Aug 2026:** Fly.io always-on Sydney (ADR-010).
2. **Dual challenger cost:** Always two Dijkstra calls vs only when Mapbox pool size is 1? **Decided 16 Aug 2026:** always request the other pathish corridor; omit if not distinct. Cap 3 with optional away.
3. **Heat & Shade on graph:** Persist `heat_shade_score` in parquet join vs derive at build time from Day/Acc?
4. **Thumb vs Find:** Keep Find-to-search (recommended for P2) or debounced re-plan on results?
5. **Outing Casey-graph legs:** **Decided 16 Aug 2026:** try Casey legs for shortlisted turning-point pairs; Mapbox fallback. Full Casey-only circuits stay deferred.

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
| 17 Aug 2026 | Sidewalk drawing fix (ADR-011 amendment): side votes now in way draw order (NetworkX edge orientation is arbitrary — old votes cancelled and offsets sawtoothed), roundabout rings < 150 m never convert (529 → 3), interior pavement gaps fill (no mid-block doglegs), offset joints weld at the midpoint in `path_to_route`, and loop leg joints collapse out-and-back spurs (Denmark Hill Rd). Spikes per Hobart loop 39/45/31 → 0-2; road share and pathish unchanged. Resident underlay re-exported; line width now zoom-scaled so the footpath network reads at street zooms. |
| 17 Aug 2026 | Sidewalk-aware graph ships (ADR-011): 95,797 road edges with T1EAM pavement alongside become `sidewalk` edges (footway cost, 4.5 m draw offset, way-level side vote). Hobart 25 min loops 49–60% road → all 0% footpath-less road; Montpelier night 29–40% → 0–9%; Hobart A→B pathish 0.39 → 1.0 (Casey cards return). Resident underlay switches to welded centrelines (`casey_paths_underlay.geojson`) — no more pavement-polygon shards. |
| 17 Aug 2026 | Road-aware loop selection (mid-road lines fix): `/loop` draws every candidate pair (up to 5 damped resizes with a ping-pong guard), pools survivors and returns lowest road-centreline share first; >45% road only fills a two-card set. Vias must touch the path network. Montpelier night 30 min drops 58/64/65% road to 29/34/40%. Durable fix (T1EAM sidewalk edges in graph) stays on backlog. |
| 16 Aug 2026 | Server `/loop` planner ships (backtracking fix): through-junction vias, cross-leg reuse penalty x4, calibration probe + damped resize. One HTTP call returns up to three distinct in-band circuits; client gates unchanged; Mapbox is fallback only. Montpelier revisit 0.15–0.21 down to 0.00–0.09; smoke battery 4 starts x 15/30 min all pass. |
| 16 Aug 2026 | P4 lock: turning points scored with the trip blend; top quartile in the duration ring; Casey graph legs when they connect; Mapbox fallback. Montpelier 30 min Loop is the exit fixture. Prefer away stays ranking-only on loops. |
| 16 Aug 2026 | P3: other pathish corridor (no prefix penalty, 1.20×) + optional away-from-roads. Dual Casey battery 5/13 ODs. Recap: [`ROUTING_NOTE_NIKKI_2026-08-16.md`](ROUTING_NOTE_NIKKI_2026-08-16.md). |
| 16 Aug 2026 | Prefer away from roads is generation-time (1.6× detour, trail-vs-sidewalk costs). Road-class 1.5–2× cost and OSM crossing-node edges shipped with it. |
| 12 Aug 2026 | Spec opened from XYX feedback + trip funnel (challenger down vs up). |
