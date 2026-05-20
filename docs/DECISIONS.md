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

**Status**: Proposed

**Decision Question**: How should we calculate and rank routes? Should we use post-hoc ranking (calculate standard routes then score/rank them) or weighted cost routing (build custom costs into routing algorithm)?

**Options Considered**:

1. **Post-hoc ranking**: Use standard routing engine (e.g., OSRM, GraphHopper) to calculate 3-5 route options based on distance/time, then score and rank them based on lighting/accessibility/climate data
2. **Weighted cost routing**: Build lighting/accessibility/climate factors into routing cost function, calculate routes with custom weights
3. **Hybrid**: Calculate initial routes with standard engine, then re-route with adjusted costs for top candidates

**Decision**: TBD

**Rationale**: TBD (to be filled when decision made)

**Consequences**: 

- Post-hoc ranking: Simpler implementation, faster to build, but routes may not optimise for our factors
- Weighted cost: More accurate route optimisation, but complex to tune weights, may produce unexpected routes
- Hybrid: Balance of accuracy and simplicity, but more complex to implement

**Open Questions**:

- What routing engines support custom cost functions?
- How do we validate that weighted routes are actually better?
- What's the performance impact of each approach?

---

### ADR-002: Map Technology Choice

**Status**: Proposed

**Decision Question**: What mapping library should we use for the web interface?

**Options Considered**:

1. **MapLibre GL JS**: Open source, vector tiles, good performance, active development
2. **Leaflet**: Mature, widely used, plugin ecosystem, raster and vector support
3. **Google Maps API**: Feature-rich, well-documented, but licensing costs and vendor lock-in
4. **Mapbox GL JS**: Similar to MapLibre (forked from it), but requires Mapbox account/service

**Decision**: TBD

**Rationale**: TBD (to be filled when decision made)

**Consequences**:

- MapLibre: Open source, no licensing fees, good performance, but may need more customisation
- Leaflet: Mature and stable, but may have performance limitations with large datasets
- Google Maps: Feature-rich but costs money, vendor dependency
- Mapbox: Good features but requires account, some costs

**Open Questions**:

- What are the licensing costs for commercial mapping services?
- What's the performance requirement for our pilot area size?
- Do we need 3D or is 2D sufficient?

---

### ADR-003: Data Storage and Versioning Strategy

**Status**: Proposed

**Decision Question**: How should we store data (observations, routes, insights) and handle versioning for datasets?

**Options Considered**:

1. **PostgreSQL with versioning tables**: Store current data in main tables, version history in separate tables, tag releases
2. **Time-series database**: Use specialised time-series DB (e.g., TimescaleDB, InfluxDB) for observations, standard DB for other data
3. **Data versioning with Git LFS**: Store datasets as versioned files, reference in database
4. **Snapshot-based versioning**: Create periodic snapshots of datasets, reference snapshot version in UI

**Decision**: TBD

**Rationale**: TBD (to be filled when decision made)

**Consequences**:

- PostgreSQL versioning: Flexible, SQL queries, but manual versioning logic
- Time-series DB: Optimised for temporal data, but adds complexity, may be overkill
- Git LFS: Good for large datasets, version control, but not queryable directly
- Snapshot-based: Simple, clear versions, but storage overhead, may lose granular history

**Open Questions**:

- How often do datasets update?
- Do we need to query historical versions?
- What's the expected data volume?

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

The working source for the segment network is the current City of Casey footpath layer available through the Casey Open Data portal. OpenStreetMap may be used as a gap-fill source if data quality and licensing checks are acceptable.

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

**Status**: Accepted for review

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

**Open Questions**:

- What exact civil twilight library/API or astronomical calculation should be used in implementation?
- How much route overlap after dark counts as "material" for triggering the Night Index?
- Should dusk blending be added after v1, and if so should it be time-weighted or segment-weighted?
- What evidence threshold is required before graffiti becomes a Night Index proxy rather than a dashboard/context layer?
- Does cellular coverage belong in scoring, confidence display, or route context only?

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