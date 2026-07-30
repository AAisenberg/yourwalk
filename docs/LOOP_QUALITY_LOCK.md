# Loop quality lock — spec (30 Jul 2026)

**Goal:** Under Around here → **Loop**, residents only see real circuits near the asked time, with fewer ugly cul-de-sac spurs in Recommended. Map chrome (selected vs alternatives) comes **after** this lock.

Parent notes: [`LOOP_BACKTRACK_AND_MAP_UX.md`](LOOP_BACKTRACK_AND_MAP_UX.md) · Flow: [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md)

---

## In scope

1. **Circuits only** when shape = Loop (no there-and-back mixed into the card list).
2. **Duration fit** — options roughly match ~15 / 25 / 40 min (existing via sizing; tighten ranking toward target).
3. **Fewer ugly spurs** — detect short reverse stubs; prefer rejecting or demoting them over showing as Best for you.
4. **Several different loops** when the network allows (geometry-diverse), else 1 honest circuit is OK.
5. **Match ring agrees with card order** (`match_score` from outing rank).

## Out of scope (this lock)

- Geometry **snip** of backtracks (spike later)
- Google-like dotted/selected map chrome (next slice after lock)
- Challenger-only loop engine
- Open in Apple/Google Maps

---

## Acceptance (Given / When / Then)

### LQ-1 Circuits only
**Given** Around here + Loop + a Casey start  
**When** walks are returned  
**Then** every card is a closed circuit (end near start)  
**And** no card is labelled or noted as “Same path home” unless we found *zero* circuits and surface a clear empty/error (“Try There and back”)

### LQ-2 Duration band
**Given** asked duration N (chips today; slider later)  
**When** walks are returned  
**Then** each option’s walking time is within **±5 minutes** of N  
**And** ranking prefers closer to N  
**And** we never widen the band to fill empty cards

### LQ-3 Spur demotion
**Given** two valid circuits, one with a clear cul-de-sac reverse spur (&lt; ~150 m out-and-back notch)  
**When** both are candidates  
**Then** the cleaner circuit ranks above the spurred one when preference/duration fit are similar  
**And** Recommended is not the spurred option if a cleaner peer exists

### LQ-4 Diversity
**Given** geometrically distinct circuits pass filters  
**When** results show  
**Then** prefer **2** cards; add a **third** only if still in ±5 and quality holds  
**And** secondary cards may read “Another loop”

### LQ-5 Honest empty
**Given** no circuit passes filters from this start  
**When** Find my walk runs  
**Then** show an error / empty state suggesting There and back or another start  
**And** do not silently fill with out-and-backs under Loop

---

## Engineering lean (implement next session)

| Lever | Action |
|-------|--------|
| Via sizing | Keep `LOOP_VIA_STRAIGHT_FACTOR`; retry smaller vias if pool empty |
| Reverse / revisit | Keep filters; add **spur score** (length of reverse notches) as demotion tiebreak |
| Ranking | `outingMatchScore` (prefs + fit-to-N); circuit quality / spur score as tiebreak only — never inflate match above Shortest falsely |
| Fallback | Empty state under Loop; user switches shape deliberately |
| QA | Manual: Hampton Park ~15 & ~40; Waratah South / creek loop; one mid-block start |

**Snip:** defer — detect/demote first; snip spike only if demotion still leaves ugly Recommended lines.

---

## Done when

- [x] Implement spur measure + reject/demote + Loop-only empty error (30 Jul)  
- [ ] LQ-1…LQ-5 pass on two Casey starts × 15 and 40 min (**manual review**)  
- [x] No Loop result set mixes there-and-backs  
- [ ] Stocktake in [`RESIDENT_UX_NEXT.md`](RESIDENT_UX_NEXT.md) marks loop quality lock ✅ after review  
- [ ] Then start **map selected / alternative styling**

**Sanity:** `cd web && node scripts/check-spur-measure.mjs`

---

## Session handoff

**Implemented:** spur measure (gentle demotion; only extreme spurs rejected), duration band ~0.6–1.55×, Loop empty copy, diversity softened so **2–3 circuits** are likelier; retry extra via radii when the pool is thin. Edge-of-Casey starts may still fail honestly.  

**After review:** map chrome slice.
