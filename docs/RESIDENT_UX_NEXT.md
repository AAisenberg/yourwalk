# Resident UX — next

Living plan. Iterate after testing. Spec: [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md). Mockup: `/design/planner`.

## Tracks (16 Aug 2026 evening)

Four tracks. Do not mix them in one sitting. Mockup first, then wire `/`.

### Track A — Mockup polish (in `/design/planner`)

Feel it on `/design/planner` before touching `ResidentApp`.

| Change | Lean |
|--------|------|
| Heading | **Find your walk** plus a dismissible Casey line (not a survey). Desktop `/design/planner` aside stays internal notes. |
| Sliders | Compact: one-line dynamic copy, prefer-away on Footpaths, **Less important / More important** under the bar (~9px). |
| When | Keep **Day / Night words + icons** in the header for the pilot. Icons-only reads as dark mode. Revisit after testers know the index. |
| Places | Placeholder: park, school, suburb, or street. Geolocate on From / Start. Empty-map tap fills From then To (Start on Loop). Pin icon still replaces a set place. |
| Along the way | **Out of the form.** Layers top-left. Ringed amenity icons. Default off; first-visit tip; ticks persist. Loop helper under duration. |

XYX copy we already have in-repo: sliders must change the **line**, not only Recommended ([`ROUTING_NOTE_NIKKI_2026-08-16.md`](ROUTING_NOTE_NIKKI_2026-08-16.md)). Full UX copy pack is not in the repo. Drop the rest here and we will checklist it.

### Track B — Live planner wiring

Shipped on `/` (16 Aug 2026 evening). Header When (auto twilight), A to B / Loop, places first, prefs open, compact sliders, compare pills on every card, Edit / Clear, device-local prefs. No live tracking.

### Track C — Map layers (was Along the way)

A **layers** button on the map (not the sheet). Toggles fountains, benches, toilets, dog bags as markers.

- Always: paint on the map
- If any are on when they Find a **Loop**: keep today’s soft “prefer near” bias
- A to B: visibility only
- Does not change /10 pills. Fountains and benches already sit in the Day Index on segments whether the layer is on or not

### Track D — Places in search

Shipped (16 Aug 2026 night). Geocoding v5 was returning streets that matched the words (`school` → School Court) and **zero** Casey POIs. Live From / Start / To now uses Mapbox **Search Box** `/forward` (schools, hospitals, aged care, parks), Casey bbox, v5 fallback.

- Rows show place name first, then kind · address (School, Hospital, …)
- Empty: “No Casey places for that search”
- Confirm in the field: Berwick Primary, Casey Hospital, aged care, Wilson Botanic Park

### Track E — YourWalk Standard style

Published style (no custom sources or layers yet):

`mapbox://styles/crowdspot1/cmsve8sql00ak01rgb6vn39pt`

Casey-ish centre `[145.317, -38.112]`, zoom ~15. GL JS 3.27 (app is `^3.26`). Config only: this is Standard with Studio defaults, not a Casey footpath basemap yet.

| Step | What |
|------|------|
| E1 | ✅ Point the resident map at this style URL (classic streets / dark fallback) |
| E2 | ✅ `setConfigProperty('basemap', 'lightPreset', dawn/day/dusk/night)` from When |
| E3 | ✅ Hide Mapbox POIs; YourWalk overlays stay Track C |
| E4 | ✅ Quiet path-centreline underlay from `casey_paths_underlay.geojson` (z12+). T1EAM pavement polygons stay in scoring GeoJSON only; not painted on `/`. Mapbox `showPedestrianRoads` stays off. |

Do not treat the Studio “build an app from this style” brief as a new product. YourWalk already exists. This URL is the basemap input for Track E.

---

## Where we are

## Where we are

| Capability | Status |
|------------|--------|
| A→B hybrid routes (Mapbox + neighbourhood score-aware) | Shipped |
| Day / Night + importance sliders (dynamic efficiency) | Shipped (manual When; sliders still above places) |
| Match score = Recommended; preference stream tiebreaks | Shipped |
| Calculating spinner + faster corridor scoring | Shipped |
| Lab OD jumper + bake-off compare | Shipped |
| Find your walk shell (A→B / Loop) | Shipped (testing) — header When, places, prefs open |
| Loop circuits; there-and-back silent fallback | Shipped (testing) — no shape row; honest card note if fallback |
| Soft amenity bias on Loop (Layers ticks) | Shipped (testing) |
| Prefer shared paths (generation-time + rank bias, not index) | Shipped (testing) |
| Loop quality lock (spur demote / reject, empty state) | Shipped (testing) |
| Google-like selected/alternative map chrome | Shipped (testing) — dotted selected, quieter alts, tap path |
| Route-first form + auto When + device-local prefs | Shipped (testing) |
| Compare pills on every result card | Shipped (testing) — tap highlights the map path |
| Geolocate on From / Start | Shipped (testing) — one-shot; Casey bbox |
| Casey civil twilight auto When | Shipped (testing) — `caseyWhen.ts`; override for the session |
| YourWalk Mapbox style (`lightPreset` dawn/day/dusk/night) | Shipped (testing) — E1–E4; quiet T1EAM underlay |
| Later time picker | After Now + override |
| Live route tracking / start-to-finish breadcrumbs | Out of scope for pilot |
| Backtrack spur snip on loops | Not built — see notes |
| Brand / colour system | In progress — visual system |

Methodology reminder: toilets, dog bags, YourGround = **overlays only**, not in Day/Night index. Fountains + benches sit in the Day (Heat & Shade) stream for scoring; still useful as map overlays for “along the way.”

## Spec (source of truth for this slice)

→ [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md)

Loop backtracks + map UX notes (snip feasibility, Google-like chrome, focus order):

→ [`LOOP_BACKTRACK_AND_MAP_UX.md`](LOOP_BACKTRACK_AND_MAP_UX.md)

Visual / basemap (two index states, four map looks):

→ [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md)

## Focus next (recommended)

Planner host is live: [`https://app.yourwalk.au`](https://app.yourwalk.au) (ADR-012). Share that with Nikki. Apex front door is a separate go.

Do not mix tracks in one sitting.

| Session | Job | Done when |
|---------|-----|-----------|
| **0 — Share and listen** | Nikki (and you) on `app.yourwalk.au`. Confirm Mapbox URL restrictions include this host if the map is blank. One A→B (Cupples → Ashfield) and one Loop she knows. Collect notes. Do not start the front door. | Feedback tagged to this URL. Only hotfix if the map, Find, or challenger is broken. |
| **1 — Shareable A→B + Open in Maps** | Anonymous query-param link (FLOW 02 OQ-4) plus honest hand-off to Apple / Google Maps. YourWalk stays “which walk”; their router does turn-by-turn. No accounts. | A friend can open the same From / To / When. Copy does not promise navigation. |
| **2 — Routing trust (only if testers hit it)** | Side of street / heading continuity, or a **small** loop backtrack-snip spike. Not a graph rewrite. OSM gap-fill stays blocked on licensing. | A named Casey OD looks honest on streets she knows, or we write why we will not snip yet. |
| **3 — Later time picker** | Same Casey sun maths at a chosen clock time (FLOW 02 OQ-6). Only if testers need to plan tonight at lunch. | When can be Now or a clock time; Day / Night still two index states. |

**Parked until you say go:** apex front-door **page** ([`FRONT_DOOR.md`](FRONT_DOOR.md) spec is written); Clerk / L1; `dashboard.yourwalk.au` (N5); stream choropleth layers (N3); submissions (N4). Shareable A→B is Session 1 (new chat).

Desktop panel + Beta chrome already shipped. See [`BETA_TESTER_BRIEF.md`](BETA_TESTER_BRIEF.md).

## Build sequence

1. ✅ Entry chooser + A→B + overlay show + one-way outing test
2. ✅ Around here Loop / there-and-back / one-way (+ circuit sizing fix)
3. ✅ Soft amenity bias when outing checkboxes are on
4. ✅ Loop quality + map chrome (dotted selected, quieter alts, tap path)
5. Colour / brand polish — see [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md) (overlaps with style work)
6. ✅ Planner UX slice — order, auto When, prefs persist, form geolocate, selected disclosure
7. ✅ YourWalk Standard style + `lightPreset` (E1–E3) + quiet T1EAM underlay (E4)
8. Shareable link + Open in Maps + Later time picker

Sprint framing: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint D+. Backlog: [`BACKLOG.md`](BACKLOG.md) N1b.
