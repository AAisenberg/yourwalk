# YourWalk routing — note for Nikki / XYX Lab

**Date:** 16 August 2026  
**App:** YourWalk **0.2.0** (Beta)  
**Audience:** Nicole Kalms (XYX Lab), CrowdLab  
**Product:** YourWalk resident A→B (City of Casey pilot)  
**Repo:** this file is the stakeholder recap. Technical detail stays in [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md) and [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md).

This note records what we built after the last review, why it was harder than “add a second line,” and how to try it. It does **not** reopen Day/Night Index maths (Accessibility 60% + Heat & Shade or Lighting 40%).

---

## 1. What you asked for (plain language)

XYX feedback, in one sentence:

> When I change what matters (shade, footpaths, lighting), I should see **different walks**, and Recommended should look better on that dimension.

Until this week the app mostly **re-ranked the same Mapbox line**. Pills moved. The geometry often did not. That is why a single teal line down Homestead Road felt like the product was ignoring the sliders.

We also heard: do not show a walk down the **middle of the road** when a footpath exists.

---

## 2. What residents see now (when the Casey graph is running)

Find on an A→B trip can return up to three **Casey graph** cards:

| Card | What it is | When it appears |
|------|------------|-----------------|
| **Best for you** | The walk that best matches the sliders you set before Find | Always, if a path-safe Casey walk exists |
| **Smoother footpaths** / **More shade** / **Better lighting** | A **different** neighbourhood walk on the footpath network, so you can compare | When the streets actually offer a second path-safe corridor |
| **Away from roads** | A longer park / trail option | Only if you tick Prefer away from roads |

We do **not** invent a second walk when the network only has one (short cul-de-sac hops such as Fairmead → Hopwood). One honest card is better than a junk clone.

Mapbox is still used for search and as a fallback. On Cupples → Ashfield we **hide** Mapbox when it is the same corridor drawn on the carriageway.

**You must tap Find again** after changing sliders or the away-from-roads tick. Dragging sliders on the results list only re-orders the cards already found.

---

## 3. How each control changes the walk

This is the explainer XYX asked for. Scores on the pills stay Casey corridor scores. Preferences change **which line we search for** and **which card is Recommended**.

| Control | What it does | What it does not do |
|---------|--------------|---------------------|
| **When: Day / Night** | Day uses Footpaths + Heat & Shade. Night uses Footpaths + Lighting. | Does not change Index maths (still 60/40). |
| **Accessible footpaths** (more important) | Search prefers smoother, more continuous, better-crossing paths. On Cupples → Ashfield that is Bellevue / Fieldhouse (and sometimes McNaughton), not the shortest Homestead edge. | Does not mean “worse shade.” It means footpath quality matters more than time. |
| **Heat & Shade** (more important) | Search prefers cooler, shadier corridors. On Cupples → Ashfield that stays on north Homestead and the west Ashfield park edge. | Does not guarantee trees the whole way. |
| **Lighting after dark** (night) | Same idea as shade, using the night stream. | Not a safety guarantee. |
| **Both sliders toward less important** | Time matters more when **ranking** the cards we already have (~78% quicker). Search still stays on the footpath network. | Does **not** switch on a “shortest including alleys” mode. Pure graph-shortest is the service-lane cut we refuse to show. |
| **Prefer away from roads** | A third search: parks and trails, up to about 1.6× longer. Honest copy: “About N minutes longer, mostly away from roads.” | Not on by default. It is “I will take a detour,” not “show two cards.” |
| **Along the way** (toilets, dog bags, benches, fountains) | Map overlays. Soft ranking on Around here only. | **Not in the Day/Night index.** |

### Worked example: 66 Cupples Crescent → 2 Ashfield Drive, Berwick

This is the walk we used in review (OD-12).

| Setting | Recommended | Second Casey card |
|---------|-------------|-------------------|
| Default (Heat & Shade high, Footpaths mid, away off) | North-side Homestead, then west Ashfield through the reserve (~1.9 km) | Bellevue Drive → Fieldhouse Lane (~2.1 km), labelled Smoother footpaths |
| Footpaths max, Heat & Shade low | The Bellevue / Fieldhouse walk | Homestead as the contrast |
| Prefer away from roads on | Same two, plus a ~2.3 km park / trail card | The green line that ducks into Old Cheese Factory |

Why the smoother walk uses McNaughton Crescent instead of sharing Homestead to Bellevue: McNaughton’s footways score about **84** on Accessibility; Homestead’s cycleway about **76**. Under “footpaths matter,” a 170 m longer crescent is still the cheaper search. That is a genuine alternative, not a bug. We kept it.

---

## 4. Complexity we worked through (so the simple cards are honest)

Each of these looked like a small tweak and was not.

1. **Road vs footpath cost.** OSM often has both a road centreline and a sidewalk. Without a 1.5–2× cost on roads, Dijkstra walks the road. Rebuild required.

2. **Crossings.** Homestead’s north side was unreachable until we added short edges at OSM crossing nodes (routing only; not a scoring input; Council crossing gap unchanged).

3. **No junk fallback.** If a search went a bit long, we used to fall back to “graph shortest.” On this OD that is a service / residential alley. We now keep a highway-biased footpath, or we omit the extra card.

4. **Two Casey cards, not an inverted clone.** First we tried “leave the first street at any cost.” That produced a zigzag up Burndon Close and along the **north** side of Centre Road (school side), then back. We dropped the prefix penalty. The useful pair is Homestead vs Bellevue / Fieldhouse.

5. **Not “quickest” as the second card.** On Cupples and on Carranya → Robinswood, the useful second walk is **longer**. Quickest is already what low importance does. Making it the complement would hide Bellevue and Promenade’s street alternative.

6. **Mapbox vs Casey.** A Mapbox line that looks like Bellevue must not hide the Casey Bellevue card. Casey wins; the carriageway twin is dropped.

7. **Side of street (still open).** OSM has **both** Ashfield footways. After Homestead the straight-ahead path is the west park link. Away-from-roads still hops east, then crosses at Jason Close (a real OSM sidewalk around the T, chasing shade and the park). Paint cannot fix that. Next graph work is heading-continuity at crossings. T1EAM-native edges remain the durable fix for which side of the road Casey’s own footpath sits on.

---

## 5. Tests we ran (16 August 2026)

| Test | Result |
|------|--------|
| OD-12 default | North Homestead via Liara roundabout, 1,891 m, 100% pathish |
| OD-12 complement | Bellevue / Fieldhouse, 2,087 m, 100% pathish, distinct |
| OD-12 away | ~2,324 m park / trail, 1.31× |
| OD-12 shade + away over cap | Falls back to Homestead, **not** the alley |
| OD-12 plan cards | Casey only (Mapbox centreline hidden) |
| Dual Casey battery (13 bake-off ODs) | **5** get two Casey cards (OD-01, 02, 08, 12, Epsom→Arubi). **8** honestly get one (including OD-11 Fairmead). OD-09 complement omitted (long park-edge, over cap). |
| Weave / carriageway | Existing no-weave and OD-CARRIAGE-01 gates kept |

Replay locally (challenger on `:8790`, app on `:3001`):

```bash
cd web
YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/verify-od12-homestead.ts
YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/smoke-dual-casey.ts
```

---

## 6. How to try it (local)

The Casey graph is a **second process**. Without it, the phone or laptop silently shows Mapbox only.

```bash
./scripts/dev-up.sh
./scripts/dev-status.sh
```

Open the URL the script prints (often `http://localhost:3001` if CrashDash owns `:3000`).

**Demo walk:** 66 Cupples Crescent, Berwick → 2 Ashfield Drive, Berwick. Set Heat & Shade high, leave Prefer away from roads off, tap **Find**. You should see two Casey cards. Tick away and Find again for the third.

**Production / phone:** Vercel does not yet host the challenger (`CHALLENGER_URL` still open). A production deploy of the Next app **without** that service will not show these Casey cards. Fastest phone check is the local stack on the same Wi-Fi, or a hosted challenger first. See [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md) §6.

---

## 7. What we are not claiming

- Not a safety guarantee. No crime prediction. Graffiti stays an environmental-order proxy.
- Missing Council crossings and kerb ramps still mean **reduced confidence**, never imputed as zero.
- Two cards are not promised on every trip. The network has to allow a second path-safe corridor.
- The Walking Planner HTML (parallel UX audit) is a separate design pass. This note is routing behaviour.

---

## 8. Suggested next (after this commit)

1. Host the challenger so Nikki and you can test on a phone against a preview URL.  
2. Side-of-street / heading-continuity (Ashfield, Jason Close, Burndon).  
3. T1EAM-native geometry for paint and side-of-road truth.  
4. Plain-language “How your choices change the walk” in the resident sheet (copy drafted in `preferences.ts`; Walking Planner UX can take it further).  
5. Outing (Around here) preference bias (P4).

---

## Related repo paths

| Doc | Role |
|-----|------|
| [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md) | Spec: sliders must change geometry |
| [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md) | What lines we are allowed to draw |
| [`DECISIONS.md`](DECISIONS.md) | ADR-001 + Track 0 |
| [`BETA_TESTER_BRIEF.md`](BETA_TESTER_BRIEF.md) | How to try the beta |
| [`BACKLOG.md`](BACKLOG.md) N1c | Status |
| `web/scripts/smoke-dual-casey.ts` | 13-OD dual-card battery |
| `web/scripts/verify-od12-homestead.ts` | Cupples → Ashfield acceptance |
