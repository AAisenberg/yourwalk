# Flow: Find your walk

## Purpose

Residents plan a walk from **where** (A to B or a Loop), with **When** in the header (auto Day/Night). What matters most stays open on the form. Amenities are map **Layers**, not a form section. Routing engines stay underneath.

This is the **walk planner** only. Observation / audit submissions are separate flows (`03`–`05`).

**Plan updated 16 Aug 2026** after UX digest. Living document: iterate after further testing. Live `/` now follows this order (header When, A to B / Loop, places, prefs, map Layers).

Clickable mockup (design tokens, no routing): `/design/planner` on the local or preview app. Linked from `/design`.

## Primary user

Casey residents planning a walk: commute, errands, recreation, or “just get outside for a bit.”

## Preconditions

- Hybrid trip mode available (Mapbox + score-aware challenger)
- Casey pilot boundary enforced for start / end
- Amenity layers available where ingested (toilets, dog bags, benches, fountains)
- No account required

## Out of scope (this flow)

- User accounts, login, cloud-saved walks or profiles
- Council dashboard
- Observations / audit submissions (separate flow)
- In-app turn-by-turn navigation (PRD non-goal)
- Live tracking of a resident along a walk (see Location and privacy)
- Brand / colour system overhaul (after flow sticks)

Anonymous **device-local** helpers (prefs, later recents) are allowed if clearly not an account.

---

## Mental model (route first)

| Step | Label | Resident meaning |
|------|-------|------------------|
| Header | **When** | Day or Night index. Auto from Casey civil twilight. Always overridable. |
| 1 | **Type of walk** | **A to B** or **Loop** (timed circuit from a start) |
| 2 | **Places** | From / To, or Start + duration |
| 3 | **What matters most** | Standing importance. Open by default. Persisted on device. Dynamic slider copy. |
| Map | **Layers** | Amenities on the map (not in the form). Soft Loop bias if on at Find. |

Section labels do not use question marks.

**Why this order:** When is chrome once it auto-detects, so it lives in the header. Type of walk changes the place fields. Places are required to Find. Sliders change ranking (and Prefer away from roads changes generation), so they stay exposed. Amenities are optional map context plus a soft Loop nudge.

There and back is **not** a resident choice. Keep it as a silent engine fallback when a clean loop cannot be found (honest card note). Lab can still force the shape.

---

## Step-by-step flow

### 0. Open YourWalk (`/`)

- Map shows Casey; heading **Find your walk**; first-visit line: Casey footpaths, ranked for shade, smoother paths, or lighting after dark. Not just the shortest way.
- No choropleth required on resident map (lab keeps scored network)
- Disclaimer remains: not a safety guarantee
- Header When preselects from Casey sun position (civil twilight). Quiet reason under the wordmark, e.g. `Night · after dark in Casey now`
- What matters most is open and restores last device-local values if present

### 1. Type of walk

Two clear choices (segmented control): **A to B** | **Loop**

#### 1A — A to B (trip)

- **From** and **To**: search, map pin, or **Use my location** on the From field (geolocate → reverse geocode)
- Both ends must be inside Casey
- **Find my route** → hybrid ranked options
- Match score on every card; stream pills and extra story on the **selected** walk only (see Results)

#### 1B — Loop (outing)

**Product meaning:** a **circuit** of about N minutes that returns near the start on a *different* path, not “how far can I get in N minutes,” and not a same-path there-and-back.

- **Start**: Use my location / search / pin (Casey). Geolocate lives on this field.
- **About how long?**: e.g. ~15 / ~25 / ~40 minutes = **total** walk time
- No shape row in the resident UI
- **Find my loop** → 1–3 circuits near that duration, scored and ranked with importance + efficiency
- If a clean circuit cannot be found, the engine may fall back to same-path home with an honest card note. Do not offer There and back as a resident choice
- One way stays Lab/QA only

**Amenities on a loop** (see Along the way): checking fountains / benches / toilets / dog bags both **shows** them on the map and **soft-biases** candidate circuits toward passing near at least one of the checked types when data exists. Missing amenities never score as zero.

### 2. When (header)

- Compact **Day** / **Night** switch in the app header, not in the sheet. Two index states only. Do not put four dawn/day/dusk/night chips in the UI.
- **Auto (Now):** Casey civil twilight at one LGA point (civic centre or centroid). Australia/Melbourne. No weather API. Clock-hour rules (e.g. 6pm) are not used.
- Always overridable. If the resident taps the other mode, do not flip back mid-session.
- Re-detect on each new visit. Do not persist last night’s mode into the next morning.
- Auto means **conditions now in Casey**, not “when I will walk.” Planning tonight at 2pm still needs an override (or Later, when that exists).
- **Later (not this slice):** optional time picker. Same Casey sun maths at that clock time. Add when testers need to plan ahead.

Civil twilight is the astronomy threshold: sun 6 degrees below the horizon. ADR-009 already uses it as the after-dark boundary.

| Casey sun | Mapbox `lightPreset` | YourWalk index |
|-----------|----------------------|----------------|
| Night (before dawn) | night | Night |
| Morning civil twilight | dawn | Day (product lean; see OQ-5) |
| Daylight | day | Day |
| Evening civil twilight | dusk | Night (ADR-009 dusk rule) |
| Night (after dusk) | night | Night |

Basemap follows the **planned** When. If they tap Night at 2pm, the map goes dusk or night so chrome and scores match. In auto mode, both follow Casey sun. Visual system: [`RESIDENT_VISUAL_SYSTEM.md`](../RESIDENT_VISUAL_SYSTEM.md).

### 3. Along the way (context + soft outing bias)

Same amenity set for trip and outing; behaviour differs slightly by intent.

| Amenity | Index role | On A to B | On Loop |
|---------|------------|-----------|----------------|
| Public toilets | Overlay only | Map show | Map show + soft prefer near |
| Dog bag dispensers | Overlay only | Map show | Map show + soft prefer near |
| Benches / seats | Also in Day scoring stream | Map show | Map show + soft prefer near |
| Drinking fountains | Also in Day scoring stream | Map show | Map show + soft prefer near |

Rules:

- Checkboxes always **paint** markers when the layer is available
- They do **not** change Day / Night / Accessibility **index** maths on segments
- On **Loop** only: checked types act as **soft goals** when generating/ranking circuits (e.g. bonus if path comes within ~80–100 m of a checked amenity). Never require all types; never punish missing Council data
- Fountains and benches already sit in the Day Index Heat & Shade stream on segments. That is methodology, always on, and does **not** depend on the Along the way tick. The tick does not change /10 pills.
- On **A to B**: visibility only for this slice (soft “via fountain” trip bias can wait)
- Empty / unavailable layers: “None in this area” or “Coming soon” — never invent points
- Provenance tip: Council / open data; vintage if known
- Selected-walk microcopy when bias applied: e.g. “Passes a drinking fountain” (factual, not a score inflate in the /10 index pills)

### 4. What matters most (standing setting)

- Open by default, above Along the way
- Importance of accessible footpaths, and Heat & Shade (day) or Lighting after dark (night)
- Keep **dynamic slider descriptions** from the live app (`prefSliderDescription`)
- **Prefer away from roads** sits on the Accessible footpaths slider (generation-time)
- Persist sliders + prefer-away in `localStorage`. No account.
- Amenities are a map **Layers** control, not a form section
- Results must not claim sliders re-order cards unless a compact prefs control is actually on the results sheet

### 5. Results

- **Calculating your walks…** while planning. Map stays visible.
- List cards show the compare set on every option: name, time, distance, match, why, Footpaths + Heat & Shade or Lighting pills, coverage, amenity / prefer-away notes
- Tap a card or the path: that walk is highlighted on the map. Selection does not hide the other cards’ pills
- Results header: **Edit** (back to the form, places and prefs kept, cards and map lines cleared) and **Clear** (empty the places too; prefs stay). No Refresh.
- Changing Day/Night after results: same as Edit, plus a one-line “When changed. Find again to re-score.”

### 6. After a chosen walk (lightweight, later)

Selecting a walk is the first job (inspect and read). A later commit can lock the choice, dim alternatives, and offer:

- Shareable YourWalk link (same From/To or start + When)
- **Open in Apple / Google Maps** with one honest line: their router takes over, not YourWalk geometry

Do **not** require save-to-account. Do not start in-app navigation.

---

## Location and privacy

### Geolocate (one shot)

- Primary control: **Use my location** on **From** (A to B) or **Start** (Around here)
- After tap: browser permission, one coordinate in session, reverse-geocode a label
- That point is required to route. It is sent to Mapbox (geocode / Directions) and the challenger when they Find
- If outside Casey: say so and ask for a point inside the pilot. Do not start a track
- Map FAB today always writes origin. After the form control ships: remove the FAB, or make it centre-map-on-me only, and only fill From / Start if that field is still empty
- Geolocate failure: fall back to search / pin with clear permission copy (OQ-2)

### What we do not do (pilot)

- No `watchPosition` trail from start to finish
- No timestamped breadcrumbs uploaded to a server
- No “start walking and we follow you until you finish”
- No persisting live GPS in `localStorage`

A finished walk trace is a movement history. ADR-004 leans anonymous by default. Privacy reqs say collect only what is needed and minimise stored location. That product needs consent, purpose, retention, and an ethics pass. Not this phase.

**Later, only if people ask:** an on-device blue dot while the tab is open, discarded on leave, never uploaded.

---

## Acceptance criteria

**Given** a resident opens YourWalk  
**When** the entry flow loads  
**Then** they see Type of walk, place fields, compact When, optional amenities, and collapsed or lower prefs  
**And** When is preselected from Casey civil twilight and can be overridden  
**And** language does not imply safety guarantees  

**Given** they choose A to B and set From/To in Casey  
**When** they find routes  
**Then** hybrid ranked options appear  
**And** every card shows time, distance, and match  
**And** stream pills and why-this-walk copy appear on the selected walk, not on every card  

**Given** they choose Loop, a start in Casey, and ~25 minutes  
**When** they find a walk  
**Then** 1–3 options near that **total** duration are shown, preferring return near start  
**And** options are ranked with the same importance model  

**Given** they check drinking fountains (or other amenities) on Loop  
**When** walks are generated  
**Then** markers show on the map  
**And** candidate ranking soft-prefers circuits that pass near a fountain when data allows  
**And** Day/Night/Accessibility pills remain Casey corridor scores (not amenity counts)  

**Given** overlay checkboxes on A to B  
**When** they toggle a layer on  
**Then** features appear on the map without changing route index scores  

**Given** they tap Use my location on From or Start and grant permission inside Casey  
**When** the position returns  
**Then** that one coordinate fills the field and is labelled  
**And** no further positions are watched or stored  

**Given** no user account  
**When** they complete a walk plan  
**Then** they can use the walk in-app without login  
**And** importance prefs restore on the next visit from the device only  

---

## Open questions

### OQ-1: Outing geometry style — **decided lean (30 Jul 2026)**

| Option | Role |
|--------|------|
| **A. Loop (default)** | Product default for Around here |
| **B. There and back** | Ship-first engineering fallback if true loops slip |
| **C. One way** | Lab/QA only — hidden from resident beta UI (9 Aug 2026) |

**Decision (updated 16 Aug 2026):** Resident UI = **Loop only**. There and back is a silent engine fallback + Lab/QA, not a resident shape. One way stays in `planOuting` for Lab/QA.

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
**Lean:** yes for A→B first; outing second. After selected-walk disclosure ships.

### OQ-5: Dawn index — **lean Day (16 Aug 2026)**

Morning civil twilight uses Mapbox `dawn` and the **Day** index (product lean). Evening twilight uses `dusk` and the **Night** index (ADR-009).

Strict methodology could treat dawn as Night because lighting still dominates. Confirm with Nikki if both twilights should use Night. Until then, keep the table in When.

### OQ-6: Later time picker

| Option | Role |
|--------|------|
| **A. Now + override only** | Next slice |
| **B. Later + time picker** | Same Casey sun maths at a chosen clock time |

**Lean:** A first. Add B after testers need to plan tonight at lunchtime.

### OQ-7: Map locate button after form geolocate

| Option | Role |
|--------|------|
| **A. Remove map FAB** | One place to geolocate |
| **B. FAB centres map only** | Fill From / Start only if empty |

**Lean:** B if the map still needs a “where am I” control; A if the form control is enough. Decide in implementation.

---

## Enhancing UX without accounts (recommended backlog)

High value, still anonymous:

1. **Open in Apple / Google Maps** — hand-off for turn-by-turn; YourWalk stays the “which walk” brain. Honest copy that their router wins.
2. **Shareable trip link** — query params; friend opens same O/D + Day/Night
3. **Why this walk?** — on the selected walk (“Better after-dark scores on shared paths; +8 min vs shortest”)
4. **Device-local recents** — last 3 starts/ends in `localStorage` only; clear control; no cloud; no live GPS
5. **Casey boundary coach** — friendly map mask + “Stay within Casey for this pilot”
6. **Busy-road / crossing callout** — when the **selected** route crosses high-speed or thin-crossing segments, show reduced-confidence tip (data-dependent; never fear-monger)
7. **Along-this-walk amenity count** — “2 fountains · 1 toilet within 100 m of path” on the selected walk only
8. **Haptic-light loading** — keep calculating state; optional progress stages (“Finding routes…” → “Scoring footpaths…”)
9. **Accessibility hard filter (optional later)** — e.g. “Avoid steep grades where known” as a toggle separate from importance; only when gradient data confidence allows
10. **On-device blue dot** — follow me while the tab is open; discard on leave; never upload. Only if people ask.

Explicitly **later / icebox** (not this flow): accounts, saved libraries, history sync, social feed, gamification, start-to-finish route tracking, Council upload of traces.

---

## Instrumentation (anonymous)

- `walk_intent_selected`: `trip` | `outing`
- `overlay_toggled`: layer id, on/off
- `route_planned`: mode day/night, intent, option count, duration_ms
- `route_selected` / `open_in_maps` / `share_link`
- `when_autodetect`: day/night, light_preset, overridden true/false
- `geolocate_used`: field from/start, inside_casey true/false
- No precise persistent identity
- No breadcrumb / watchPosition events
- Geolocate used only in-session unless the resident later opts into device recents of **typed places**

---

## Build sequence

1. ✅ Entry chooser + A→B + overlay visibility + one-way outing test slice (30 Jul)
2. ✅ Around here **Loop** default UI + there-and-back / loop generator (30 Jul)
3. ✅ Soft amenity bias on Around here when checkboxes are on (30 Jul)
4. ✅ Loop quality lock (spur demotion, multi-circuit options)
5. ✅ Map route chrome (dotted selected / quieter alternatives + tap)
6. ✅ Route-first form; auto When; prefs persisted; geolocate on From / Start; compact cards; Edit + Clear
7. YourWalk Mapbox style: one Standard-based style, `lightPreset` dawn / day / dusk / night (see visual system)
8. Optional backtrack **snip** spike — see [`LOOP_BACKTRACK_AND_MAP_UX.md`](../LOOP_BACKTRACK_AND_MAP_UX.md)
9. Shareable A→B link + Open in Maps + Later time picker
10. Colour / brand polish (can overlap with the style work)

Trace: [`BACKLOG.md`](../BACKLOG.md) N1b · [`DELIVERY_PLAN.md`](../DELIVERY_PLAN.md) Sprint D+ · [`RESIDENT_UX_NEXT.md`](../RESIDENT_UX_NEXT.md) · [`LOOP_BACKTRACK_AND_MAP_UX.md`](../LOOP_BACKTRACK_AND_MAP_UX.md) · [`RESIDENT_VISUAL_SYSTEM.md`](../RESIDENT_VISUAL_SYSTEM.md)
