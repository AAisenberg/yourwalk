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

## Proposed entry: “Tell us about your walk”

```text
1. Day or Night walk?
2. What matters? (importance — already built)
3. How are you walking?
   ├─ A to B → From / To → Find routes (current)
   └─ Around here → Start + ~15 / 25 / 40 min → Outing options
4. Along the way? □ Toilets □ Dog bags □ Benches □ Fountains
5. Results → Use this route
```

## Why this order

- Residents often want a **local walk**, not only a destination.
- Overlays answer “what’s useful along the way” without polluting the index.
- Keeps hybrid ranking as the engine under both trip and (later) outing.

## Build sequence

1. Entry chooser wrapping today’s A→B (low risk).
2. Overlay checkboxes + map layers.
3. Outing mode (L2b / N1b).
4. Colour / brand pass.

Detail and sprint framing: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint D+. Backlog: [`BACKLOG.md`](BACKLOG.md) N1b.
