# YourWalk resident beta — tester brief

**Audience:** Nikki (XYX Lab) and internal CrowdLab testers  
**Product:** YourWalk resident routing (`/`) — City of Casey pilot only  
**App version:** `0.2.0` (header shows **Beta** · app version · scores **1.1.3**)  
**Map data:** GitHub release `map-data-v1` (interim CDN until Supabase returns)

## Link

**Preview (branch `feat/resident-ux-ui`):**  
https://yourwalk-git-feat-resident-ux-ui-anthony-3110s-projects.vercel.app

If the map or footpath network looks blank: **hard-refresh** (Cmd+Shift+R). Large GeoJSON can take a short moment on first load.

**Access:** Preview is currently behind Vercel Authentication. Before external testing, either turn off Deployment Protection for Previews, share a bypass link, or invite the tester to the Vercel team. Confirm the URL opens in a private/incognito window without a Vercel login.

## What to try

1. **Day / Night** — under **When** in the plan form. Night switches basemap and preference streams (Lighting after dark vs Heat & Shade).
2. **A to B** — set From / To inside Casey (search or tap Map), then Find my route.
3. **Around here** — start point, duration, Loop / There and back. Loops aim to avoid walking the **same footpath** twice (opposite kerb OK); 1–2 clean options is fine.
4. **Along the way** — toggle drinking fountains, benches, toilets, dog bags. Points should appear on the map. On Around here they also soft-bias route ranking; they do **not** change corridor score pills.
5. **Results** — pills are **Footpaths** then **Heat & Shade** (or Lighting at night). **Match** is mostly those streams from your importance ratings; Around here only gently uses time inside the ±5 min band.
6. **Desktop** — widen the window: plan form becomes a left panel; map fills the rest. Phone layout keeps the bottom sheet.

## How to read scores

- Higher score = better walking conditions for the selected Day or Night index (lower vulnerability).
- Recommended = best match to your importance sliders among options about the length you asked (time is a soft nudge on Around here).
- **Not a safety guarantee.** Graffiti is an environmental-order proxy, not crime data. No crime prediction.

## How your choices change the walk

- **Find** searches for a Casey walk that matches Footpaths / Heat & Shade (or Lighting at night), plus a **different** neighbourhood path when the streets allow one.
- **More important** on a slider means we will take a slightly longer path if it is better on that measure. **Less important** means a quicker walk can win among the cards we found.
- **Prefer away from roads** is a third, longer park / trail option. It is off unless you tick it. Tap **Find** again after you change it.
- Dragging sliders on the results list only **re-orders** the walks already found. Edit walk + Find to search again.
- Pills stay Casey corridor scores. They do not change because you moved a slider.
- Full recap (Cupples → Ashfield, tests, open issues): [`ROUTING_NOTE_NIKKI_2026-08-16.md`](ROUTING_NOTE_NIKKI_2026-08-16.md).

The Casey graph must be running (local `serve_challenger.py` or a hosted `CHALLENGER_URL`). Without it you only see Mapbox.

## Routing honesty (beta)

Trip options must not draw down the **road carriageway**. Generation + filter rules: [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md). Prefer away from roads is a generation-time park option (up to ~1.6×). It does not replace the carriageway gate.

Regression OD: 16 Epsom Lane, Cranbourne North → 16 Arubi Avenue, Clyde North (expect path-safe option(s), no mid-carriageway alternative).

Try also: **66 Cupples Crescent, Berwick → 2 Ashfield Drive, Berwick** (expect two Casey cards: Homestead vs Bellevue / Fieldhouse; a third if away is on).

## Known gaps (expected in this beta)

| Gap | Notes |
|-----|--------|
| No shareable walk link yet | Copy/share comes later |
| No accounts / saved walks | Anonymous session only |
| “Use this route” does not navigate turn-by-turn | Confirms selection and frames the map. Next planner slice: skinny cards, extra story on the selected walk only. Spec: [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md) |
| No “Why this walk?” deep dive | Card blurbs + score pills only |
| Lab (`/lab`) is internal | Not linked from the resident header |
| Crossings / kerb ramps incomplete | Reduced confidence until Council data arrives; missing inputs are not imputed as zero |
| Custom domain | Preview / Vercel URL for now |
| Supabase / PostGIS | Not required for this beta; static scored GeoJSON via release |

## Feedback we want

- Does Day vs Night feel understandable?
- Are route options credible for Casey streets you know?
- Overlay usefulness (especially dog bags / toilets)?
- Desktop panel vs phone sheet: anything blocking review?
- Confusing copy, broken states, or crashes (browser + steps)?

Send notes to Anthony (CrowdLab). Tag with Preview URL and approx time if something fails.

## Related docs

- Methodology: [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1  
- Scoring: [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md)  
- Visual system: [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md)  
- Next UX stocktake: [`RESIDENT_UX_NEXT.md`](RESIDENT_UX_NEXT.md)
- Routing recap for XYX (16 Aug 2026): [`ROUTING_NOTE_NIKKI_2026-08-16.md`](ROUTING_NOTE_NIKKI_2026-08-16.md)
