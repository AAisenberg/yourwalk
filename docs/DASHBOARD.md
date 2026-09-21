# Council insights dashboard

**Status:** Spec (20 Sep 2026). Sitting 2 brief added 21 Sep 2026. Not built. Host `dashboard.yourwalk.au` does not exist yet (ADR-012).  
**Audience:** City of Casey staff first (transport, urban design, assets, inclusion, grant sponsor). Not residents.  
**Build SoT for this surface:** this document. Older FLOW / REQS / mockup are inputs.

Product name: **YourWalk** (one word). Australian English. WCAG 2.1 AA. Mapbox GL JS only (ADR-002). No em dashes in dashboard copy.

The May 2026 HTML mockup (`council-dashboard-mockup/`) is a workshop artefact. Do not implement it as the product. Keep its useful layout ideas. Replace its score model, language, type, and colour story.

## Job

Give Casey officers a shared, honest picture of **where the walking network is stronger or weaker**, so they can brief, compare suburbs, and later prioritise investment.

The dashboard answers:

1. Where are Day or Night walking conditions weaker in Casey?
2. Is that mainly footpaths, heat and shade, or lighting after dark?
3. How confident are we, and how old is the evidence?
4. (Later) Where do weaker conditions overlap community need or named corridors?

It does **not** tell Council what to build. The Connecting Grant excludes prescriptive infrastructure advice. Scores describe conditions in the data. They are not a safety guarantee and not crime prediction.

## Before we build (D0)

Write this spec first (done). Then do these **before** Next.js on `dashboard.yourwalk.au`:

| Step | Why | Blocker? |
|------|-----|----------|
| Design sitting from this spec (not the old mockup) | UX and styling are the product for staff who live in GIS, Word, and briefing packs | Yes for D1 chrome |
| One Casey officer walkthrough (transport or assets) | Confirm suburb-first language, default Day index, and what they would screenshot | Strongly preferred |
| Nikki / XYX language pass | No combined index, no “risk”, no safety promise | Preferred |
| Decide D1 access (DB-1) | Host must not leak onto the front door or planner | Yes before DNS |
| Confirm we will not wait on crossings / kerbs | Score with reduced confidence; do not impute zero | Already locked in methodology |

Do **not** wait on: Clerk, community submissions (N4), YourGround licensing, SEIFA ingest, PDF export, or a second Vercel project.

Do **not** treat `/lab` as the Council prototype. Lab is a delivery inspector. It may share data APIs. It must not share chrome, IA, or “internal tool” density.

## Audience and jobs to be done

Staff use desktop (or a large laptop) in a bright office. They need to find a place, read a score, and paste a screenshot or CSV into a briefing. They are not planning a personal walk.

| Role | First question | D1 must help | Later |
|------|----------------|--------------|-------|
| Transport / urban design | Where is the network weaker, and why? | Ranked suburbs + stream breakdown | Corridors, exports |
| Assets | Which paths look poor next to our own layers? | Segment paint + provenance | Road responsibility, asset join |
| Inclusion / Later in Life | Where is it hard to walk *and* who lives there? | Honest conditions map | Community Need overlay (D2) |
| Grant sponsor | Can we show a partner-ready evidence picture? | Day/Night map + sources | Ranked priority zones (D3) |

Resident needs stay on `app.yourwalk.au`. Press stays on `yourwalk.au`.

## Relationship to other surfaces

| Surface | Job |
|---------|-----|
| `yourwalk.au` | Public front door. No dashboard. |
| `app.yourwalk.au` | Resident planner. No Council chrome. No login. |
| `dashboard.yourwalk.au` | This product, when D1 ships. |
| `/lab` | CrowdLab / XYX inspector. No public hostname. Not linked from the dashboard header. |
| `pipeline/viewer` | Ingestion QA. Local only. |
| `council-dashboard-mockup/` | Historical workshop visual. Reference only. |

One Vercel project (`yourwalk`, root `web/`). Host-based routing, same pattern as the front door (ADR-012). Split to a second project only if dashboard auth later needs a hard isolation boundary.

## Locked (do not reopen unless you say so)

Methodology and hosts are already accepted. The dashboard must follow them.

- **Two indexes, not one.** Day = Accessibility 60% + Heat and shade 40%. Night = Accessibility 60% + Lighting / after dark 40%. There is no combined “Vulnerability index” number.
- **Higher score = better walking conditions.** Do not invert the scale for “risk”.
- **Primary paint unit:** T1EAM footpath segments already scored in PostGIS (~27k eligible).
- **Roll-up:** length-weighted mean of the selected index. Suburb is the D1 default list and search unit (how Casey talks). Ward and SA2 are sitting-2 tests (DB-11). Do not ship a multi-scale switcher in D1 unless the officer uses it. SA2 remains the ABS / Community Need unit (ADR-008).
- **Overlays never change the index.** Toilets, dog bags, YourGround, SEIFA, demographics, and road responsibility stay out of the score. Street lights and park lights are Night Index evidence. Fountains and benches already sit in the Day Index (Heat and shade). Showing them as points is context, not a recalculation.
- **Pending Council data** (general crossings, kerb ramps): reduced confidence. Never impute missing as zero.
- **Mapbox GL JS only.** No MapLibre.
- **Casey logo is never used.** City of Casey in type only (same rule as the front door).
- **No login on `yourwalk.au` or `app.yourwalk.au`.** Dashboard auth is this host only. Clerk is Later (L1).
- **Do not add `dashboard.yourwalk.au` DNS until D1 build starts.**
- Visual tokens and type from [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md). No new brochure palette. No Inter-by-default (the old mockup used Inter). No purple gradients, cream terracotta, neon, or emoji chrome.

## What to keep from the mockup

Useful, keep:

- Desktop, map-first, three-column workstation (filters / selected area | map | ranked list)
- Theme chips as a *later* filter (Lighting, Footpaths, Heat and shade), not as a replacement for Day/Night
- Selected-area card with stream bars
- Data-source list with vintage (heat 2018 must stay visible)
- Search for a suburb (and later a street)
- Quiet City of Casey location badge, type only
- Later-phase idea of more than one geography. Sitting 2 tests Suburb | Ward | SA2. D1 ships suburb-only unless the officer uses the others.

Do **not** copy:

| Mockup | Why not |
|--------|---------|
| One “Vulnerability index” 70/100 | Contradicts ADR-009 |
| “High risk” badges | Safety / crime implication |
| High number = worse (deficit) | Locked direction is the opposite |
| Always-dark Inter chrome | Not the live visual system; poor for office print and older staff |
| Pink = critical hotspot dots | Pink is the resident To pin, not a danger colour |
| “Vicmap footpaths” as the path source | Master network is Casey Footpaths (T1EAM) |
| Corridors and Priority Zones as empty tabs | Those are D2/D3. Do not ship dead chrome |
| Fake live/aged dots on every dataset | Only claim what the pipeline actually loaded |
| Export as a first-cut button that does nothing | Either ship CSV in D2 or omit the control |

## Visual system (dashboard)

Styling is a first-class requirement, not a polish pass. Council staff will judge trust from type, contrast, map legend, and whether a screenshot looks like YourWalk or like a generic dark BI tool.

### Inherit, then specialise

| Token / rule | Use |
|--------------|-----|
| Brand hex | `--yw-blue` `#27AAE1`, `--yw-navy` `#292984`, `--yw-teal` `#00AAA6`, `--yw-lime` `#8DC63F`, `--yw-green` `#009444`, `--yw-amber` `#FFCB1F`, `--yw-orange` `#F6871F`, `--yw-pink` `#EC008C` |
| Surfaces | Day default: `--yw-day-surface` `#F5F7FA`, white panels, navy CTA |
| Type | Plus Jakarta Sans 400–800 (`--font-yourwalk`). Geist Mono only for IDs / spec versions in a provenance footer |
| Icons | `react-icons/md`: `MdWbSunny` / `MdNightlight` for the index switch, same as the planner |
| Mark | `web/public/brand/yourwalk-mark.svg` + **YourWalk** wordmark. Subtitle: **Council insights** · City of Casey |
| Beta | Quiet Beta pill, same as planner. Show `scores {scoring_spec_version}` |

Night is a **walk-mode index**, not a designer dark-mode default. Officers work in daylight.

**Locked lean chrome:** the dashboard shell stays on **day surfaces** so screenshots print and contrast holds in a meeting room. Switching to Night changes the **map** (`lightPreset` dusk/night), the stream labels (After dark instead of Heat and shade), and the colour-ramp title. It does not flip the whole workstation to `#0B0C1A`. A full Night chrome matching the planner is an open question (DB-2), not D1.

### Map

- YourWalk Standard style (`mapbox://styles/crowdspot1/cmsve8sql00ak01rgb6vn39pt`) plus `lightPreset`. Classic `streets-v12` / `dark-v11` fallback only.
- **Optional satellite** (sitting 2 / DB-10): Standard / Satellite lives in the Layers circle, not as a second map switch. Mapbox satellite or satellite-streets. No Nearmap promise. No stack of Council GIS basemaps in D1. Satellite is a basemap, not a Night look. Do not auto-switch to satellite when someone picks Night.
- **When satellite is on:** drop choropleth opacity, or paint scores as quiet lines, so poles and paths stay readable. Full colour fill on aerials is mush.
- **Segment choropleth is the hero.** This is the opposite of the resident planner (no score paint on `/`). Officers came for evidence, not for A to B.
- Colour ramp: Casey-stretched, same family as `/lab`. Legend: **Lower score = weaker conditions** on the left, **higher = better** on the right. Never “Low / High vulnerability” without saying conditions.
- Hide Mapbox POIs. D1 Layers lean (DB-9): street lights, park / reserve lights, drinking fountains, benches, toilets, dog bags. Default off.
- Casey LGA outline. Selected-area boundary for the active View by unit.
- No neon path network. T1EAM pavement polygons are scoring geometry; prefer centrelines or a quiet fill that still reads as a path, not a parcel shard.

### Layout (desktop first)

Target: **1280px and up**. Tablet (1024) must remain usable (stack the right list under the map). Phone is a read-only fallback: map + one selected-area card. Do not design D1 as a mobile bottom sheet.

```
header: mark · YourWalk · Council insights · Day/Night · City of Casey · Beta
left (~20rem): View by (sitting 2) · selected-area card · sources
centre: map + search + Layers circle (basemap + overlays) + legend + visible-count
right (~22rem): ranked list for the selected index and View by unit
```

**Layers chrome (lean):** CrashDash pattern. A 44px circular Layers button sits on the map (top left). It expands to a float menu: Basemap (Standard / Satellite) then overlay toggles. Closed by default. A small count badge shows how many overlays are on. YourWalk tokens (white / navy / teal), not CrashDash purple. View by stays in the left column. It is a list geography, not a map overlay.

One job per block. No stats-strip of invented “3 high priority / 7 medium” until D3 defines priority.

### Motion and density

- Short Day/Night map transition. Honour `prefers-reduced-motion`.
- No carded marketing heroes. Cards only for selected area and ranked rows.
- Hover on a suburb row previews the boundary. Click selects. Keyboard: list is a `listbox` or equivalent.

### Screenshots into Council tools

Assume the primary “export” in D1 is **a clean browser screenshot** into Word or PowerPoint. That means:

- Legend and index state visible without hover
- No overlapping toast
- Wordmark + “City of Casey” + score spec in frame
- Colour not the only encoding (rank number + numeric score on every row)

## How to read a score

| Layer | Scale | Where |
|-------|-------|--------|
| Selected index on the map | 0–100 stored, painted continuously | Segment choropleth |
| Suburb / SA2 roll-up | 0–10, one decimal (same as resident pills) | Ranked list and selected card |
| Stream breakdown | 0–100 (scoring spec §3) | Selected-area bars: Footpaths (Accessibility), Heat and shade or After dark |

Copy next to the first score: **Higher is better walking conditions.** Repeat on the legend.

Selected card shows **two** numbers only: the selected index (0–10) and the three stream bars (0–100). Never a fourth “combined index”.

Weak-stream tags on a ranked row (for example “Lighting”) mean that stream is **below the Casey median for that stream**, not that residents filed issues there.

### Layers (D1 lean)

Default off. Same amenity colours as the resident planner. Street / park lights use the `/lab` evidence colours. Officers open them from the circular map button, not from the left rail.

| Layer | In the index? | Copy next to the toggle |
|-------|---------------|-------------------------|
| Street lights | Night Index evidence | Night Index evidence. Toggle does not change the score. |
| Park / reserve lights | Night Index evidence | Night Index evidence. Toggle does not change the score. |
| Drinking fountains | Day Index (Heat and shade) | In the Day Index as heat and shade amenity. Shown as points. |
| Benches | Day Index (Heat and shade) | In the Day Index as heat and shade amenity. Shown as points. |
| Toilets | No | Overlay only. Not in the index. |
| Dog bags | No | Overlay only. Not in the index. |

Community Need / SEIFA stays D2 (DB-5). YourGround stays later.

## What a hotspot is (pilot)

Until community submissions exist, a hotspot is **not** “issue density”.

**D1 definition:** a suburb whose length-weighted mean of the **selected** index is among the weaker in Casey. Rank ascending (weakest first). Show segment count and a confidence note when coverage is thin.

**D2:** same idea for a named corridor (for example Hallam Creek Trail) using the segment inventories in [`PRIORITY_CORRIDORS.md`](PRIORITY_CORRIDORS.md).

**D3:** a **priority zone** is a place we can defend in a grant table: weaker conditions, plus optional Community Need overlap, plus data confidence. Factors stay visible. Still not a “build this” instruction.

## Data contract (D1)

Reuse the Sprint A load. Do not invent a second scoring model.

| Need | Source |
|------|--------|
| Segment scores | `segment_scores` / map-data GeoJSON already used by `/lab` |
| Fields | `day_index_score`, `night_index_score`, `accessibility_score`, `heat_shade_score`, `lighting_after_dark_score` (or current lighting column), `confidence_*`, `suburb`, `ward`, `length_m`, `score_eligible`, `scoring_spec_version`, `data_vintage` |
| LGA outline | `casey_lga_boundary.geojson` |
| Suburb focus | Existing suburb attributes + fit-bounds (same idea as `/lab`) |
| Provenance | Heat 2018, canopy 2019/2020, lights vintage, missing crossings/kerbs, methodology v1.1 |

D1 does **not** require new ingest. Street lights, park lights, and resident amenity GeoJSON already exist for `/lab` and the planner. Community Need (SEIFA 2021 on Casey Open Data at SA2) and road responsibility stay D2 data tasks.

Aggregation: length-weighted mean of eligible segments (`score_eligible = true`). Do not treat ineligible rows as zero.

## Phases

Grant language (CCLL): Q3 tool and dashboard; Q4 ranked priority zones, visualisations, downloadable datasets; Q4–Q5 finalise maps and dashboard. Grant **excludes** commercialisation, long-term management, and prescriptive infrastructure advice. Beyond-pilot items below are possibilities, not commitments.

Product phases in [`PHASES.md`](PHASES.md) still apply. This table is the dashboard-only cut.

### D0. Spec and design (now)

**In the pilot:** yes. **Code:** no.

- This document accepted as build SoT
- Dashboard visual extension agreed (tokens, desktop IA, day chrome)
- Paper or HTML design pass that a Casey officer can click through
- N5 acceptance criteria updated to match the D1 definition of hotspot
- Access method chosen (DB-1)

**Done when:** you can open a design on a laptop in a Casey meeting and the scores match v1.1 language.

#### Sitting 1 · 20 Sep 2026 (internal)

**Who:** product + AI guide. No Casey officer and no XYX in the room. Officer walkthrough still preferred before D1.

**Artefact:** [`meeting-prep/dashboard-d0.html`](meeting-prep/dashboard-d0.html) (open from the repo so the YourWalk mark resolves). Four frames: empty Day, suburb selected, Night, screenshot crop. Ranks are illustrative, not a live extract.

Sitting captures: [`screenshots/dashboard-d0/frame-1-empty-day.png`](screenshots/dashboard-d0/frame-1-empty-day.png) · [`frame-2-suburb-selected.png`](screenshots/dashboard-d0/frame-2-suburb-selected.png) · [`frame-3-night.png`](screenshots/dashboard-d0/frame-3-night.png) · [`frame-4-screenshot-crop.png`](screenshots/dashboard-d0/frame-4-screenshot-crop.png)

**Walked:** D1 job; four frames; style lock; Cranbourne East then Night / Hampton Park stand-in; first-sitting leans.

**Locked as first-sitting leans** (officer may reopen DB-3 / DB-4 / DB-6):

| ID | Lean | Why |
|----|------|-----|
| DB-2 | A. Day shell always | Meeting-room contrast and Word screenshots. Night changes the map and stream labels only. |
| DB-3 | A. Suburb list | Officers already name suburbs. SA2 stays on the selected card later (D2). |
| DB-4 | B. Day / Night paint only | A third Accessibility paint reads as another overall score. Footpaths stay as the 0–100 bar. |
| DB-6 | A. Thin segment popup | Assets need to click a path. Streams only. Not Lab sub-scores. |

**Parked:** DB-5 Community Need (D2). **Still open:** DB-1 access (before DNS), DB-7 analytics (before D1 prod), DB-8 public later.

**Product lean after sitting 1 (not locked until officer):** D1 Layers = lights + resident amenities, default off (DB-9). Satellite and View by Suburb | Ward | SA2 stay sitting-2 questions (DB-10, DB-11).

#### Sitting 2 · officer brief (21 Sep 2026)

**Who:** one Casey officer (transport, assets, or urban design). Product + AI guide. XYX language pass can be the same hour or a follow-up on the frames.

**Artefact:** same [`meeting-prep/dashboard-d0.html`](meeting-prep/dashboard-d0.html). Sitting 1 frames still work. New controls: circular Layers button on the map (Basemap + overlays, CrashDash pattern), View by Suburb | Ward | SA2. Ranks and hulls stay illustrative until a live suburb extract.

**Do not lock in this sitting:** satellite into D1, Ward or SA2 as a shipped switcher, Nearmap, mesh blocks, draw-your-own, or a stack of Council GIS basemaps.

**Officer script (about 45 minutes, laptop):**

1. Find a suburb they know. Does the rank and 0–10 read?
2. Switch Night. Do they look for dark mode, or do they accept “index, not theme”?
3. Open the **Layers** circle (top left of the map). Turn on **Street lights**. Does Night suddenly make sense?
4. In the same menu, switch **Satellite** with lights on. Keep or drop it?
5. Try **Ward** and **SA2** (dummy ranks are fine). Which would they put in a briefing?
6. What would they screenshot today?

Write answers into DB-2 (reopen only if they hate day chrome), **DB-9 overlays**, **DB-10 basemap**, **DB-11 area unit**. Do not guess DB-10 or DB-11.

**After the sitting:** suburb extract when convenient (full list, length-weighted means, dissolved hulls). Honest copy: suburb as tagged on Casey footpaths. Still no `dashboard.yourwalk.au` DNS and no Next.js dashboard until this sitting and DB-1.

### D1. Evidence map (pilot MVP / Sprint E / N5)

**Grant:** Q3 dashboard development. **Product phase:** MVP “basic insights”.

Staff open `dashboard.yourwalk.au` and see Casey scored paths.

**In:**

- Host routing + quiet Beta header
- Day / Night index switch (default **Day**)
- Segment choropleth, legend, LGA outline
- Suburb search + select; ranked suburb list for the active index
- Selected-suburb card: 0–10 index, 0–100 stream bars, segment count
- **Layers (lean, DB-9):** street lights, park / reserve lights, drinking fountains, benches, toilets, dog bags. Default off. Toggle never recalculates the index. Copy must say which layers are score evidence and which are overlay-only.
- Data sources / vintage / `scoring_spec_version`
- Reduced-confidence copy where crossings/kerbs or coverage are thin
- Keyboard path through list + map controls
- Not linked from the front door or resident header

Satellite (DB-10) and View by Ward / SA2 (DB-11) are **not** D1 until sitting 2 locks them. Default D1 remains suburb + YourWalk Standard.

**Out:**

- Clerk, SSO, accounts
- Community observation heatmaps
- Community Need / SEIFA
- Corridors and Priority Zones tabs
- PDF / CSV / GeoJSON export
- Routing, A to B, or challenger
- Dead nav pills
- Combined index
- “High risk” language
- Accessibility-only paint (sitting 1: Footpaths stays a bar)
- Nearmap or a stack of Council GIS basemaps
- Auto-switch to satellite when Night is on
- Mesh blocks, PSP layers, or draw-your-own areas

**Acceptance (D1):**

**Given** a Casey officer opens `dashboard.yourwalk.au` with access  
**When** the map loads  
**Then** they see scored footpath segments for the City of Casey painted by the Day Index  
**And** a legend states that higher scores are better walking conditions  
**And** `scoring_spec_version` and heat 2018 vintage are visible  

**Given** they switch to Night  
**When** the map and list update  
**Then** paint and ranks use the Night Index  
**And** the Heat and shade stream is not shown as if it applied at night  

**Given** they select Cranbourne East (or another scored suburb)  
**When** the card opens  
**Then** they see the suburb Night or Day score (0–10), Footpaths / stream bars (0–100), and how many segments contributed  
**And** they do not see a combined vulnerability number  

**Given** they look at the ranked list  
**When** Day is selected  
**Then** suburbs are ordered weakest-first by length-weighted Day mean  
**And** each row has a numeric score, not only a colour  

**Given** they open Layers and turn on Street lights  
**When** Night is selected  
**Then** poles appear on the map  
**And** copy states that lights are Night Index evidence and that the toggle does not change the score  

**Given** they turn on Toilets  
**When** the map updates  
**Then** amenity points appear  
**And** the Day or Night index numbers do not change  

### D2. Decision support (pilot Beta)

**Grant:** Q3 refinements into Q4 use. **Product phase:** Beta insights + basic export.

**In:**

- Theme filter: Footpaths, Heat and shade, After dark (filters paint and ranks; does not create a fourth index)
- SA2 roll-up toggle or SA2 on the selected card if sitting 2 did not already lock View by (ADR-008, DB-11)
- Community Need overlay: SEIFA 2021 at SA2 (Casey portal). Age / disability / no-vehicle only if the ABS extract is ingested and labelled 2021
- Keep D1 Layers. Add road responsibility as context (local vs arterial), not as a score
- Named corridor view using [`PRIORITY_CORRIDORS.md`](PRIORITY_CORRIDORS.md)
- Click a segment: sub-score transparency (width, surface, speed, graffiti proxy, lighting density) with the same caveats as methodology
- Table view of the ranked list (map alternative)
- **CSV and GeoJSON** export of the current filter, with metadata (date, index, filters, sources, confidence, version)
- First-party usage events (dashboard opened, index switched, suburb selected, export). No coordinates. Same privacy stance as ADR-013

**Out:** PDF, Clerk, time-series, observation density, customisable weights.

**Acceptance (D2 extra):**

**Given** they turn on Community Need  
**When** an SA2 is selected  
**Then** SEIFA (and any other ingested need fields) show **beside** the walking-condition score  
**And** copy states that need is not part of the Day or Night index  

**Given** they export CSV for the current Night filter  
**When** they open the file  
**Then** rows match the ranked set  
**And** a header or sidecar states index, filters, `scoring_spec_version`, and heat vintage  

### D3. Grant close (pilot v1 slice)

**Grant:** Q4 ranked priority zones, downloadable datasets; Q4–Q5 finalise dashboard.

**In:**

- Priority zones list with visible factors (condition score, optional need overlap, confidence). Officers can see *why* a zone is listed
- PDF snapshot of the current view (legend + selected card + sources). Accessible tags
- Downloadable score extract suitable for partners (anonymised, no resident analytics)
- Ward filter if Casey asks (attribute already on segments)
- Short in-product “How to read this” and a 30-minute staff walkthrough
- EVALUATION hooks: access count, export count (targets in [`EVALUATION.md`](EVALUATION.md) are 10+ dashboard uses and 5+ exports during the pilot)

**Out:** telling Council which capital project to fund; multi-LGA switcher; observation moderation.

### D4. Beyond the pilot (possibilities)

Not committed. No other LGA is in the grant. Do not design D1 as multi-tenant.

Possible later, if a partner asks:

| Possibility | Notes |
|-------------|--------|
| Other LGAs | New footpath master + scoring run. Same two-index model. Host strategy TBD |
| Clerk / Council SSO | L1. Dashboard-only org. Still no login on the planner |
| Community observations | N4 and lighting / heat submissions as a **separate** layer, never silently in the index |
| YourGround / WalkSpot | Perception overlay after XYX licensing |
| Before / after | New score snapshots over time (L6). Needs versioned loads |
| Gradient in the index | Only if methodology v1.2 lands; until then hilliness stays resident disclosure |
| Crossings / kerbs in the score | When Council data arrives; confidence rises; no fake history |
| Asset-system join | Future; out of grant |
| Custom weights | Tempting, expensive, easy to break comparability. Default remains v1.1 |
| Public read-only dashboard | Only if Council wants the evidence public; still no safety copy |

Still out, even beyond the pilot, unless the grant or a new agreement changes:

- Prescriptive “build a crossing here” advice
- Crime prediction or safety guarantees
- Commercialisation as a grant output
- Using graffiti as crime data
- Casey logo on the product

## Auth, privacy, language

**D1 access (choose in DB-1):** the host is real but unlisted. Not in the resident header. Not on the holding front door.

Residents stay anonymous on the planner (ADR-004 lean). Dashboard usage telemetry, if any, follows the allowlist pattern: no addresses, no coordinates, no named officer required in D1.

Language bank (use these, do not invent slogans):

- YourWalk Council insights
- Walking conditions (Day / Night)
- Higher score = better walking conditions
- Footpaths, Heat and shade, After dark
- Scores describe conditions in the data; they are not a promise that a walk will feel safe
- Community need is shown beside the index; it is not in the score
- Graffiti is an environmental order / maintenance proxy

Do not say: safe route, high risk, crime hotspot, vulnerable people (when you mean a low infrastructure score), combined vulnerability index.

## Accessibility and performance

- WCAG 2.1 AA. Colour never the only encoding.
- Keyboard: Day/Night, suburb list, search, Layers circle, map zoom.
- Screen reader: index state, selected suburb, score and rank announced.
- Touch targets 44px on the index switch and list rows.
- Initial map < 3s on a typical Council office connection (same budget family as [`PHASES.md`](PHASES.md)).
- Prefer the existing static GeoJSON / map-data path for paint; PostGIS remains SoT for SQL / later exports.

## Open questions

| ID | Question | Options | Decision criteria | Decide when |
|----|----------|---------|-------------------|-------------|
| DB-1 | How do officers open D1? | A. Vercel Deployment Protection password, shared with named staff. B. Vercel Authentication (CrowdLab seats only; poor for Council). C. Unlisted URL, no password (scores are from open data). D. Clerk org (L1, too early). | Least friction for 5–15 Casey staff; no login on other hosts; revoke without a rebuild | Before DNS |
| DB-2 | Night chrome | **A (sitting 1).** Day shell always. B. Full Night surfaces when Night index is on. | Screenshot contrast in a meeting room | Reopen only after an officer sitting |
| DB-3 | Default rank geography | **A (sitting 1).** Suburb list. B. SA2 only. C. Ward. | Officers can name the unit in a briefing without a glossary | Officer sitting 2 may reopen via DB-11 |
| DB-4 | Accessibility-only paint in D1? | **B (sitting 1).** Night/Day only; Accessibility is the bar in the card. A would be a third paint mode. | Avoid a fourth “overall” reading | Officer sitting may reopen |
| DB-5 | Community Need fields in D2 | A. SEIFA decile only. B. SEIFA + 65+ + disability + no vehicle (mockup). C. Defer all need | Data already on Casey portal at SA2; extra Census fields need an ingest + privacy pass | Before D2 |
| DB-6 | Segment click in D1 | **A (sitting 1).** Popup with 0–100 streams only. B. Wait for D2 sub-scores. | Useful without looking like Lab | Officer sitting may reopen |
| DB-7 | Dashboard analytics | A. None in D1. B. Allowlisted first-party events (recommended if we need EVALUATION counts). | Grant KPI vs privacy | Before D1 prod |
| DB-8 | Public evidence later | A. Stay staff-only. B. Public read-only after pilot. | Council comms; no safety copy | Not D1 |
| DB-9 | D1 Layers | **A (lean).** Lights + resident amenities, default off. B. Lights only in D1; amenities wait for D2. C. No overlays in D1. | Officers can see assets under a weak score without a fourth index; copy must separate evidence from overlay-only | Officer sitting 2 |
| DB-10 | Basemap | A. YourWalk Standard only. **B (test).** Standard + Mapbox satellite, one switch. C. Extra Council GIS basemaps (out for D1). | Aerials help with lights and paths; do not promise Nearmap; Night must not auto-switch satellite | Officer sitting 2. Do not guess. |
| DB-11 | Area unit switcher | **A (sitting 1 lean).** Suburb only in D1. B. View by Suburb / Ward / SA2, default Suburb. C. Ward default. D. SA2 default. | What they would paste into a briefing; zoom still reaches segments | Officer sitting 2. Do not guess. |

Do not reopen Day/Night 60/40, Mapbox, T1EAM as the segment master, or the host table to answer these.

## Trace

- Methodology: [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1, [`SCORING_SPEC_v1.1.md`](SCORING_SPEC_v1.1.md)
- Hosts: [`DECISIONS.md`](DECISIONS.md) ADR-012
- Spatial unit: ADR-008
- Visual tokens: [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md)
- Older journey (observation-era): [`FLOWS/06_council_insights_view.md`](FLOWS/06_council_insights_view.md), [`FLOWS/07_export_report.md`](FLOWS/07_export_report.md), [`REQS/reporting_exports.md`](REQS/reporting_exports.md)
- Backlog: N5 (D1), X6 (D2 filters), L3 corridors, L4 prioritisation, L1 Clerk
- Delivery: [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) Sprint E
- Grant phases: [`PROJECT_PLAN_README.md`](PROJECT_PLAN_README.md)
- Corridors: [`PRIORITY_CORRIDORS.md`](PRIORITY_CORRIDORS.md)
- Lab boundary: [`LAB.md`](LAB.md)
- Historical visual: [`../council-dashboard-mockup/index.html`](../council-dashboard-mockup/index.html)
- D0 sitting artefact: [`meeting-prep/dashboard-d0.html`](meeting-prep/dashboard-d0.html)
