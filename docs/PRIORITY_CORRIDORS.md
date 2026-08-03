# Priority creek / recreational corridors (3 Aug 2026)

Council-flagged off-road walks for Night Index / lighting audit and product testing. Segment IDs collected in the pipeline QA viewer (purple pick list). Scoring snapshot against local `segment_scores.parquet` **v1.1.3** (length-normalised lighting density).

**Related:** [`LIGHTING_DENSITY.md`](LIGHTING_DENSITY.md) · QA pick list in `pipeline/viewer/index.html`

---

## Hallam Creek Trail

**Character:** More urban creek / reserve corridor (includes KM Reedy / Hallam Valley–style stretches).  
**Note:** Segment **78459** is labelled **Berwick Town Centre Trail** in the field but connects into Hallam Creek Trail and is grouped with this inventory for Council testing.

| | |
|--|--|
| **Segments** | 17 (all found in `segment_scores`) |
| **Missing IDs** | none |
| **Total length** | ~11,320 m |
| **Suburbs** | Hampton Park, Narre Warren, Narre Warren South, Berwick |
| **Path class** | 12 footpath · 5 shared use |
| **Median Night display** | 6.3 |
| **Median `score_lighting`** | 35.0 |
| **Median lights / 100 m** | 0.26 |

Sparse lighting on long polygons (e.g. **92240**, dens 0.06 → lighting 35) is exactly what v1.1.3 density was meant to surface.

### Segment IDs (west → east–ish order as collected)

```
90591
74863
97363
75636
82065
88778
78330
75079
84192
83903
80540
92240
83571
77251
84182
78459
72733
```

| segment_id | suburb | class | length_m | night | lighting | dens/100m | notes |
|------------|--------|-------|----------|-------|----------|-----------|--------|
| 90591 | Hampton Park | footpath | 20 | 6.0 | 35 | 0.00 | |
| 74863 | Hampton Park | footpath | 436 | 6.3 | 35 | 0.00 | |
| 97363 | Hampton Park | footpath | 218 | 5.6 | 35 | 0.00 | |
| 75636 | Hampton Park | footpath | 1590 | 6.2 | 35 | 0.13 | long |
| 82065 | Hampton Park | footpath | 288 | 6.9 | 74 | 1.04 | |
| 88778 | Hampton Park | footpath | 61 | 7.4 | 99 | 4.92 | |
| 78330 | Hampton Park | shared_use | 1706 | 5.0 | 35 | 0.18 | long |
| 75079 | Narre Warren | shared_use | 210 | 5.2 | 35 | 0.00 | |
| 84192 | Narre Warren South | footpath | 994 | 8.2 | 99 | 2.31 | |
| 83903 | Narre Warren | shared_use | 195 | 6.3 | 84 | 1.54 | |
| 80540 | Narre Warren | footpath | 29 | 7.1 | 82 | 4.00 | |
| 92240 | Narre Warren | footpath | 1606 | 6.3 | 35 | 0.06 | density case study |
| 83571 | Narre Warren South | shared_use | 1080 | 5.8 | 76 | 0.56 | |
| 77251 | Narre Warren South | footpath | 626 | 7.5 | 83 | 1.76 | |
| 84182 | Berwick | footpath | 775 | 6.0 | 35 | 0.26 | |
| 78459 | Narre Warren South | footpath | 956 | 8.0 | 97 | 1.99 | Berwick Town Centre Trail (grouped) |
| 72733 | Berwick | shared_use | 530 | 5.7 | 35 | 0.00 | |

---

## Eumemmerring Creek Trail

**Character:** Creek trail through Doveton / Eumemmerring / Hallam / Endeavour Hills (more shared-use heavy).  
**Spelling:** Corridor name as provided by delivery; suburb attribute on segments uses **Eumemmerring**.

| | |
|--|--|
| **Segments** | 25 (all found in `segment_scores`) |
| **Missing IDs** | none |
| **Total length** | ~5,437 m |
| **Suburbs** | Doveton, Eumemmerring, Hallam, Endeavour Hills |
| **Path class** | 8 footpath · 17 shared use |
| **Median Night display** | 6.4 |
| **Median `score_lighting`** | 76.4 |
| **Median lights / 100 m** | 0.51 |

Overall denser lighting than Hallam Creek Trail on medians, but several shared-use stretches still sit at lighting **35** (density &lt; 0.3).

### Segment IDs (order as collected)

```
77559
71551
95058
85846
96570
74804
92645
92646
93286
81483
92973
82267
87878
91439
84968
97296
82092
90748
80664
97040
90741
89473
71711
71710
90014
```

| segment_id | suburb | class | length_m | night | lighting | dens/100m |
|------------|--------|-------|----------|-------|----------|-----------|
| 77559 | Doveton | footpath | 382 | 6.2 | 99 | 3.40 |
| 71551 | Doveton | shared_use | 797 | 6.2 | 83 | 0.88 |
| 95058 | Eumemmerring | footpath | 346 | 6.8 | 94 | 4.34 |
| 85846 | Eumemmerring | shared_use | 117 | 4.1 | 35 | 0.00 |
| 96570 | Eumemmerring | footpath | 48 | 7.5 | 84 | 6.00 |
| 74804 | Eumemmerring | shared_use | 498 | 6.4 | 97 | 2.61 |
| 92645 | Eumemmerring | footpath | 14 | 8.0 | 85 | 8.00 |
| 92646 | Eumemmerring | footpath | 14 | 8.2 | 77 | 8.00 |
| 93286 | Eumemmerring | footpath | 41 | 7.4 | 91 | 8.00 |
| 81483 | Doveton | footpath | 27 | 8.4 | 91 | 8.00 |
| 92973 | Doveton | footpath | 94 | 7.4 | 90 | 3.19 |
| 82267 | Endeavour Hills | shared_use | 552 | 4.8 | 35 | 0.00 |
| 87878 | Doveton | shared_use | 188 | 7.3 | 85 | 1.60 |
| 91439 | Hallam | shared_use | 58 | 7.4 | 76 | 1.72 |
| 84968 | Hallam | shared_use | 234 | 7.1 | 76 | 0.43 |
| 97296 | Hallam | shared_use | 386 | 6.0 | 35 | 0.00 |
| 82092 | Hallam | shared_use | 272 | 5.6 | 76 | 0.37 |
| 90748 | Hallam | shared_use | 17 | 6.3 | 35 | 0.00 |
| 80664 | Endeavour Hills | shared_use | 49 | 6.7 | 35 | 0.00 |
| 97040 | Endeavour Hills | shared_use | 319 | 5.9 | 35 | 0.00 |
| 90741 | Endeavour Hills | shared_use | 179 | 6.0 | 35 | 0.00 |
| 89473 | Endeavour Hills | shared_use | 213 | 5.9 | 35 | 0.47 |
| 71711 | Endeavour Hills | shared_use | 197 | 5.4 | 42 | 0.51 |
| 71710 | Endeavour Hills | shared_use | 197 | 7.1 | 78 | 0.51 |
| 90014 | Endeavour Hills | shared_use | 199 | 5.5 | 35 | 0.00 |

---

## How to refresh IDs

1. Open QA viewer → Segment scores on  
2. Purple multi-select along the trail → **Copy IDs**  
3. Paste into this doc (replace the code block)  
4. Re-run a local summary against `segment_scores.parquet` if scores change (e.g. after a scoring patch)

## Next (optional)

- Corridor extract: night / lighting density / low-density flag table for Council  
- Resident OD smoke tests at corridor ends  
- Confirm official naming vs “Hallam Valley Trail” / spelling variants with Council
