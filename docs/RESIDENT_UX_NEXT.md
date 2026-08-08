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
| Prefer shared paths (soft rank bias, not index) | Shipped (testing) |
| Loop quality lock (spur demote / reject, empty state) | Shipped (testing) |
| Google-like selected/alternative map chrome | Shipped (testing) — dotted selected, quieter alts, tap path |
| Backtrack spur snip on loops | Not built — see notes |
| Brand / colour system | In progress — [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md) |

Methodology reminder: toilets, dog bags, YourGround = **overlays only**, not in Day/Night index. Fountains + benches sit in the Day (Heat & Shade) stream for scoring; still useful as map overlays for “along the way.”

## Spec (source of truth for this slice)

→ [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md)

Loop backtracks + map UX notes (snip feasibility, Google-like chrome, focus order):

→ [`LOOP_BACKTRACK_AND_MAP_UX.md`](LOOP_BACKTRACK_AND_MAP_UX.md)

## Focus next (recommended)

1. ~~Desktop panel + Beta chrome~~ — left panel ≥ md; Beta pill + versions; see [`BETA_TESTER_BRIEF.md`](BETA_TESTER_BRIEF.md)  
2. Shareable A→B + “Why this walk?”  
3. **Backtrack snip spike** — optional geometry cleanup for short reverse spurs  
4. Custom domain / production cut when ready for wider Casey testing

## Build sequence

1. ✅ Entry chooser + A→B + overlay show + one-way outing test  
2. ✅ Around here Loop / there-and-back / one-way (+ circuit sizing fix)  
3. ✅ Soft amenity bias when outing checkboxes are on  
4. ✅ Loop quality + map chrome (dotted selected, quieter alts, tap path)  
5. Colour / brand polish — see [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md)  
6. Shareable link + “Why this walk?”  

Sprint framing: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint D+. Backlog: [`BACKLOG.md`](BACKLOG.md) N1b.
