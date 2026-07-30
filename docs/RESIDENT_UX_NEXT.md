# Resident UX — next (30 Jul 2026 stocktake)

Pilot routing and preference ranking are in good shape. Around-here Loop is testable; next work locks **loop quality**, then **map route chrome**, then share / brand.

## Where we are

| Capability | Status |
|------------|--------|
| A→B hybrid routes (Mapbox + neighbourhood score-aware) | Shipped |
| Day / Night + importance sliders (dynamic efficiency) | Shipped |
| Match score = Recommended; preference stream tiebreaks | Shipped |
| Calculating spinner + faster corridor scoring | Shipped |
| Lab OD jumper + bake-off compare | Shipped |
| Tell us about your walk shell (A→B / Around here) | Shipped (testing) |
| Around here Loop / there-and-back / one-way | Shipped (testing) — Loop = circuits only; via sizing tuned |
| Soft amenity bias on Around here | Shipped (testing) |
| Backtrack spur snip on loops | Not built — see notes |
| Google-like selected/alternative map chrome | Not built — see notes |
| Brand / colour system | Deferred until flow is solid |

Methodology reminder: toilets, dog bags, YourGround = **overlays only**, not in Day/Night index. Fountains + benches sit in the Day (Heat & Shade) stream for scoring; still useful as map overlays for “along the way.”

## Spec (source of truth for this slice)

→ [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md)

Loop backtracks + map UX notes (snip feasibility, Google-like chrome, focus order):

→ [`LOOP_BACKTRACK_AND_MAP_UX.md`](LOOP_BACKTRACK_AND_MAP_UX.md)

## Focus next (recommended)

1. **Loop quality lock** — keep Loop = circuits only; prefer rejecting ugly cul-de-sac spurs over showing them as Recommended  
2. **Map route chrome** — selected = stronger / dotted; alternatives quieter; tap path (then chips) to select  
3. **Backtrack snip spike** — optional geometry cleanup for short reverse spurs (technical; after 1–2)  
4. Shareable A→B + “Why this walk?”  
5. Colour / brand polish  

## Build sequence

1. ✅ Entry chooser + A→B + overlay show + one-way outing test  
2. ✅ Around here Loop / there-and-back / one-way (+ circuit sizing fix)  
3. ✅ Soft amenity bias when outing checkboxes are on  
4. Loop quality + map chrome (in progress / next)  
5. Shareable link + “Why this walk?”  
6. Colour / brand polish  

Sprint framing: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint D+. Backlog: [`BACKLOG.md`](BACKLOG.md) N1b.
