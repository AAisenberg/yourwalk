# Resident UX — next (30 Jul 2026 stocktake)

Pilot routing and preference ranking are in good shape. Next work puts the **user journey** first; colour / brand polish follows once the flow sticks.

## Where we are

| Capability | Status |
|------------|--------|
| A→B hybrid routes (Mapbox + neighbourhood score-aware) | Shipped |
| Day / Night + importance sliders (dynamic efficiency) | Shipped |
| Match score = Recommended; preference stream tiebreaks | Shipped |
| Calculating spinner + faster corridor scoring | Shipped |
| Lab OD jumper + bake-off compare | Shipped |
| Outing (~N min from here) | Not built — next |
| Amenity overlays (toilets, dog bags, benches, fountains) | Data largely available; UI not wired |
| Brand / colour system | Deferred until flow is solid |

Methodology reminder: toilets, dog bags, YourGround = **overlays only**, not in Day/Night index. Fountains + benches sit in the Day (Heat & Shade) stream for scoring; still useful as map overlays for “along the way.”

## Spec (source of truth for this slice)

Full flow, acceptance criteria, open questions, and no-account enhancers:

→ [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md)

```text
1. When? Day / Night + what matters (importance — built)
2. How? A to B  |  Around here (~15 / 25 / 40 min)
3. Along the way? □ Toilets □ Dog bags □ Benches □ Fountains
4. Results → Use this route → Open in Maps / share link (no account)
```

## Build sequence

1. Entry chooser wrapping today’s A→B  
2. Overlay checkboxes + map markers  
3. Outing (~N min) vertical slice  
4. Open in Maps + shareable link + “Why this walk?”  
5. Colour / brand polish  

Sprint framing: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint D+. Backlog: [`BACKLOG.md`](BACKLOG.md) N1b.
