# Requirements: Scoring and Rankings

## Scope

This document defines requirements for scoring routes based on lighting, accessibility, and climate data, ranking routes, and displaying scores transparently to users.

## Requirements

### R1: Route Scoring

**Requirement**: Routes must receive scores for lighting, accessibility, and climate, with an overall score that combines all three streams.

**Acceptance Criteria**:
- Given a route is calculated
- When it is scored
- Then it receives a lighting score (0-10 or similar scale)
- And it receives an accessibility score (0-10)
- And it receives a climate score (0-10)
- And it receives an overall score (0-10) that combines all three
- And scores are calculated based on data along the route

**Data Needed**:
- Lighting data along route (LUX measurements, perception data, street lighting density)
- Accessibility data along route (footpath audits, Council asset data, crossing assessments)
- Climate data along route (urban heat, tree canopy, shade patterns)
- Route geometry (to match data to route segments)

**API/Interface Notes**:
- Scoring algorithm or service
- Input: Route geometry, data layers
- Output: Scores for each stream, overall score, confidence levels

**Testing Notes**:
- Test scoring with various route types (well-lit vs poorly lit, accessible vs inaccessible, shaded vs exposed)
- Test scoring with missing data (some segments have no data)
- Test scoring accuracy (compare with manual assessment if possible)
- Test scoring performance (should complete quickly)

**Open Questions**:
- What scoring scale to use? (0-10, 0-100, stars, etc.)
- How to combine scores into overall? (Simple average, weighted average, minimum, etc.)
- How to handle missing data? (Penalise, neutral, or indicate uncertainty)

---

### R2: Score Breakdown Display

**Requirement**: Users must be able to see detailed breakdown of route scores, including component scores and contributing factors.

**Acceptance Criteria**:
- Given a user views a route
- When they view route details
- Then they see overall score
- And they see score breakdown (lighting, accessibility, climate)
- And they see key factors contributing to each score (e.g., "Well-lit", "Narrow footpath", "Good shade")
- And they see confidence indicators for each score component

**Data Needed**:
- Route scores (from scoring system)
- Contributing factors (derived from data analysis)
- Confidence levels (from data quality assessment)

**API/Interface Notes**:
- Score display component
- Breakdown visualisation (bars, numbers, icons)
- Factor explanation component

**Testing Notes**:
- Test score display accuracy
- Test breakdown visualisation clarity
- Test factor explanations are understandable
- Test confidence indicator display

**Open Questions**:
- How detailed should breakdown be? (Simple vs detailed)
- How to present contributing factors? (List, icons, text descriptions)
- Should users see raw data? (Transparency vs simplicity)

---

### R3: Route Ranking

**Requirement**: Routes must be ranked to help users choose between options, with ranking based on overall score or user preferences.

**Acceptance Criteria**:
- Given multiple routes are calculated
- When they are ranked
- Then routes are ordered by overall score (highest first) or user preferences
- And ranking is displayed clearly (Route 1, Route 2, etc., or "Best", "Shortest")
- And users can understand why routes are ranked as they are

**Data Needed**:
- Route scores (from scoring system)
- User preferences (if available, v1 phase)
- Route metadata (distance, time, for tie-breaking if needed)

**API/Interface Notes**:
- Ranking algorithm or function
- Ranking display component
- Integration with route comparison (if available)

**Testing Notes**:
- Test ranking accuracy (routes with higher scores rank higher)
- Test ranking with user preferences (if available)
- Test tie-breaking (if scores are equal)
- Test ranking display clarity

**Open Questions**:
- Should ranking consider distance or time? (If scores are equal)
- How to handle routes with very similar scores? (Show as equal, or use tie-breakers)
- Should users be able to change ranking criteria? (Sort by distance, time, score)

---

### R4: Score Transparency

**Requirement**: Scores must be transparent: users must understand how scores are calculated and what they mean.

**Acceptance Criteria**:
- Given a user views route scores
- When they want to understand scoring
- Then they can see explanation of how scores are calculated
- And they can see what factors contribute to scores
- And they can see data sources and confidence levels
- And language is clear (no safety guarantees, conditions and perceptions)

**Data Needed**:
- Scoring methodology documentation
- Data sources for each score component
- Confidence levels

**API/Interface Notes**:
- Score explanation component or help text
- Tooltip or info icon for score details
- Link to detailed scoring documentation (if available)

**Testing Notes**:
- Test score explanation clarity
- Test user understanding (user testing recommended)
- Test transparency language (no safety guarantees)
- Test data source visibility

**Open Questions**:
- How detailed should explanations be? (Simple vs comprehensive)
- Should we show scoring formula? (Full transparency vs simplicity)
- Where to put explanations? (Tooltips, help section, modal)

---

### R5: Confidence Indicators

**Requirement**: Each score component must show confidence level indicating data quality and reliability.

**Acceptance Criteria**:
- Given a route score is displayed
- When users view score breakdown
- Then they see confidence indicators for lighting score (high/medium/low or numeric)
- And they see confidence indicators for accessibility score
- And they see confidence indicators for climate score
- And confidence is explained (what high/medium/low means)

**Data Needed**:
- Data quality metrics (coverage, recency, source reliability)
- Confidence calculation (from confidence scoring model, see ADR-005)

**API/Interface Notes**:
- Confidence indicator component
- Confidence calculation service or function
- Confidence explanation component

**Testing Notes**:
- Test confidence calculation accuracy
- Test confidence indicator display clarity
- Test confidence explanation understandability
- Test with various data quality scenarios

**Open Questions**:
- What confidence model to use? (See ADR-005 in [`DECISIONS.md`](../DECISIONS.md))
- How to display confidence? (Icons, colours, text, numeric)
- Should confidence affect ranking? (Probably not, but show clearly)

---

### R6: User Preferences Integration (v1 Phase)

**Requirement**: User preferences must affect route scoring and ranking (e.g., avoid poorly lit routes, prioritise accessibility).

**Acceptance Criteria**:
- Given a user sets preferences (e.g., "avoid poorly lit routes")
- When routes are scored
- Then lighting scores are adjusted (poorly lit routes penalised)
- And route rankings update to reflect preferences
- And adjusted scores are clearly indicated

**Data Needed**:
- User preferences (from account system or local storage)
- Route scores (to be adjusted)
- Preference weights or adjustments

**API/Interface Notes**:
- Preference storage and retrieval
- Scoring algorithm that incorporates preferences
- Score adjustment display

**Testing Notes**:
- Test preference application to scores
- Test ranking changes with preferences
- Test multiple preferences together
- Test preference display clarity

**Open Questions**:
- Which preferences to support? (Avoid poorly lit, prioritise accessibility, avoid heat, etc.)
- How to weight preferences? (Simple multipliers or complex algorithm?)
- Should preferences be saved? (Requires account system)

---

## Data Needed

### Scoring Data
- Lighting data along routes (LUX, perception, street lighting)
- Accessibility data along routes (audits, Council assets, crossings)
- Climate data along routes (heat, canopy, shade)
- Route geometries (to match data to routes)

### Confidence Data
- Data coverage metrics (percentage of route with data)
- Data recency (how old is the data)
- Data source reliability (Council > environmental > community, generally)
- Data agreement (do multiple sources agree?)

### User Preferences (v1)
- Preference settings (avoid poorly lit, prioritise accessibility, etc.)
- Preference weights or adjustments

## API or Interface Notes

### Scoring Service
- Input: Route geometry, data layers, user preferences (optional)
- Output: Scores (lighting, accessibility, climate, overall), confidence levels, contributing factors
- Performance: Should complete quickly (target: < 1 second for typical route)

### Confidence Calculation
- Input: Data quality metrics, data sources, coverage
- Output: Confidence levels (high/medium/low or numeric)
- Algorithm: See ADR-005 in [`DECISIONS.md`](../DECISIONS.md)

### Ranking Service
- Input: Route scores, user preferences (optional)
- Output: Ranked route list
- Algorithm: Sort by overall score (or adjusted score with preferences), tie-break by distance or time if needed

## Testing Notes

### Functional Testing
- Test scoring accuracy with various route types
- Test score breakdown display
- Test route ranking
- Test confidence indicators
- Test user preferences integration (v1)

### Performance Testing
- Test scoring performance (target: < 1 second)
- Test ranking performance
- Test with large datasets

### User Testing
- Test score understandability (user testing recommended)
- Test transparency (do users understand how scores work?)
- Test confidence indicator clarity

### Edge Case Testing
- Routes with no data (all segments missing data)
- Routes with partial data (some segments have data, some don't)
- Routes with conflicting data (different sources disagree)
- Routes with very high or very low scores
- Routes with equal scores (tie-breaking)

## Open Questions

1. **Scoring scale**: What scale to use? (0-10, 0-100, stars, etc.)
2. **Score combination**: How to combine scores into overall? (Average, weighted, minimum, etc.)
3. **Missing data handling**: How to handle missing data? (Penalise, neutral, indicate uncertainty)
4. **Confidence model**: What confidence scoring model to use? (See ADR-005)
5. **Transparency level**: How detailed should score explanations be? (Simple vs comprehensive)
6. **User preferences**: Which preferences to support in v1? (Scope decision)
7. **Ranking criteria**: Should ranking consider distance/time? (Tie-breaking)

## Related Documents

- [`FLOWS/01_plan_route.md`](../FLOWS/01_plan_route.md): Route planning flow
- [`FLOWS/02_compare_routes.md`](../FLOWS/02_compare_routes.md): Route comparison flow
- [`REQS/routing.md`](routing.md): Routing requirements
- [`REQS/map_layers.md`](map_layers.md): Map layer requirements
- [`DECISIONS.md`](../DECISIONS.md): Architecture decisions (ADR-005, ADR-007)
