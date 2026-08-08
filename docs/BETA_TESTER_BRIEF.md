# YourWalk resident beta — tester brief

**Audience:** Nikki (XYX Lab) and internal CrowdLab testers  
**Product:** YourWalk resident routing (`/`) — City of Casey pilot only  
**App version:** `0.1.0` (header shows **Beta** · app version · scores **1.1.3**)  
**Map data:** GitHub release `map-data-v1` (interim CDN until Supabase returns)

## Link

**Preview (branch `feat/resident-ux-ui`):**  
https://yourwalk-git-feat-resident-ux-ui-anthony-3110s-projects.vercel.app

If the map or footpath network looks blank: **hard-refresh** (Cmd+Shift+R). Large GeoJSON can take a short moment on first load.

**Access:** Preview is currently behind Vercel Authentication. Before external testing, either turn off Deployment Protection for Previews, share a bypass link, or invite the tester to the Vercel team. Confirm the URL opens in a private/incognito window without a Vercel login.

## What to try

1. **Day / Night** — under **When** in the plan form. Night switches basemap and preference streams (Lighting after dark vs Shade & heat).
2. **A to B** — set From / To inside Casey (search or tap Map), then Find my route.
3. **Around here** — start point, duration, Loop / There and back / One way.
4. **Along the way** — toggle fountains, benches, toilets, dog bags. Points should appear on the map. On Around here they also soft-bias route ranking; they do **not** change corridor score pills.
5. **Results** — tap a path or card to select; **Use this route** focuses the map on that walk.
6. **Desktop** — widen the window: plan form becomes a left panel; map fills the rest. Phone layout keeps the bottom sheet.

## How to read scores

- Higher score = better walking conditions for the selected Day or Night index (lower vulnerability).
- Recommended = best match to your importance sliders plus time/distance trade-offs.
- **Not a safety guarantee.** Graffiti is an environmental-order proxy, not crime data. No crime prediction.

## Routing honesty (beta)

Trip options must not draw down the **road carriageway**. Generation + filter rules: [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md). Soft “Prefer away from roads” only ranks shared-use paths; it does not replace that gate.

Regression OD: 16 Epsom Lane, Cranbourne North → 16 Arubi Avenue, Clyde North (expect path-safe option(s), no mid-road alternative).

## Known gaps (expected in this beta)

| Gap | Notes |
|-----|--------|
| No shareable walk link yet | Copy/share comes later |
| No accounts / saved walks | Anonymous session only |
| “Use this route” does not navigate turn-by-turn | Confirms selection and frames the map |
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
