# L2c bake-off results - 17 Jul 2026

**Harness:** `pipeline/bakeoff/` (OSM + Casey Dijkstra vs Mapbox post-hoc) 
**Lab UI:** `/lab` → Score-aware bake-off panel (loads `web/public/bakeoff/compare.json`) 
**Raw runs:** `pipeline/data/bakeoff/results/bakeoff_20260717_0650_{day,night}.*` (gitignored)

## Why Day favoured Challenger but Night favoured Mapbox (v1)

This was the main puzzle from the first full run. It is mostly **score distribution + cost model**, not a methodology conflict.

| | Day Index on OSM edges | Night Index on OSM edges |
|--|------------------------|--------------------------|
| Mean | **62** | **78** |
| Std | **7.2** | **6.1** |
| p10-p90 | 53-72 | 71-84 |

**What that means**

1. **Night sits high and compressed.** Lighting + shared Accessibility lift most Casey corridors into a “pretty good” band. Relative differences between edges shrink.
2. **v1 cost used absolute 0-100.** Multipliers for Night p10 vs p90 barely moved (dynamic range ~0.13 vs ~0.16 for Day). Night pathfinding collapsed toward **shortest path**.
3. **Mapbox is strong at shortest sensible walks.** When the challenger stops differentiating on quality, Mapbox wins the Night scoreboard.
4. **Day has more spread** (heat/shade). Score-aware had something to optimise, so it won more Day ODs.
5. **Methodology is fine.** Night Index is not “wrong”; the **routing cost** under-used Night variation. Day/Night still share Accessibility 60% (edge corr ~0.43).

**v2 fix (same day):** percentile-normalise Day and Night into 0-1 using p10-p90 so both modes get equal cost swing; soft-cap detour at **1.15×** graph-shortest.

After v2, **Night challenger wins 7/10** (was 2/10). Day stays competitive (5/10). That supports the diagnosis: Night was a cost-sensitivity issue, not “Mapbox understands night better.”

## Headline (v2 - percentile costs)

| Mode | Challenger | Mapbox | Tie |
|------|------------|--------|-----|
| Day | 5 | 5 | 0 |
| Night | **7** | 3 | 0 |

Score-aware is viable for the north star. Gains are often +0.1-0.5 /10 with modest detours. **OD-05** still loses with ~1.25× vs Mapbox - likely **OSM network gap** (graph-shortest is already long), not cost wander.

**ADR-001 lean:** keep Mapbox trip mode shipping; **hybrid** (Mapbox + score-aware alternative) remains the pilot recommendation. Cost v2 makes Night credible enough to keep investing.

## Day v2

| OD | Mapbox best | Challenger | Δ | Detour | Winner |
|----|------------:|-----------:|----:|-------:|:-------|
| OD-01 | 5.67 | 5.60 | −0.07 | 1.00 | mapbox |
| OD-02 | 5.48 | 5.78 | +0.30 | 1.08 | challenger |
| OD-03 | 5.42 | 5.27 | −0.15 | 1.00 | mapbox |
| OD-04 | 6.40 | 6.30 | −0.10 | 0.94 | mapbox |
| OD-05 | 6.53 | 6.37 | −0.16 | **1.25** | mapbox |
| OD-06 | 7.21 | 7.37 | +0.16 | 0.97 | challenger |
| OD-07 | 6.05 | 6.19 | +0.14 | 0.99 | challenger |
| OD-08 | 5.48 | 5.71 | +0.23 | 1.02 | challenger |
| OD-09 | 5.72 | 5.24 | −0.48 | 0.81 | mapbox* |
| OD-10 | 6.29 | 6.71 | +0.42 | 0.98 | challenger |

\*OD-09: Mapbox Day higher but coverage 0.52; challenger much shorter with better coverage.

## Night v2

| OD | Mapbox best | Challenger | Δ | Detour | Winner |
|----|------------:|-----------:|----:|-------:|:-------|
| OD-01 | 8.07 | 8.27 | +0.20 | 1.09 | challenger |
| OD-02 | 6.50 | 7.01 | +0.51 | 1.12 | challenger |
| OD-03 | 7.09 | 6.90 | −0.19 | 1.01 | mapbox |
| OD-04 | 7.56 | 7.47 | −0.09 | 0.95 | mapbox |
| OD-05 | 7.77 | 7.60 | −0.17 | **1.25** | mapbox |
| OD-06 | 8.07 | 8.13 | +0.06 | 0.97 | challenger |
| OD-07 | 8.12 | 8.19 | +0.07 | 0.99 | challenger |
| OD-08 | 7.57 | 7.67 | +0.10 | 1.02 | challenger |
| OD-09 | 7.21 | 7.53 | +0.32 | 0.84 | challenger |
| OD-10 | 7.52 | 7.77 | +0.25 | 1.02 | challenger |

OD-01 night ~8.1-8.3 aligns with the resident **After dark ~8.1** Promenade card.

## Lab testing

1. Run `web` locally (or preview).
2. Open `/lab`.
3. Use **Score-aware bake-off**: pick OD, Day/Night, toggle Mapbox (sky) vs Score-aware (violet).
4. Choropleth follows Day/Night mode.
5. Refresh data after a new harness run: `python bakeoff/export_lab_compare.py`

## Next

1. OD-05 network audit (why OSM path ≫ Mapbox).
2. Preference-weighted costs (after dark / accessible / shade).
3. Optional resident hybrid: Mapbox candidates + one score-aware alt.
4. GraphHopper packaging when weights feel stable.

## Reproduce

```bash
cd pipeline && source .venv/bin/activate
python bakeoff/build_graph.py
python bakeoff/run_bakeoff.py --mode day
python bakeoff/run_bakeoff.py --mode night
python bakeoff/summarise_results.py day
python bakeoff/export_lab_compare.py
```
