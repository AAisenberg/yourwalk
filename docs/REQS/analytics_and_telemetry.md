# Requirements: Analytics and Telemetry

## Scope

This document defines requirements for analytics, telemetry, and usage tracking to support evaluation, product improvement, and grant reporting. It emphasises privacy and anonymous tracking.

## Requirements

### R1: Anonymous Usage Analytics

**Requirement**: System must track anonymous usage metrics (page views, sessions, feature usage) without personally identifying users.

**Acceptance Criteria**:
- Given users interact with the system
- When analytics events occur
- Then usage is tracked anonymously (no user IDs, no personal information)
- And page views are tracked (which pages, how long)
- And sessions are tracked (session start, end, duration)
- And feature usage is tracked (which features used, how often)
- And analytics data is aggregated (no individual tracking)

**Data Needed**:
- Anonymous session identifiers (session-based, not user-based)
- Page view events
- Session events
- Feature usage events

**API/Interface Notes**:
- Analytics service (Google Analytics, custom, or privacy-focused alternative)
- Event tracking implementation
- Anonymous session management

**Testing Notes**:
- Test analytics tracking accuracy
- Test anonymous tracking (no personal information)
- Test session tracking
- Test feature usage tracking
- Test privacy compliance

**Open Questions**:
- Which analytics service? (Google Analytics, privacy-focused alternative, or custom)
- Should analytics be opt-in or opt-out? (Opt-out with clear notice probably acceptable)
- What level of detail? (Aggregated vs individual, balance privacy and insights)

---

### R2: Route Planning Events

**Requirement**: System must track route planning events to understand usage patterns and route selection.

**Acceptance Criteria**:
- Given users plan routes
- When route planning events occur
- Then origin/destination are tracked (anonymised, aggregated)
- And route selection is tracked (which route chosen, why)
- And route comparison usage is tracked (if feature available)
- And route planning success/failure is tracked

**Data Needed**:
- Route planning events (origin, destination, route selected, outcome)
- Route comparison events (if applicable)
- Error events (if route planning fails)

**API/Interface Notes**:
- Route planning event tracking
- Event parameters (anonymised)
- Error tracking

**Testing Notes**:
- Test route planning event tracking
- Test event parameter anonymisation
- Test error tracking
- Test privacy compliance

**Open Questions**:
- How to anonymise origin/destination? (Aggregate to areas, not precise coordinates)
- Should we track route selection reasons? (If available, but may be complex)
- What error details to track? (Enough for debugging, but not sensitive)

---

### R3: Submission Events

**Requirement**: System must track submission events to understand contribution patterns and submission success rates.

**Acceptance Criteria**:
- Given users submit observations
- When submission events occur
- Then submission initiation is tracked (type, location area)
- And submission completion is tracked (success, failure, abandonment)
- And submission type is tracked (accessibility, lighting, heat/shade)
- And submission location is tracked (anonymised, aggregated to areas)
- And submission quality is tracked (if applicable, completeness, validation)

**Data Needed**:
- Submission events (type, location area, outcome, quality metrics)
- Submission abandonment events (if user starts but doesn't complete)
- Submission error events (if submission fails)

**API/Interface Notes**:
- Submission event tracking
- Event parameters (anonymised)
- Quality metrics tracking

**Testing Notes**:
- Test submission event tracking
- Test event parameter anonymisation
- Test abandonment tracking
- Test error tracking
- Test privacy compliance

**Open Questions**:
- How to anonymise submission location? (Aggregate to areas, not precise coordinates)
- Should we track submission quality? (Helpful for improvement, but may be complex)
- Should we track submission reasons? (Why users contribute, but may require survey)

---

### R4: Layer and Map Interaction Events

**Requirement**: System must track map layer usage and map interactions to understand how users explore data.

**Acceptance Criteria**:
- Given users interact with map layers
- When layer events occur
- Then layer toggles are tracked (which layers, when, how often)
- And layer viewing duration is tracked (how long layers are viewed)
- And map interactions are tracked (pan, zoom, click)
- And layer interaction patterns are tracked (which layers viewed together)

**Data Needed**:
- Layer toggle events (layer name, state, timestamp)
- Map interaction events (pan, zoom, click)
- Layer viewing duration
- Interaction patterns

**API/Interface Notes**:
- Layer event tracking
- Map interaction tracking
- Event aggregation (to avoid excessive events)

**Testing Notes**:
- Test layer event tracking
- Test map interaction tracking
- Test event aggregation (not too many events)
- Test privacy compliance

**Open Questions**:
- How detailed should map interaction tracking be? (Balance insights vs privacy, probably aggregated)
- Should we track specific map locations? (Probably not, too sensitive)
- How to aggregate events? (Batch, sample, or aggregate)

---

### R5: Council Insights Usage Events

**Requirement**: System must track Council insights dashboard usage to understand how insights are used for decision-making.

**Acceptance Criteria**:
- Given Council staff use insights dashboard
- When insights events occur
- Then dashboard access is tracked (frequency, duration)
- And filter usage is tracked (which filters, how often)
- And hotspot exploration is tracked (which hotspots viewed)
- And export usage is tracked (what exported, how often)
- And insights usage patterns are tracked

**Data Needed**:
- Insights dashboard access events
- Filter usage events
- Hotspot exploration events
- Export events
- Usage patterns

**API/Interface Notes**:
- Insights event tracking
- Event parameters (anonymised for Council staff)
- Export tracking

**Testing Notes**:
- Test insights event tracking
- Test filter usage tracking
- Test export tracking
- Test privacy compliance (Council staff data)

**Open Questions**:
- Should Council staff usage be anonymised? (Probably yes, aggregate by role not individual)
- What level of detail? (Enough for evaluation, but not surveillance)
- Should we track export content? (Probably not, too sensitive)

---

### R6: Performance Metrics

**Requirement**: System must track performance metrics to monitor system health and identify performance issues.

**Acceptance Criteria**:
- Given system operations occur
- When performance events occur
- Then page load times are tracked
- And route calculation times are tracked
- And API response times are tracked
- And error rates are tracked
- And performance issues are alerted

**Data Needed**:
- Performance metrics (load times, calculation times, response times)
- Error metrics (error rates, error types)
- System health metrics

**API/Interface Notes**:
- Performance monitoring service
- Error tracking service
- Alerting system (if applicable)

**Testing Notes**:
- Test performance metric tracking
- Test error tracking
- Test alerting (if applicable)
- Test performance monitoring accuracy

**Open Questions**:
- Which performance monitoring service? (Custom, commercial, or open source)
- What performance thresholds? (Define based on requirements)
- Should alerts be automated? (Probably yes for critical issues)

---

### R7: Evaluation Metrics

**Requirement**: System must track metrics needed for pilot evaluation and grant reporting.

**Acceptance Criteria**:
- Given evaluation metrics are defined
- When relevant events occur
- Then evaluation metrics are tracked (usage, engagement, outcomes)
- And metrics are aggregated for reporting
- And metrics support grant reporting requirements
- And metrics are accessible for analysis

**Data Needed**:
- Evaluation metrics (from [`EVALUATION.md`](../EVALUATION.md))
- Metric definitions
- Aggregation logic

**API/Interface Notes**:
- Evaluation metric tracking
- Metric aggregation service
- Reporting API or dashboard

**Testing Notes**:
- Test evaluation metric tracking
- Test metric aggregation
- Test reporting accuracy
- Test grant reporting compliance

**Open Questions**:
- What are grant reporting requirements? (Define clearly)
- How often should metrics be reported? (Weekly, monthly, end of pilot)
- What format for reporting? (Dashboard, exports, presentations)

---

### R8: Privacy-Compliant Analytics

**Requirement**: All analytics must comply with privacy principles: anonymous, minimised, transparent, and secure.

**Acceptance Criteria**:
- Given analytics are collected
- When data is processed
- Then analytics are anonymous (no personal identification)
- And data collection is minimised (only necessary data)
- And data use is transparent (privacy policy explains analytics)
- And data is stored securely (encrypted, access restricted)
- And users can opt out (if applicable)

**Data Needed**:
- Privacy-compliant analytics configuration
- Opt-out mechanism (if applicable)
- Privacy policy updates

**API/Interface Notes**:
- Privacy-compliant analytics implementation
- Opt-out mechanism
- Secure storage

**Testing Notes**:
- Test privacy compliance
- Test anonymous tracking
- Test data minimisation
- Test opt-out mechanism (if applicable)
- Test secure storage

**Open Questions**:
- Should analytics be opt-in or opt-out? (Opt-out with clear notice probably acceptable)
- How to handle opt-out? (Respect user choice, but may limit insights)
- What level of anonymisation? (Aggregate to areas, no individual tracking)

---

## Data Needed

### Analytics Events
- Page view events
- Session events
- Feature usage events
- Route planning events
- Submission events
- Layer interaction events
- Insights usage events
- Performance metrics
- Error events

### Evaluation Metrics
- Usage metrics (unique users, sessions, return usage)
- Engagement metrics (submissions, layer usage, route planning)
- Council outcomes (insights usage, exports)
- Community engagement (participation, diversity)

### Privacy Configuration
- Anonymous tracking configuration
- Data minimisation settings
- Opt-out mechanism (if applicable)

## API or Interface Notes

### Analytics Service
- Event tracking API
- Event aggregation service
- Reporting API or dashboard
- Privacy-compliant implementation

### Performance Monitoring
- Performance metric collection
- Error tracking
- Alerting system (if applicable)

### Evaluation Dashboard
- Evaluation metric display
- Grant reporting exports
- Analysis tools

## Testing Notes

### Functional Testing
- Test analytics event tracking accuracy
- Test performance metric tracking
- Test error tracking
- Test evaluation metric tracking
- Test reporting accuracy

### Privacy Testing
- Test anonymous tracking (no personal information)
- Test data minimisation
- Test opt-out mechanism (if applicable)
- Test privacy compliance

### Performance Testing
- Test analytics performance (not degrade system performance)
- Test event aggregation (not too many events)
- Test reporting performance

### Edge Case Testing
- High event volume
- Missing events
- Invalid events
- Privacy opt-out scenarios

## Open Questions

1. **Analytics service**: Which service? (Google Analytics, privacy-focused alternative, or custom)
2. **Opt-in vs opt-out**: Should analytics be opt-in or opt-out? (Opt-out with clear notice)
3. **Anonymisation level**: How detailed? (Aggregate to areas, no individual tracking)
4. **Grant reporting**: What are requirements? (Define clearly)
5. **Performance monitoring**: Which service? (Custom, commercial, or open source)
6. **Evaluation dashboard**: What format? (Web dashboard, exports, or both)

## Related Documents

- [`EVALUATION.md`](../EVALUATION.md): Evaluation framework and metrics
- [`REQS/privacy_safety_and_ethics.md`](privacy_safety_and_ethics.md): Privacy requirements
- [`FLOWS/`](../FLOWS/): User flows (define telemetry events for each flow)
