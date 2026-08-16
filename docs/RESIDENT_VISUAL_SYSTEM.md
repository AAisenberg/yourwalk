# Resident visual system

Source of truth for the Casey resident routing app (`/`). North star: [`mobile-mockup/index.html`](../mobile-mockup/index.html). Live tokens: [`web/src/app/globals.css`](../web/src/app/globals.css). Token page: `/design`. Planner flow mockup: `/design/planner`.

Product name: **YourWalk** (one word). Australian English. WCAG 2.1 AA. Mapbox GL JS only. Not a safety guarantee; never imply crime prediction.

## Colour tokens

| Token | Hex | Role |
|-------|-----|------|
| `--yw-blue` | `#27AAE1` | Links, sky, night CTA, focus rings |
| `--yw-navy` | `#292984` | Brand wordmark (day), day CTA, quiet day alts / LGA |
| `--yw-teal` | `#00AAA6` | Recommended / selected route by **day**; primary accent actions |
| `--yw-lime` | `#8DC63F` | Shade stream / ranked route 3 |
| `--yw-green` | `#009444` | From pin (circle + star) |
| `--yw-amber` | `#FFCB1F` | Night selected walk (lighting family); highlights |
| `--yw-orange` | `#F6871F` | Night importance / dog bags accent |
| `--yw-pink` | `#EC008C` | To pin (circle + star) |
| `--yw-chartreuse` | `#D7DF23` | Sparse accent only |
| `--yw-day-surface` | `#F5F7FA` | Day app chrome |
| `--yw-night-surface` | `#0B0C1A` | Night app chrome |
| `--yw-night-panel` | `#14152A` | Elevated night sheets |
| `--yw-night-quiet` | `#8B8DD9` | Unselected night paths / LGA |

Semantic aliases:

- `--yw-cta-day` → navy
- `--yw-cta-night` → blue
- `--yw-selected` → teal
- `--yw-focus` → blue

Do not invent a new palette. Avoid purple-on-white CTA gradients, warm cream + terracotta brochure looks, broadsheet newspaper layouts, neon glows, and emoji chrome.

## Type

**Plus Jakarta Sans** (weights 400-800) via `next/font/google`.

- CSS: `--font-yourwalk` (Tailwind `--font-sans` points here)
- One family for brand wordmark and sheet UI: geometric, friendly, not Inter-by-default, not cream-serif
- Mono: Geist Mono retained for Lab tooling only; resident UI does not use mono

## Logo

- Mark: [`web/public/brand/yourwalk-mark.svg`](../web/public/brand/yourwalk-mark.svg) (from `mobile-mockup/logo.svg`)
- From / To map pins: logo **circle + star** (not the Mapbox teardrop). Green `#009444` From, pink `#EC008C` To, star `#FFF200`. Same glyph as the mark’s pink/orange lockup; colours stay role-coded.
- Header: mark (~32px) + **YourWalk** wordmark (navy day / white night) as the hero brand signal; subtitle **Connecting Casey walks**; quiet **Beta** pill (navy / muted, not teal)
- Header: mark + **YourWalk** + compact **Day / Night** switch. Auto When reason sits under the wordmark. Choosing Night swaps preference streams (After dark vs Shade & heat) and the planned basemap look.
- Type of walk in the sheet: **A to B | Loop** (`SegmentedPill`). No There and back row.
- Checkboxes: custom `.yw-check` — navy (overlays) or stream blue (Prefer away from roads). Avoid teal ticks on blue preference cards; teal stays for selected route / primary accents.
- Lab is not linked from the resident app (Lab stays at `/lab` for internal use)
- Sheet product line: **Find your walk**. Not a survey. Do not overpower the brand with a marketing headline
- Partner marks (Casey / Monash / CrowdLab): footer or about only, not in the walk sheet

## Icons

Material Design icons via `react-icons/md` (see [`web/src/components/resident/icons.tsx`](../web/src/components/resident/icons.tsx) and `/design` for review):

| Use | Icon |
|-----|------|
| Day | `MdWbSunny` |
| Night | `MdNightlight` |
| A to B | `MdRoute` (corridor) |
| Loop | `MdLoop` (circuit) |
| Drinking fountains / Benches / Toilets / Dog bags | `MdWaterDrop` / `MdChair` / `MdWc` / `MdPets` |

## Sheet snaps (mobile)

Three heights (Google Maps-style): **peek** (~22%), **half** (~48%), **full** (~72%). Drag the handle, arrow keys, or double-tap to step. Peek shows a short summary so the map stays usable.

## Desktop (≥ md / 768px)

Map-first split: **left panel** (~26rem) holds the plan / results form with internal scroll; map fills the remaining width. No peek/half snaps on desktop. **Use my location** belongs on From / Start in the form. Map FAB (if kept) centres the map only. Header keeps brand + compact Day / Night.

## Beta chrome

- Header: **Beta** pill beside YourWalk; subtitle may show `app {version} · scores {scoring_spec}` from `web/src/lib/beta.ts`
- Sheet footer repeats app + scores + `map-data` release for provenance
- Tester brief: [`BETA_TESTER_BRIEF.md`](BETA_TESTER_BRIEF.md)

## Map data (preview / production)

The previous Supabase Storage host (`muxatxlmpbkrsygmxcje`) no longer resolves. Until a YourWalk Supabase project is recreated:

- Segment + LGA GeoJSON ship as GitHub release `map-data-v1`
- The app loads same-origin `/api/map-data/*` (proxy) so browsers avoid CORS
- Set `NEXT_PUBLIC_SEGMENTS_GEOJSON_URL=/api/map-data/segment_scores.geojson` and `NEXT_PUBLIC_LGA_BOUNDARY_URL=/api/map-data/casey_lga_boundary.geojson`

Locally you can keep pointing at `/map-data/*` symlinks under `web/public`.

## Day / night rules

Night is a **walk mode** (product state), not a designer dark-mode default. The form stays **two** index states (Day / Night). The basemap may use **four** looks.

Auto When uses Casey civil twilight (ADR-009), not a clock hour. Basemap follows the **planned** When. Override at 2pm still paints dusk or night. See [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md) § When.

| Casey sun | Mapbox `lightPreset` | Index | App chrome |
|-----------|----------------------|-------|------------|
| Night (before dawn) | night | Night | Night surfaces |
| Morning civil twilight | dawn | Day (lean) | Day surfaces |
| Daylight | day | Day | Day surfaces |
| Evening civil twilight | dusk | Night | Night surfaces |
| Night (after dusk) | night | Night | Night surfaces |

| | Day index | Night index |
|--|-----------|-------------|
| Chrome | White header, `#F5F7FA` surfaces | `#0B0C1A` chrome |
| Sheet | White / light elevated | `#14152A` |
| Map basemap | YourWalk Standard style, `lightPreset` dawn or day (classic `streets-v12` fallback) | YourWalk Standard style, `lightPreset` dusk or night (classic `dark-v11` fallback) |
| Primary CTA | Navy | Blue |
| Results accent CTA | Teal | Teal |
| Pref stream tints | Footpaths blue wash; shade lime wash | After dark amber wash; footpaths blue wash |

**YourWalk Mapbox style:** `mapbox://styles/crowdspot1/cmsve8sql00ak01rgb6vn39pt` (Standard import). Resident map uses this URL and `setConfigProperty('basemap', 'lightPreset', …)` from planned When. Mapbox POI labels are off; Mapbox pedestrian roads are off. Casey T1EAM footpaths paint as a quiet underlay (navy by day, `--yw-night-quiet` by night) from zoom 12, under walk lines. Not a score choropleth. YourWalk amenity overlays stay on Layers. Classic streets / dark is a fallback if the style cannot load.

### Mapbox Standard: what the API can and cannot do

Classic styles (`streets-v12`, `dark-v11`) are frozen. Standard is the maintained style. You configure it with `map.setConfigProperty('basemap', key, value)` or `config.basemap` at init. You do **not** get classic per-layer paint edits on the imported basemap.

**Can change via API (same keys in Studio):**

- `lightPreset`: `dawn` | `day` | `dusk` | `night`
- Label groups on/off: POIs, places, roads, transit (booleans). POI **density** 1–5. Fuel-station mode. Not “only parks” or “only toilets.”
- Road colours: `colorMotorways`, `colorTrunks`, `colorRoads` (other roads as a group)
- Land, water, greenspace, buildings, some label colours
- `showPedestrianRoads`: show or hide paths/trails. There is **no** `colorPedestrianRoads`. Resident app sets this **false** — Standard’s night path paint is a neon dotted line on only some OSM paths, which reads as a second footpath network.
- Theme: default / faded / monochrome / custom LUT
- Custom layers in slots: `bottom`, `middle`, `top`

**Cannot do in Standard config:**

- Pick POI categories (food vs parks vs toilets). All POIs or none, plus density
- Recolour footpaths independently of other roads
- Edit individual classic layer IDs (`road-path`, `road-pedestrian`, …)

**POI categories:** hide Mapbox POIs (`showPointOfInterestLabels: false`) and draw YourWalk overlays (fountains, benches, toilets, dog bags). That is how we stay specific. Optionally hide individual Mapbox POIs at click time via the `poi` featureset `hide` state, which is not a category filter.

### Process to make footpaths louder (recommended)

Do this in order. Keep dawn / day / dusk / night as lighting only.

1. **Playground first** — [Mapbox Standard Style Playground](https://docs.mapbox.com/playground/standard-style/). Set `lightPreset` through all four looks. Turn `showPedestrianRoads` on. Quiet motorways (`colorMotorways` toward the land colour). Note that paths still share Standard’s path styling; you cannot paint them teal here.
2. **Runtime T1EAM underlay (E4, shipped)** — paint Casey footpath **polygons** from the scoring GeoJSON already loaded for routing. Slot `middle`, quiet navy / night-quiet, no index colours. Do not stroke polygons as line-only (rings look like shards). Studio tileset later if 27k client features need a perf pass.
3. **Runtime lighting** — one style; `setConfigProperty('basemap', 'lightPreset', …)` when When changes. Do not swap four style URLs. Hide Mapbox POIs and pedestrian roads; keep YourWalk amenity overlays.
4. **Route geometry** — scored walk lines in `top` with emissive-strength. Same four lighting presets, one paint rule.

Recolouring Standard’s built-in pedestrian roads will not get us there. Routes may sit a metre or two off the underlay until T1EAM-native route paint lands.

No choropleth on the resident map. No stats strip or pill-cluster clutter in the first viewport.

## Sheet / map z-order

```
map (0)
  → map pick / network toasts (5)
  → calculating overlay (6)
  → bottom sheet (10)
  → place autocomplete (20)
```

Full-bleed map; bottom sheet over map (`max-h` ~62-68%). Desktop = wider sheet + map, same composition, not a second product.

## Motion

Ship only intentional presence/hierarchy motion:

1. Sheet enter / plan↔results crossfade (short opacity + translate-y)
2. Day↔Night surface colour transition (~200ms) on chrome only
3. Selected route card border pulse once on select (subtle)

Keep the map visible while calculating. No spinner noise beyond the existing calculating state.

## Cards and sections

- Cards only when they hold an interaction (result route cards)
- Result cards show pills and the compare story on every option. Tap highlights the walk on the map
- Preference rows = tinted sections, collapsed after first set; not a carded dashboard hero
- One job per section: Type of walk / Places / When / Along the way / What matters most

## Accessibility

- Touch targets ≥ 44px on Day/Night toggle, intent toggles, primary CTA, Edit, shape chips, Map pick
- `focus-visible` rings use `--yw-blue`
- Muted labels must meet 4.5:1 against day and night panels (prefer `text-slate-600` / `text-white/55` over lighter greys)
- Higher score = better walking conditions; overlays ≠ index; anonymous by default

## Mobile screenshot checklist

Capture at phone width (~375px) for broader Casey testing sign-off. Samples from this pass live in [`docs/screenshots/resident-ux/`](screenshots/resident-ux/).

| State | Day | Night |
|-------|-----|-------|
| Entry + plan sheet (brand + type / places / When) | [`resident-day-plan.png`](screenshots/resident-ux/resident-day-plan.png) | [`resident-night-plan.png`](screenshots/resident-ux/resident-night-plan.png) |
| Calculating (map still visible) | Verified in session (teal spinner, map stays up) | Same chrome rules |
| Results (Recommended + alternatives) | [`resident-day-results.png`](screenshots/resident-ux/resident-day-results.png) | Toggle Night after a plan (clears results by design; re-run Find) |
| Empty / error (honest copy) | Manual: force a failed plan outside Casey / unreachable | Same |

Token preview: `/design` ([`resident-design-tokens.png`](screenshots/resident-ux/resident-design-tokens.png)).
