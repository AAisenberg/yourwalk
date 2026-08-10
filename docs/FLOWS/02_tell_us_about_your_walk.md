# Flow: Tell us about your walk

## Purpose

Residents start with **intent** (when they walk, what matters, trip vs local outing), then see ranked walks with optional **along-the-way** amenity context. Puts the person first; routing engines stay underneath.

## Primary user

Casey residents planning a walk — commute, errands, recreation, or “just get outside for a bit.”

## Preconditions

- Hybrid trip mode available (Mapbox + score-aware challenger)
- Casey pilot boundary enforced for start / end
- Amenity layers available where ingested (toilets, dog bags, benches, fountains)
- No account required

## Out of scope (this flow)

- User accounts, login, cloud-saved walks or profiles
- Council dashboard
- Observations / audit submissions (separate flow)
- Brand / colour system overhaul (after flow sticks)

Anonymous **device-local** helpers (e.g. last start point) are allowed if clearly not an account.

---

## Mental model (three questions)

| Step | Label | Resident meaning |
|------|-------|------------------|
| 1 | **When** | Day or Night — which index and which importance sliders |
| 2 | **Type of walk** | Pattern: **A to B** vs **Around here** (timed outing) |
| 3 | **Along the way** | Contextual amenities on the map — not part of the Day/Night index maths |

“What matters most” (importance of accessible footpaths / shade / after dark) sits under step 1. Section labels do not use question marks.

---

## Step-by-step flow

### 0. Open YourWalk (`/`)

- Map shows Casey; short welcome line: **Tell us about your walk**
- No choropleth required on resident map (lab keeps scored network)
- Disclaimer remains: not a safety guarantee

### 1. When are you walking?

- Toggle: **Day walk** / **Night walk** (existing)
- Importance sliders for the active mode (existing; dynamic efficiency)
- Optional soft prompt: “Heading out after dark? Try Night walk” when local evening (non-blocking)

### 2. Type of walk

Two clear choices (segmented control):

#### 2A — A to B (trip)

- **From** and **To**: search, map pin, or **Use my location** (geolocate → reverse geocode)
- Both ends must be inside Casey
- **Find my route** → hybrid ranked options (current behaviour)
- Match score + pills + confidence (current)

#### 2B — Around here (outing)

**Default product meaning:** a **circuit** of about N minutes that returns near the start — not “how far can I get in N minutes.”

- **Start**: my location / search / pin (Casey)
- **About how long?**: e.g. ~15 / ~25 / ~40 minutes = **total** walk time for the outing
- **Shape** (segmented, under Around here — not a buried checkbox):
  - **Loop** (default) — a **circuit**: leave and return near start on a *different* path (not the same street reverse / opposite kerb). Generator uses two vias + reverse-overlap filter; if true circuits are scarce, may fall back to same-path home with an honest card note
  - **There and back** — out along a good corridor, **same way home** (explicit choice, also engineering fallback)
  - **One way** — not shown in resident beta UI (planner retained for Lab/QA only)
- **Find my walk** → 1–3 geometries near that duration, scored and ranked with importance + efficiency
- Cards: same Recommended / Neighbourhood links language; outing copy should say “about N min loop” when Loop is selected

**Amenities on an outing** (see §3): checking fountains / benches / toilets / dog bags both **shows** them on the map and, for Around here, **soft-biases** candidate circuits toward passing near at least one of the checked types when data exists. Missing amenities never score as zero; if none are reachable in time, show honest empty copy and still offer unscored-amenity loops.

### 3. Along the way (context + soft outing bias)

Same amenity set for trip and outing; behaviour differs slightly by intent.

| Amenity | Index role | On A to B | On Around here |
|---------|------------|-----------|----------------|
| Public toilets | Overlay only | Map show | Map show + soft prefer near |
| Dog bag dispensers | Overlay only | Map show | Map show + soft prefer near |
| Benches / seats | Also in Day scoring stream | Map show | Map show + soft prefer near |
| Drinking fountains | Also in Day scoring stream | Map show | Map show + soft prefer near |

Rules:

- Checkboxes always **paint** markers when the layer is available
- They do **not** change Day / Night / Accessibility **index** maths on segments
- On **Around here** only: checked types act as **soft goals** when generating/ranking circuits (e.g. bonus if path comes within ~80–100 m of a checked amenity). Never require all types; never punish missing Council data
- On **A to B**: visibility only for this slice (soft “via fountain” trip bias can wait)
- Empty / unavailable layers: “None in this area” or “Coming soon” — never invent points
- Provenance tip: Council / open data; vintage if known
- Card microcopy when bias applied: e.g. “Passes a drinking fountain” (factual, not a score inflate in the /10 index pills)

### 4. Results

- Same sheet pattern as today: list + map highlight + **Use this route**
- **Calculating your walks…** while planning
- Reduced confidence copy when coverage is thin
- Edit returns to step 2 with values preserved

### 5. After “Use this route” (lightweight, no account)

- Keep selected route highlighted
- Do **not** require save-to-account
- **Open in Apple / Google Maps** is a later nice-to-have only: it would hand off **origin + destination** (or start) and let *their* router choose the path — not YourWalk’s scored geometry. Useful as turn-by-turn handoff; confusing if residents expect Casey scores to follow. Defer until flow QA is solid; prefer in-app geometry + optional shareable YourWalk link first.

---

## Acceptance criteria

**Given** a resident opens YourWalk  
**When** the entry flow loads  
**Then** they see Day/Night, importance, and a choice between **A to B** and **Around here**  
**And** language does not imply safety guarantees  

**Given** they choose A to B and set From/To in Casey  
**When** they find routes  
**Then** hybrid ranked options appear with match score and stream pills  

**Given** they choose Around here (default Loop), a start in Casey, and ~25 minutes  
**When** they find a walk  
**Then** 1–3 options near that **total** duration are shown, preferring return near start  
**And** options are ranked with the same importance model  

**Given** they check drinking fountains (or other amenities) on Around here  
**When** walks are generated  
**Then** markers show on the map  
**And** candidate ranking soft-prefers circuits that pass near a fountain when data allows  
**And** Day/Night/Accessibility pills remain Casey corridor scores (not amenity counts)  

**Given** overlay checkboxes on A to B  
**When** they toggle a layer on  
**Then** features appear on the map without changing route index scores  

**Given** no user account  
**When** they complete a walk plan  
**Then** they can use the walk in-app without login  

---

## Open questions

### OQ-1: Outing geometry style — **decided lean (30 Jul 2026)**

| Option | Role |
|--------|------|
| **A. Loop (default)** | Product default for Around here |
| **B. There and back** | Ship-first engineering fallback if true loops slip |
| **C. One way** | Lab/QA only — hidden from resident beta UI (9 Aug 2026) |

**Decision:** Resident UI = Loop (default) + There and back only. One way stays in `planOuting` for Lab/QA; do not present reachability-style one-way as a resident choice.

**Loop backtracking:** Mapbox multi-waypoint routes can still reverse streets or spur into cul-de-sacs. Mitigation in `planOuting.ts` (approach A, 10 Aug 2026): (1) triangle vias start→A→B→start; (2) half-vs-half reverse-overlap on the **same footpath** (~15 m — opposite kerb allowed); (3) full-path revisit ratio at ~15 m (ignore start-pin stub); **hard reject** above ~20% same-path revisit; (4) rank lowest revisit first; fewer clean cards OK. Outing waypoint routes do **not** use the trip carriageway hard gate. Deeper fix later: score-aware graph circuits on T1EAM + optional spur snip ([`LOOP_BACKTRACK_AND_MAP_UX.md`](../LOOP_BACKTRACK_AND_MAP_UX.md)).

### OQ-2: Geolocate failure

| Option | Pros | Cons |
|--------|------|------|
| A. Fall back to search / pin only | Simple | Friction |
| B. Centre Casey + “drop pin near you” | Still guided | Vague |

**Lean:** A with clear permission copy.

### OQ-3: Overlays vs “prefer near amenity” — **decided lean (30 Jul 2026)**

- **A to B:** visibility only (this slice)
- **Around here:** visibility + soft prefer near checked amenities
- Never impute missing amenities as zero; never put amenity counts into the Day/Night index pills

### OQ-4: URL deep links

Encode `mode`, `from`, `to` or `start`+`duration` for share/reload without accounts.  
**Lean:** yes for A→B first; outing second.

---

## Enhancing UX without accounts (recommended backlog)

High value, still anonymous:

1. **Open in Apple / Google Maps** — hand-off for turn-by-turn; YourWalk stays the “which walk” brain  
2. **Shareable trip link** — query params; friend opens same O/D + Day/Night  
3. **Why this walk?** — one-line explainer (“Better after-dark scores on shared paths; +8 min vs shortest”)  
4. **Device-local recents** — last 3 starts/ends in `localStorage` only; clear control; no cloud  
5. **Casey boundary coach** — friendly map mask + “Stay within Casey for this pilot”  
6. **Busy-road / crossing callout** — when route crosses high-speed or thin-crossing segments, show reduced-confidence tip (data-dependent; never fear-monger)  
7. **Duration chips on results** — already have time; add “Similar time, better after dark” microcopy when prefs are high  
8. **Overlay count on route card** — “2 fountains · 1 toilet within 100 m of path” (contextual, not scored)  
9. **Haptic-light loading** — keep calculating state; optional progress stages (“Finding routes…” → “Scoring footpaths…”)  
10. **Accessibility hard filter (optional later)** — e.g. “Avoid steep grades where known” as a toggle separate from importance; only when gradient data confidence allows  

Explicitly **later / icebox** (not this flow): accounts, saved libraries, history sync, social feed, gamification.

---

## Instrumentation (anonymous)

- `walk_intent_selected`: `trip` | `outing`  
- `overlay_toggled`: layer id, on/off  
- `route_planned`: mode day/night, intent, option count, duration_ms  
- `route_selected` / `open_in_maps` / `share_link`  
- No precise persistent identity; geolocation used only in-session unless user opts into device recents  

---

## Build sequence

1. ✅ Entry chooser + A→B + overlay visibility + one-way outing test slice (30 Jul)  
2. ✅ Around here **Loop** default UI + there-and-back / loop generator (30 Jul)  
3. ✅ Soft amenity bias on Around here when checkboxes are on (30 Jul)  
4. ✅ Loop quality lock (spur demotion, multi-circuit options)  
5. ✅ Map route chrome (dotted selected / quieter alternatives + tap)  
6. Optional backtrack **snip** spike — see [`LOOP_BACKTRACK_AND_MAP_UX.md`](../LOOP_BACKTRACK_AND_MAP_UX.md)  
7. Shareable A→B link + “Why this walk?”  
8. Colour / brand polish  

Trace: [`BACKLOG.md`](../BACKLOG.md) N1b · [`DELIVERY_PLAN.md`](../DELIVERY_PLAN.md) Sprint D+ · [`RESIDENT_UX_NEXT.md`](../RESIDENT_UX_NEXT.md) · [`LOOP_BACKTRACK_AND_MAP_UX.md`](../LOOP_BACKTRACK_AND_MAP_UX.md)
