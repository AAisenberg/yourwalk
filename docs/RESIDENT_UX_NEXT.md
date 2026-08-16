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
| Places | Placeholder: park, school, suburb, or street. Geolocate + **Map** (drop pin) side by side on From / Start. To: Map only. |
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
| E4 | **Parked.** Do not draw the Casey T1EAM footpath network as a resident underlay. Routing is OSM + crossings + scored corridors. T1EAM stays the scoring network, not a basemap carpet. |

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
| YourWalk Mapbox style (`lightPreset` dawn/day/dusk/night) | Shipped (testing) — E1–E3; E4 T1EAM colour later |
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

1. Routing trust (side of street, loop backtracks) when you pick it up again
2. Shareable A→B + Open in Maps (honest hand-off copy)
4. **Backtrack snip spike** — optional geometry cleanup for short reverse spurs
5. Later time picker, then custom domain / production cut when ready for wider Casey testing

Desktop panel + Beta chrome already shipped. See [`BETA_TESTER_BRIEF.md`](BETA_TESTER_BRIEF.md).

## Build sequence

1. ✅ Entry chooser + A→B + overlay show + one-way outing test
2. ✅ Around here Loop / there-and-back / one-way (+ circuit sizing fix)
3. ✅ Soft amenity bias when outing checkboxes are on
4. ✅ Loop quality + map chrome (dotted selected, quieter alts, tap path)
5. Colour / brand polish — see [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md) (overlaps with style work)
6. ✅ Planner UX slice — order, auto When, prefs persist, form geolocate, selected disclosure
7. ✅ YourWalk Standard style + `lightPreset` (E1–E3). E4 T1EAM underlay parked — not a resident layer
8. Shareable link + Open in Maps + Later time picker

Sprint framing: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint D+. Backlog: [`BACKLOG.md`](BACKLOG.md) N1b.
