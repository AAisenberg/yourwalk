# Architecture Decision Records

This document records significant architecture and product decisions for YourWalk. Decisions are recorded in lightweight ADR (Architecture Decision Record) format.

## Decision Format

Each decision includes:

- **Status**: Proposed / Accepted / Rejected / Superseded
- **Decision Question**: What we're deciding
- **Options Considered**: Alternatives evaluated
- **Decision**: The chosen approach (when decided)
- **Rationale**: Why this was chosen
- **Consequences**: What this means for the project

## Decisions

### ADR-001: Routing Engine Approach

**Status**: Accepted (hybrid lean) — OD-11 evidence 30 Jul 2026

**Decision Question**: How should we calculate and rank routes? Should we use post-hoc ranking (calculate standard routes then score/rank them) or weighted cost routing (build custom costs into routing algorithm)?

**Options Considered**:

1. **Post-hoc ranking**: Use standard routing engine to calculate 2–3 walk route options based on distance/time, then score and rank them using segment Day/Night Index scores
2. **Weighted cost routing**: Build Day/Night factors into routing cost function
3. **Hybrid**: Mapbox walking candidates plus a score-aware path on OSM+Casey edges; rank all by prefs + time/distance

**Decision**: **Hybrid trip mode** for the pilot. Mapbox Directions (walking) still proposes 1–3 candidates; the app **always merges** a distinct OSM+Casey score-aware challenger when available. Length-weighted Day/Night/Accessibility scores still come from Casey T1EAM. Preferences rank candidates; score-aware pathfinding can invent geometries Mapbox never returns.

**Rationale**: OD-11 (7 Fairmead Place → 8 Hopwood Court, verified 30 Jul 2026) proved Mapbox-only post-hoc is not credible for neighbourhood cut-throughs. Mapbox returned a ~486 m road loop; Streets basemap and Google Maps show the mid-block walk; Casey T1EAM already scores that strip (9 segments, mean Acc ~83); OSM+Casey Dijkstra finds ~282 m via cycleway/service links (Night ~8.3). Post-hoc scoring cannot invent missing geometries. Hybrid clears the "match Google's efficient walk when we can see it" bar without switching the whole stack to T1EAM routing yet.

**Trip mode (30 Jul 2026 — hybrid; carriageway gate 8 Aug 2026):**  
Resident flow is **trip**: fixed origin → destination.

Generation: (1) Mapbox `alternatives` (**no** negative `walkway_bias`) plus a separate `walkway_bias=0.8` prefer request for path-safe diversity, (2) dedupe, (3) reject Mapbox candidates longer than **1.3× shortest Mapbox**, (4) **carriageway gate** — reject candidates whose Mapbox Streets tilequery samples are mostly road class, not footway/path/cycleway/sidewalk (product rule: never draw the walk line down the trafficked carriageway), (5) **add score-aware challenger** when geometrically distinct **and** off-carriageway (shorter paths are kept — do not apply the 1.3× Mapbox cap to the challenger), (6) retain challenger in the top cards when distinct. Cap ~3 cards. **No perpendicular vias**. Fewer cards is OK when only one path-safe geometry exists.

Score-aware graph: NetworkX Dijkstra on OSM walkable ways joined to Casey scores (`pipeline/bakeoff/`; served via `serve_challenger.py` + `/api/challenger-route`). Soft 1.15× cap vs graph-shortest distance path (OD-05). Reduced confidence when T1EAM coverage along the corridor is thin — never impute missing as zero.

**Routing outputs methodology (authoritative detail):** [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md) — includes OD-CARRIAGE-01 (Epsom → Arubi) regression.

**Product north star:**  
Preference-weighted score-aware pathfinding (and T1EAM-native edges where OSM cannot connect scored cut-throughs). Mapbox remains map/geocode + useful candidate source, not the sole geometry authority.  
**Spec (12 Aug 2026):** [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md) — P1 gate + P2 preference-weighted challenger costs shipped locally. Sliders at Find time change score-aware geometry when the network allows; Mapbox pool + ranking remain. **P3 dual Casey (16 Aug 2026):** preference-best + the other pathish corridor (invert stream, no prefix penalty, 1.20×); Prefer away from roads remains an optional third card. **Prod host:** Fly.io (ADR-010, [`HOSTING_CHALLENGER.md`](HOSTING_CHALLENGER.md)).

**Carriageway truth / Track 0 (16 Aug 2026):** Mapbox walking geometry can still **look** mid-road on the basemap (OD-12 Liara Blvd) while Streets tilequery reports pathish / low road share — Google draws the same walk on the carriageway edge. Hybrid now **sidewalk-nudges** Mapbox paint when a mapped sidewalk (or short synthetic edge offset) is available, prefers the score-aware challenger when Mapbox needed that nudge, and applies a soft match penalty for residual centreline look. An **on-path guard** leaves points already on a genuinely offset footway untouched (only centreline-coincident "footway" mislabels get pushed), so real footpath alignments like east Homestead Rd keep their true geometry. The **challenger geometry gets the same paint nudge** after its path-safe gate (OSM road ways without separate sidewalk geometry otherwise draw at the centreline — OD-12 Homestead Rd), and score-aware cards are exempt from the centreline-look match penalty since their path safety is proven by OSM evidence. **Side-certainty guard (product rule, 16 Aug 2026):** paint only moves off-centre when contiguous evidence agrees ≥80% on which side; when the side is unknown the line draws on the honest centreline — a squiggle weaving across the road (Fordholm Rd) is worse than an honest centreline. Detail: [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md) §4b.

**Track 0 follow-on (16 Aug 2026, same day):** Challenger **road-class edges cost 1.5–2× per metre** so a parallel footpath always beats the road way; **node-tagged OSM crossings** are synthesised as short crossing edges at graph build (routing connectivity, not a scoring input). **Prefer away from roads** is generation-time: 1.6× detour cap plus an off-road-biased challenger variant, with honest card copy on the extra time. **Hide Mapbox** that still looks mid-carriageway when a path-safe Casey card is already on the footpath (OD-12 Homestead). OD-12 default is the north-side Homestead path via the Liara roundabout crossings. **Dual Casey cards:** preference-best plus the other pathish corridor (invert stream, no prefix penalty, 1.20×) when distinct; pathish pref paths may keep up to 1.20×. Detail: [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md) §4c–4d. **T1EAM-native geometry (draw challenger lines from Casey's own footpath segments) remains the accepted next step** for paint and side-of-street truth. OSM already maps both Ashfield Drive footways; heading-continuity at crossings is the cheaper follow-on if a card still hops east after Homestead.

**Bake-off note (17 Jul 2026):** First full-sample run (`docs/BAKEOFF_RESULTS_2026-07-17.md`) leaned hybrid. **OD-11 (30 Jul 2026) upgrades that lean to shipping requirement** for credible trip options.

**Outing mode** (e.g. ~25 min walk from a start / optional loop): backlog later — not MVP trip.

**Consequences**:

- Resident `/` and lab plan-route require the challenger service (or graceful Mapbox-only fallback with a quiet log)
- Route scores remain aggregations of segment scores, not a third scoring model
- Alternatives that leave scored footpaths show reduced confidence
- On-carriageway Mapbox (or challenger) geometries are filtered before UI cards — see [`ROUTING_OUTPUTS.md`](ROUTING_OUTPUTS.md)
- Community app at `/`; scored-network workbench at `/lab`
- Full switch away from Mapbox candidates is not required for pilot credibility

**Open Questions** (non-blocking for hybrid ship):

- Exact segment↔route matching (buffer / nearest segment along polyline)
- Aggregation rule (length-weighted mean vs median vs worst segment)
- Material after-dark overlap for Night Index trigger (civil twilight)
- T1EAM-native edges for true Casey-only links (OSM has no walkable way) — see [`SCORE_AWARE_ROUTING_BAKEOFF.md`](SCORE_AWARE_ROUTING_BAKEOFF.md)
- Preference weights inside edge costs — **specified** in [`PREFS_IN_PATHFINDING.md`](PREFS_IN_PATHFINDING.md); implementation pending P2
- Whether carriageway detection should move from Streets tilequery to a local OSM class join for offline / rate-limit resilience (also blocks OD-11 challenger merge — prefs spec P1)

---

### ADR-002: Map Technology Choice

**Status**: Accepted

**Decision Question**: What mapping library should we use for the web interface?

**Options Considered**:

1. **MapLibre GL JS**: Open source, vector tiles, good performance, active development
2. **Leaflet**: Mature, widely used; used for local Phase B QA viewer only
3. **Google Maps API**: Feature-rich, licensing costs and vendor lock-in
4. **Mapbox GL JS**: Vector maps, Directions API alignment, CrowdLab standard

**Decision**: **Mapbox GL JS** for the production resident app and Council UI.

**Rationale**: CrowdLab stack standard; aligns with Mapbox Directions (ADR-001 lean); Mapbox account already expected for production. Leaflet remains allowed for **local pipeline QA** (`pipeline/viewer/`) only — not production.

**Consequences**:

- Production UI must not use MapLibre unless explicitly overridden
- Requires Mapbox access token in app env
- 2D map is sufficient for MVP; no 3D requirement
- Resident basemap today: classic `streets-v12` (Day) and `dark-v11` (Night)
- Planned: one custom YourWalk style based on Mapbox Standard, with `lightPreset` `dawn` / `day` / `dusk` / `night` timed to Casey sun or the planned When. Four looks, two index states. Detail: [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md), [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md)

**Open Questions**: None blocking Sprint A. Studio style URL and Standard slot placement for route lines are implementation detail for the planner UX / brand slice.

---

### ADR-003: Data Storage and Versioning Strategy

**Status**: Accepted (pilot lean)

**Decision Question**: How should we store data (observations, routes, insights) and handle versioning for datasets?

**Options Considered**:

1. **Supabase / PostGIS**: Production geo + app tables; reload scored segments from GeoParquet
2. **Time-series database**: Overkill for pilot volumes
3. **Git LFS only**: Not queryable for app/map
4. **Snapshot versioning**: Tag each load with `scoring_spec_version` + `scored_at`; keep prior load optional

**Decision**: **Supabase with PostGIS** for production. Scored segments load from `segment_scores.parquet` into a PostGIS table. Pilot versioning = **snapshot reload** keyed by `scoring_spec_version` and `scored_at` (replace or truncate-and-load). Community observations (later) use ordinary Supabase tables; no time-series DB for MVP.

**Rationale**: Matches Phase B pipeline output and CrowdLab production stack. ~27k segments is well within PostGIS. Full historical versioning can wait until datasets refresh on a regular cadence.

**Consequences**:

- Sprint A delivers first PostGIS load + queryable layer for Mapbox
- App reads live PostGIS / API; GeoParquet remains the pipeline intermediate SoT
- Re-score → re-load; UI shows `scoring_spec_version` for provenance

**Open Questions** (non-blocking):

- Exact table naming (`segment_scores` vs schema-qualified)
- Whether to keep previous snapshot for rollback (nice-to-have)

---

### ADR-004: Privacy Stance (Anonymous by Default)

**Status**: Proposed

**Decision Question**: Should the system be anonymous by default, or require accounts? What's the default privacy model?

**Options Considered**:

1. **Anonymous by default**: No accounts required, optional accounts for advanced features, minimal data collection
2. **Accounts required**: All users create accounts, full tracking and personalisation
3. **Hybrid with progressive enhancement**: Start anonymous, prompt for account when value is clear (e.g., after first contribution)

**Decision**: TBD (leaning towards Option 1 based on privacy principles)

**Pilot location lean (16 Aug 2026, does not close this ADR):** one-shot geolocate to fill From / Start, in session only. No start-to-finish walk tracking, no breadcrumb upload. Prefs may persist on the device. Detail: [`FLOWS/02_tell_us_about_your_walk.md`](FLOWS/02_tell_us_about_your_walk.md) § Location and privacy.

**Rationale**: TBD (to be filled when decision made)

**Consequences**:

- Anonymous by default: Better privacy, lower barrier to entry, but limited personalisation, harder to prevent abuse
- Accounts required: Better data quality, abuse prevention, personalisation, but higher barrier, more privacy concerns
- Hybrid: Balance of benefits, but more complex UX, may confuse users

**Open Questions**:

- How do we prevent spam/abuse without accounts?
- What personalisation features require accounts?
- What's the community engagement impact of each approach?

---

### ADR-005: Confidence Scoring Model

**Status**: Proposed

**Decision Question**: How should we calculate and display confidence scores for integrated data layers?

**Options Considered**:

1. **Simple aggregation**: Average confidence of underlying data points, display as high/medium/low
2. **Weighted confidence**: Weight by data source reliability (Council data > environmental > community), data recency, coverage density
3. **Statistical confidence**: Use statistical methods (confidence intervals, sample size) for community data, combine with source reliability
4. **Transparent breakdown**: Show confidence per data source, let users interpret

**Decision**: TBD

**Rationale**: TBD (to be filled when decision made)

**Consequences**:

- Simple aggregation: Easy to understand, but may not reflect true confidence
- Weighted confidence: More accurate, but complex to explain, may be opaque
- Statistical confidence: Scientifically rigorous, but may be too technical for users
- Transparent breakdown: Users can make own judgements, but may be overwhelming

**Open Questions**:

- How do we validate confidence scores are accurate?
- What's the user understanding of confidence vs accuracy?
- Do we need different confidence models for different use cases (routing vs insights)?

---

### ADR-006: Submission Moderation Approach

**Status**: Proposed

**Decision Question**: How should we moderate community-submitted observations to ensure quality and prevent abuse?

**Options Considered**:

1. **Post-submission moderation**: All submissions reviewed before appearing on map
2. **Automated validation**: Automated checks (location valid, form complete, not duplicate), human review for flagged items
3. **Community moderation**: Submissions appear immediately, community can flag/report, moderation queue for flags
4. **No moderation**: All submissions appear immediately, rely on statistical aggregation to handle outliers

**Decision**: TBD

**Rationale**: TBD (to be filled when decision made)

**Consequences**:

- Post-submission: Highest quality, but delays, requires moderation resources
- Automated validation: Fast, scalable, but may miss subtle issues
- Community moderation: Scales well, engages community, but may have bias issues
- No moderation: Fastest, no resources needed, but quality risk, potential for abuse

**Open Questions**:

- What moderation resources are available?
- How do we prevent bias in moderation?
- What's the acceptable delay for submissions to appear?

---

### ADR-007: Scoring Algorithm Transparency

**Status**: Proposed

**Decision Question**: How transparent should route scoring be? Should users see exact formulas or simplified explanations?

**Options Considered**:

1. **Full transparency**: Show exact scoring formula, weights, calculations
2. **Simplified explanation**: Show factors and relative importance, but not exact math
3. **Progressive disclosure**: Simple summary by default, detailed breakdown on demand
4. **Black box with factors**: Show which factors affect score, but not how they're combined

**Decision**: TBD

**Rationale**: TBD (to be filled when decision made)

**Consequences**:

- Full transparency: Builds trust, allows verification, but may be overwhelming, harder to change
- Simplified: Accessible, but may hide complexity
- Progressive disclosure: Best of both, but more UI complexity
- Black box: Simple, flexible, but may reduce trust

**Open Questions**:

- What's the user need for transparency?
- How do we balance transparency with simplicity?
- Do we need different levels for different users (residents vs Council)?

---

### ADR-008: Vulnerability Index Spatial Unit

**Status**: Accepted

**Decision Question**: What spatial unit should the YourWalk Vulnerability Index use for primary scoring and Council dashboard aggregation?

**Options Considered**:

1. **Street segment primary scoring, SA2 dashboard aggregation**: Score walkability conditions on individual street/path segments, then aggregate to SA2 for dashboard reporting.
2. **SA2-only scoring**: Score vulnerability only at SA2 level.
3. **Mesh block scoring**: Score vulnerability at ABS mesh block level.
4. **Grid / hex scoring**: Score vulnerability using an artificial grid independent of the street network.

**Decision**: Street segment as the primary scoring unit, aggregated to SA2 for Council dashboard views.

**Rationale**: Street segments align with resident route choice, infrastructure conditions, and Council intervention points. Footpath width, lighting gaps, crossings, shade, gradient, and surface issues occur along walkable network segments rather than across broad administrative areas. SA2 remains useful for dashboard aggregation and comparison, but is too coarse for route scoring.

The working source for the segment network is **Footpaths (T1EAM)** on the Casey Open Data portal (`footpaths_ply_t1eam`), which includes both standard footpaths and **shared use paths** (~27,458 polygon segments). Class is stored as `walk_path_class` (`footpath` | `shared_use`). The separate [Shared Use Paths (T1EAM)](https://data.casey.vic.gov.au/explore/dataset/sharedusepaths_ply_t1eam/) export is ingested for validation only (portal: generated from footpaths); it is not row-unioned into the master. OpenStreetMap may be used as a gap-fill source if data quality and licensing checks are acceptable.

**Consequences**:

- Route scoring can reflect conditions along the actual walking network.
- Council dashboard views can still summarise vulnerability by SA2.
- The methodology depends on a reliable segment network, likely from Casey footpath data with OpenStreetMap gap-fill if approved.
- Network gaps, duplicated paths, looped trails, and non-road paths require explicit handling before scoring is implemented.

**Open Questions**:

- Does the Casey footpath layer contain all attributes needed for scoring, or only the base segment geometry and width?
- Is OpenStreetMap confirmed as a permitted gap-fill source, including ODbL licensing obligations for a Council-commissioned product?
- Do looped trails or recreational paths create entry/exit ambiguity that requires a separate modelling rule?
- Should road carriageway segments without footpaths be represented as low-accessibility walking segments or excluded from the walkable network?

---

### ADR-009: Day / Night Vulnerability Index Model

**Status**: Accepted

**Decision Question**: Should YourWalk use one composite Vulnerability Index for all routes, or compute separate scores for day and night walking conditions?

**Options Considered**:

1. **Single composite score**: Combine Footpath Accessibility, Heat & Shade, and Lighting / After Dark into one score for every route.
2. **Separate Day and Night scores**: Use Footpath Accessibility as the shared foundation, then switch the second stream by time context: Heat & Shade for day, Lighting / After Dark for night.
3. **Continuous time-weighted blend**: Blend heat/shade and lighting dynamically based on exact route time, sun position, weather, and duration.

**Decision**: Compute separate Day and Night scores for each segment.

- **Day Index** = Footpath Accessibility 60% + Heat & Shade 40%.
- **Night Index** = Footpath Accessibility 60% + Lighting / After Dark 40%.

For v1 dusk / mixed routes, use the Night Index if any material part of the walk overlaps after-dark conditions. A future version may blend Day and Night scores by route-time overlap.

**Rationale**: The 30 April 2026 methodology meeting with Nikki Hedge confirmed that heat/shade should not affect night walks, while lighting and after-dark safety should not dilute daytime heat/shade assessment. Footpath accessibility remains the shared foundation because surface, width, continuity, crossings, and gradient affect walking at all times. The 60/40 split keeps the model simple and transparent while giving accessibility the greater weighting requested through the workshop and methodology review.

**Consequences**:

- The data pipeline must output at least two segment-level scores: `day_index_score` and `night_index_score`.
- Route ranking must choose the correct score based on expected walk time.
- Civil twilight should be used as the default after-dark boundary rather than a fixed clock time.
- Product When (16 Aug 2026): auto-select Day / Night from Casey civil twilight; always overridable. Basemap may show four Mapbox looks (`dawn` / `day` / `dusk` / `night`). Index stays two states. Evening twilight → Night (this ADR). Morning twilight → Day is a product lean pending methodology check (flow OQ-5).
- Heat/shade datasets feed only the Day Index by default.
- Lighting, night crash history, and carefully evidenced after-dark proxies feed only the Night Index by default.
- Graffiti and cellular datasets require evidence/methodology review before being used as weighted scoring inputs.
- User route preferences remain a product layer on top of the default methodology, not a replacement for the methodology weights.

**Open Questions** (implementation detail; model locked):

- What exact civil twilight library/API or astronomical calculation should be used in implementation?
- How much route overlap after dark counts as "material" for triggering the Night Index?
- Should dusk blending be added after v1, and if so should it be time-weighted or segment-weighted?

**Resolved at v1.1 sign-off (3 Jul 2026):** Graffiti stays in shared Accessibility (not Night-only). Day pedestrian crashes not in Accessibility. Cellular not in index.

---

### ADR-010: Hosted score-aware challenger

**Status**: Accepted (pilot lean) — 16 Aug 2026

**Decision Question**: Where does the Casey OSM+score graph run so production / phone testers get dual Casey cards?

**Options Considered**:

1. **Vercel serverless Python** — cold start loads a ~102 MB pickle into NetworkX; first Find would miss the graph
2. **Cloud Run / scale-to-zero** — same cold-start problem unless min instances = 1
3. **Fly.io always-on 1 GB VM (Sydney)** — one warm process, Next proxies via `CHALLENGER_URL`
4. **Railway / Render** — same shape as Fly; extra vendor if Fly is already the choice

**Decision**: Host `serve_challenger.py` on **Fly.io** (`yourwalk-challenger`, region `syd`, 1 GB, `min_machines_running = 1`). Vercel Next stays the public app. Server-only `CHALLENGER_URL` + `CHALLENGER_SHARED_SECRET`. Browser never calls Fly.

**Rationale**: App 0.2.0 dual Casey is the baseline Nikki will test. The graph is ~280 MB RAM and must stay warm. Vercel is the wrong runtime. Sydney keeps latency low for AU testers.

**Consequences**:

- Production without Fly (or a mismatched secret) is Mapbox-only
- Graph pickle stays gitignored; `fly deploy` from a machine that has `score_aware_graph.gpickle`
- Shared secret required on `/route`; `/health` stays open for Fly checks
- Ops steps: [`HOSTING_CHALLENGER.md`](HOSTING_CHALLENGER.md)

---

## Decision Process

1. **Identify need**: Decision required when multiple viable options exist
2. **Document options**: List alternatives with pros/cons
3. **Evaluate**: Consider technical, user, business, and ethical implications
4. **Decide**: Make decision with team/stakeholder input
5. **Record**: Update this document with decision and rationale
6. **Communicate**: Share decision with team, update relevant docs
7. **Review**: Revisit decisions if assumptions change or new information emerges

## Superseded Decisions

(Decisions that were later changed will be moved here with reference to the new decision)