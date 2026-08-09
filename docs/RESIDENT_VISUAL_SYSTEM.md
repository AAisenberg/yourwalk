# Resident visual system

Source of truth for the Casey resident routing app (`/`). North star: [`mobile-mockup/index.html`](../mobile-mockup/index.html). Live tokens: [`web/src/app/globals.css`](../web/src/app/globals.css). Preview: `/design`.

Product name: **YourWalk** (one word). Australian English. WCAG 2.1 AA. Mapbox GL JS only. Not a safety guarantee; never imply crime prediction.

## Colour tokens

| Token | Hex | Role |
|-------|-----|------|
| `--yw-blue` | `#27AAE1` | Links, sky, night CTA, focus rings |
| `--yw-navy` | `#292984` | Brand wordmark (day), day CTA, quiet day alts / LGA |
| `--yw-teal` | `#00AAA6` | Recommended, selected route, primary accent actions |
| `--yw-lime` | `#8DC63F` | Shade stream / ranked route 3 |
| `--yw-green` | `#009444` | Origin pin |
| `--yw-amber` | `#FFCB1F` | Highlights / caution light |
| `--yw-orange` | `#F6871F` | Night importance / dog bags accent |
| `--yw-pink` | `#EC008C` | Destination pin |
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
- Header: mark (~32px) + **YourWalk** wordmark (navy day / white night) as the hero brand signal; subtitle **Connecting Casey walks**; quiet **Beta** pill (navy / muted, not teal)
- Day/Night, A to B / Around here, and outing Shape: full-width **segmented pills** (`SegmentedPill`) under When / How. Choosing Night swaps preference streams (After dark vs Shade & heat) and the basemap. Not in the header.
- Checkboxes: custom `.yw-check` — navy (overlays) or stream blue (Prefer away from roads). Avoid teal ticks on blue preference cards; teal stays for selected route / primary accents.
- Lab is not linked from the resident app (Lab stays at `/lab` for internal use)
- Sheet product line: "Tell us about your walk". Do not overpower the brand with a marketing headline
- Partner marks (Casey / Monash / CrowdLab): footer or about only, not in the walk sheet

## Icons

Material Design icons via `react-icons/md` (see [`web/src/components/resident/icons.tsx`](../web/src/components/resident/icons.tsx) and `/design` for review):

| Use | Icon |
|-----|------|
| Day | `MdWbSunny` |
| Night | `MdNightlight` |
| A to B | `MdRoute` (corridor) |
| Around here | `MdLoop` (circuit) |
| Loop / There and back | `MdLoop` / `MdSwapHoriz` (One way icon retained in code for Lab only) |
| Drinking fountains / Benches / Toilets / Dog bags | `MdWaterDrop` / `MdChair` / `MdWc` / `MdPets` |

## Sheet snaps (mobile)

Three heights (Google Maps-style): **peek** (~22%), **half** (~48%), **full** (~72%). Drag the handle, arrow keys, or double-tap to step. Peek shows a short summary so the map stays usable.

## Desktop (≥ md / 768px)

Map-first split: **left panel** (~26rem) holds the plan / results form with internal scroll; map fills the remaining width. No peek/half snaps on desktop. Locate control sits on the map (bottom-right). Header keeps brand + **Beta** pill (Day/Night lives in the form).

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

Night is a **walk mode** (product state), not a designer dark-mode default.

| | Day | Night |
|--|-----|-------|
| Chrome | White header, `#F5F7FA` surfaces | `#0B0C1A` chrome |
| Sheet | White / light elevated | `#14152A` |
| Map basemap | `streets-v12` | `dark-v11` |
| Primary CTA | Navy | Blue |
| Results accent CTA | Teal | Teal |
| Pref stream tints | Footpaths blue wash; shade lime wash | After dark amber wash; footpaths blue wash |

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
- Preference rows = tinted sections, not a carded dashboard hero
- One job per section: When / How / Along the way

## Accessibility

- Touch targets ≥ 44px on Day/Night toggle, intent toggles, primary CTA, Edit, shape chips, Map pick
- `focus-visible` rings use `--yw-blue`
- Muted labels must meet 4.5:1 against day and night panels (prefer `text-slate-600` / `text-white/55` over lighter greys)
- Higher score = better walking conditions; overlays ≠ index; anonymous by default

## Mobile screenshot checklist

Capture at phone width (~375px) for broader Casey testing sign-off. Samples from this pass live in [`docs/screenshots/resident-ux/`](screenshots/resident-ux/).

| State | Day | Night |
|-------|-----|-------|
| Entry + plan sheet (brand + When / How) | [`resident-day-plan.png`](screenshots/resident-ux/resident-day-plan.png) | [`resident-night-plan.png`](screenshots/resident-ux/resident-night-plan.png) |
| Calculating (map still visible) | Verified in session (teal spinner, map stays up) | Same chrome rules |
| Results (Recommended + alternatives) | [`resident-day-results.png`](screenshots/resident-ux/resident-day-results.png) | Toggle Night after a plan (clears results by design; re-run Find) |
| Empty / error (honest copy) | Manual: force a failed plan outside Casey / unreachable | Same |

Token preview: `/design` ([`resident-design-tokens.png`](screenshots/resident-ux/resident-design-tokens.png)).
