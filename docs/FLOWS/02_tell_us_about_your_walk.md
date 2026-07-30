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

| Step | Question | Resident meaning |
|------|----------|------------------|
| 1 | **When are you walking?** | Day or Night — which index and which importance sliders |
| 2 | **How are you walking?** | Purpose / pattern: **A to B** vs **Around here** (timed outing) |
| 3 | **Along the way?** | Contextual amenities on the map — not part of the Day/Night index maths |

“What matters?” (importance of accessible footpaths / shade / after dark) sits under step 1 and already ships.

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

### 2. How are you walking? (purpose)

Two clear choices (cards or segmented control):

#### 2A — A to B (trip)

- **From** and **To**: search, map pin, or **Use my location** (geolocate → reverse geocode)
- Both ends must be inside Casey
- **Find my route** → hybrid ranked options (current behaviour)
- Match score + pills + confidence (current)

#### 2B — Around here (outing)

- **Start**: my location / search / pin (Casey)
- **About how long?**: e.g. ~15 / ~25 / ~40 minutes (single choice)
- Optional: “Prefer a loop back near start” vs “Out-and-back ok” (open question below)
- **Find my walk** → 1–3 outing geometries near that duration, scored and ranked with same importance + efficiency logic
- Cards use same language: Recommended / Neighbourhood links / Another option

Outing pathfinding is **new** (backlog L2b); trip mode must keep working if outing is not ready yet (ship chooser with outing “Coming soon” only if needed — prefer vertical slice).

### 3. Along the way (overlays)

Checkboxes (multi-select), visible before and after results:

| Overlay | Index role | UX role |
|---------|------------|---------|
| Public toilets | Overlay only | See facilities near route / start |
| Dog bag dispensers | Overlay only | Same |
| Benches / seats | Day stream for scoring; also overlay | Rest points on map |
| Drinking fountains | Day stream for scoring; also overlay | Water on map |

Rules:

- Toggles **paint map markers/clusters** only; they do **not** change Day/Night/Accessibility maths
- Optional later: “Prefer routes near a toilet” as a soft preference — **not** MVP of this flow; keep checkboxes as visibility first
- Empty state if layer has no features in view: “None shown in this area”
- Provenance tip: Council / open data; vintage if known

### 4. Results

- Same sheet pattern as today: list + map highlight + **Use this route**
- **Calculating your walks…** while planning
- Reduced confidence copy when coverage is thin
- Edit returns to step 2 with values preserved

### 5. After “Use this route” (lightweight, no account)

- Keep selected route highlighted
- Offer: **Open in Maps** (Apple / Google walking deep link from geometry or O/D)
- Offer: **Copy link** or share sheet with start/end + mode (encode in URL query; no login)
- Do **not** require save-to-account

---

## Acceptance criteria

**Given** a resident opens YourWalk  
**When** the entry flow loads  
**Then** they see Day/Night, importance, and a choice between **A to B** and **Around here**  
**And** language does not imply safety guarantees  

**Given** they choose A to B and set From/To in Casey  
**When** they find routes  
**Then** hybrid ranked options appear with match score and stream pills  

**Given** they choose Around here, a start in Casey, and ~25 minutes  
**When** they find a walk  
**Then** 1–3 options near that duration are shown and ranked with the same preference model  

**Given** overlay checkboxes for toilets / dog bags / benches / fountains  
**When** they toggle a layer on  
**Then** features appear on the map without changing route index scores  

**Given** no user account  
**When** they complete a walk plan  
**Then** they can still use, share, or open the walk in an external maps app  

---

## Open questions

### OQ-1: Outing geometry style

| Option | Pros | Cons |
|--------|------|------|
| A. Soft loop toward start | Feels like a local walk | Harder; needs graph loops |
| B. Out-and-back along best corridor | Simpler; reuses trip scoring | Less “explore” |
| C. Offer both as ranked cards | Honest choice | More UI |

**Decision criteria:** Ship B first if loops slip; aim for A when hybrid graph supports it.  
**Lean:** B for first outing slice; A as follow-up.

### OQ-2: Geolocate failure

| Option | Pros | Cons |
|--------|------|------|
| A. Fall back to search / pin only | Simple | Friction |
| B. Centre Casey + “drop pin near you” | Still guided | Vague |

**Lean:** A with clear permission copy.

### OQ-3: Overlays vs “prefer near amenity”

Visibility-only for this flow. Soft routing bias toward amenities = later experiment (must not impute missing amenities as zero).

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

1. Entry chooser + copy (“Tell us about your walk”) wrapping current A→B  
2. Overlay checkboxes + map markers  
3. Outing (~15/25/40) vertical slice  
4. Open in Maps + shareable A→B link  
5. “Why this walk?” explainers  
6. Colour / brand polish  

Trace: [`BACKLOG.md`](../BACKLOG.md) N1b · [`DELIVERY_PLAN.md`](../DELIVERY_PLAN.md) Sprint D+ · [`RESIDENT_UX_NEXT.md`](../RESIDENT_UX_NEXT.md)
