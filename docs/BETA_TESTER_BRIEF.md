# YourWalk resident beta — tester brief

**Audience:** Nikki (XYX Lab) and internal CrowdLab testers  
**Product:** YourWalk resident routing (`/`) — City of Casey pilot only  
**App version:** `0.3.0` (header shows **Beta** · app version · scores **1.1.3**)  
**Map data:** GitHub release `map-data-v1` (interim CDN until Supabase returns)

## Link

**Production:**  
https://app.yourwalk.au (header: **Beta** · app 0.3.0 · scores **1.1.3**)

Fallback: https://yourwalk.vercel.app

Public planner host: `app.yourwalk.au` (ADR-012). Apex `yourwalk.au` is the front door when that page exists (not a login).

If the map or footpath network looks blank: **hard-refresh** (Cmd+Shift+R). Large GeoJSON can take a short moment on first load.

**Access:** Preview is currently behind Vercel Authentication. Before external testing, either turn off Deployment Protection for Previews, share a bypass link, or invite the tester to the Vercel team. Confirm the URL opens in a private/incognito window without a Vercel login.

## What to try

1. **Day / Night** — in the header (auto from Casey civil twilight). Night switches basemap and preference streams (Lighting after dark vs Heat & Shade).
2. **A to B** — set From / To inside Casey (search, **Use my location** on From, tap the empty map, or the pin icon to replace a set place), then Find my route.
3. **Loop** — start plus about how long. First empty-map tap fills Start if it is empty. Loops aim to return on a **different** path (opposite kerb OK); 1–2 clean options is fine.
4. **Layers** — toggle drinking fountains, benches, toilets, dog bags. Points show on the map. On Loop they also soft-bias ranking; they do **not** change corridor score pills. On a phone, opening Layers peeks the sheet; Expand closes Layers. Tap a marker for name / reserve from Casey fields.
5. **Where am I?** — the map target button (top left) zooms to you and drops a pulsing teal dot. It does **not** fill From. Use **Use my location** on the field for that.
6. **Results** — pills are **Footpaths** then **Heat & Shade** (or Lighting at night). **Match** is mostly those streams from your importance ratings. Map taps on results select a walk or open an amenity; they do not rewrite From / To.
7. **Desktop** — widen the window: plan form becomes a left panel; map fills the rest. Phone layout keeps the bottom sheet.
8. **Add to Home Screen** — Welcome (or About) has **Add YourWalk to your home screen**. Android can prompt. iPhone: Share, then Add to Home Screen. Icon is the pink star on navy. If you saved the old generic icon, remove it and add again.

## How to read scores

- Higher score = better walking conditions for the selected Day or Night index (lower vulnerability).
- Recommended = best match to your importance sliders among options about the length you asked (time is a soft nudge on Around here).
- **Not a safety guarantee.** Graffiti is an environmental-order proxy, not crime data. No crime prediction.

## How your choices change the walk

- **Find** searches for a Casey walk that matches Footpaths / Heat & Shade (or Lighting at night), plus a **different** neighbourhood path when the streets allow one.
- **More important** on a slider means we will take a slightly longer path if it is better on that measure. **Less important** means a quicker walk can win among the cards we found.
- **Options** (under What matters most) holds **Prefer away from roads** and **Prefer flatter walks**. Same ritual: tick, then **Find**. Away from roads can add a longer park / trail card. Flatter walks re-orders the cards toward gentler hills. Neither changes the Footpaths pills.
- Dragging sliders on the results list only **re-orders** the walks already found. Edit walk + Find to search again.
- Pills stay Casey corridor scores. They do not change because you moved a slider.
- Full recap (Cupples → Ashfield, tests, open issues): [`ROUTING_NOTE_NIKKI_2026-08-16.md`](ROUTING_NOTE_NIKKI_2026-08-16.md).

The Casey graph must be reachable (`CHALLENGER_URL` on the host, or local `serve_challenger.py`). Without it you only see Mapbox. Production host: [`HOSTING_CHALLENGER.md`](HOSTING_CHALLENGER.md).

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
| Custom domain | Planner live at `app.yourwalk.au`. Apex front door not built. ADR-012 |
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
