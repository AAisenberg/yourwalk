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

**Status**: Accepted (lean) — revisit after first route vertical slice

**Decision Question**: How should we calculate and rank routes? Should we use post-hoc ranking (calculate standard routes then score/rank them) or weighted cost routing (build custom costs into routing algorithm)?

**Options Considered**:

1. **Post-hoc ranking**: Use standard routing engine to calculate 2–3 walk route options based on distance/time, then score and rank them using segment Day/Night Index scores
2. **Weighted cost routing**: Build Day/Night factors into routing cost function
3. **Hybrid**: Calculate initial routes with standard engine, then re-route with adjusted costs for top candidates

**Decision**: **Post-hoc ranking** for MVP. Prefer **Mapbox Directions API** (walking profile) for origin/destination → 2–3 alternatives, then aggregate `day_index_score` / `night_index_score` along the route from PostGIS segments. Revisit weighted-cost only if post-hoc routes systematically miss better-scored corridors.

**Rationale**: Phase B already produces segment scores. Post-hoc ranking ships fastest, matches Mapbox (ADR-002), and keeps methodology transparent (score after geometry). Weighted cost can wait until we have evidence post-hoc is insufficient.

**Trip mode (16 Jul 2026 — revised after resident QA):**  
MVP resident flow is **trip**: fixed origin → destination. Generate sensible Mapbox walking candidates → length-weighted Day/Night/Accessibility scores → **rank by preference blend + time/distance** (soft efficiency weight).  

Generation: (1) Mapbox `alternatives`, (2) mild `walkway_bias` variants, (3) dedupe, (4) reject candidates longer than **1.3× shortest**. **No perpendicular vias** (they caused backtracking / perimeter loops). Cap at 3; if only one distinct path exists, show one honestly.  

Preferences and index scores **rank and label** candidates; they do not invent geometries (post-hoc, not weighted-cost).

**Product north star (not MVP):**  
**Score-aware routing** — pathfinding that uses Casey segment Day/Night/Accessibility (and user prefs) as edge costs so people are directed onto better local walking conditions, not only onto Mapbox’s shortest/default walk. Mapbox Directions is the right **pilot/lean** engine to ship and learn; it is **not** the long-term routing vision. Pilot work must include a **comparison track**: same OD pairs → Mapbox post-hoc vs score-aware router (e.g. GraphHopper / Valhalla / custom graph on T1EAM or OSM+Casey scores) → measure whether better-scored corridors are missed, detour cost, and resident UX. Revisit ADR-001 formally when comparison evidence is in.

**Outing mode** (e.g. ~25 min walk from a start / optional loop): backlog later — not MVP trip.

**Consequences**:

- Sprint A does **not** require routing; Sprint C (route vertical slice) implements this lean
- Route scores are aggregations of segment scores, not a third scoring model
- Alternatives that leave the walk network may need snapping / reduced confidence
- Community app at `/`; scored-network workbench at `/lab`
- Score-aware routing is a planned pilot experiment, not a silent assumption of current `/`

**Open Questions** (non-blocking for Sprint A):

- Exact segment↔route matching (buffer / nearest segment along polyline)
- Aggregation rule (length-weighted mean vs median vs worst segment)
- Material after-dark overlap for Night Index trigger (civil twilight)
- Score-aware graph base: T1EAM centerlines vs OSM footways enriched with Casey scores
- Comparison metrics and OD sample for Mapbox vs score-aware bake-off

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

**Open Questions**: None blocking Sprint A.

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