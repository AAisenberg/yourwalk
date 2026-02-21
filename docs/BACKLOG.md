# YourWalk Backlog

This backlog is organised by priority: Now (current phase), Next (upcoming phase), Later (future phases), and Icebox (ideas for future consideration). Items are written as vertical slices (end-to-end user value) rather than component tasks.

Each item links to relevant Flow or Reqs documents and includes acceptance criteria. Items move between sections as priorities change.

## Definition of Done

Before a backlog item is considered complete, it must meet all of the following:

- [ ] All acceptance criteria pass (Given/When/Then format)
- [ ] Code reviewed and approved
- [ ] Automated tests written and passing (unit, integration, E2E as appropriate)
- [ ] Manual testing completed against acceptance criteria
- [ ] Accessibility verified (keyboard navigation, screen reader, WCAG 2.1 AA)
- [ ] Performance targets met (load times, render performance)
- [ ] Data provenance and confidence indicators visible (where applicable)
- [ ] Privacy and security review completed (where applicable)
- [ ] Documentation updated (user guides, technical docs, API docs)
- [ ] Telemetry events implemented and verified
- [ ] Design review completed (if UI changes)
- [ ] Stakeholder sign-off (for user-facing features)

## Data Investigation (Pre-MVP)

### D1: Finalise base data set list and LGA-specific layer for Casey
**Links**: [`DATA_SET_REGISTER.md`](DATA_SET_REGISTER.md), [`DATA_SOURCES.md`](DATA_SOURCES.md)

**Description**: Review the Data Set Register, confirm data access for essential datasets, and request any missing data from Casey Council.

**Acceptance Criteria**:
- Given the Data Set Register has been created
- When the team reviews and validates findings
- Then essential datasets (lighting assets, footpaths, crossings) are confirmed accessible
- And any gaps (e.g., general pedestrian crossings) are requested from Council
- And YourGround data access is confirmed with XYX Lab
- And data ingestion priorities are documented in DATA_SOURCES.md

**Dependencies**: Council data request, XYX Lab liaison

**Status**: In progress (Data Set Register complete; validation pending)

---

## Now (MVP Phase)

### N1: Plan route between two points
**Links**: [`FLOWS/01_plan_route.md`](FLOWS/01_plan_route.md), [`REQS/routing.md`](REQS/routing.md)

**Description**: User can enter origin and destination, see route options on map with basic scores.

**Acceptance Criteria**:
- Given a user is on the map interface
- When they enter an origin and destination (address or map click)
- Then 2-3 route options are calculated and displayed
- And each route shows distance, estimated time, and overall score
- And routes are clickable to see details

**Dependencies**: Routing engine decision, base map data, pilot area boundaries

---

### N2: Display basic route scoring
**Links**: [`REQS/scoring_and_rankings.md`](REQS/scoring_and_rankings.md)

**Description**: Routes display scores for lighting, accessibility, and climate, with overall score.

**Acceptance Criteria**:
- Given a route is displayed
- When the user views the route details
- Then they see scores for lighting (0-10), accessibility (0-10), climate (0-10)
- And they see an overall score (0-10)
- And they see basic confidence indicators for each score component

**Dependencies**: Scoring algorithm, data sources for each stream

---

### N3: Toggle map layers for each stream
**Links**: [`REQS/map_layers.md`](REQS/map_layers.md)

**Description**: Users can toggle lighting, accessibility, and climate layers to see data visualised on map.

**Acceptance Criteria**:
- Given a user is viewing the map
- When they toggle the lighting layer
- Then lighting data is visualised on the map
- And a legend explains the visualisation
- And data source indicators are visible
- And the same works for accessibility and climate layers

**Dependencies**: Map technology decision, data visualisation approach, layer data

---

### N4: Submit accessibility audit observation
**Links**: [`FLOWS/03_accessibility_audit_submit.md`](FLOWS/03_accessibility_audit_submit.md), [`REQS/data_ingestion_versioning.md`](REQS/data_ingestion_versioning.md)

**Description**: Users can submit structured accessibility audits (Project Sidewalk style) that appear on the map.

**Acceptance Criteria**:
- Given a user wants to contribute
- When they click "Submit observation" and choose accessibility audit
- Then they can complete a form with location, surface quality, width, obstacles, gradients
- And their observation is saved
- And it appears on the map immediately
- And they receive confirmation

**Dependencies**: Submission form design, data storage, moderation approach

---

### N5: Council insights hotspot view
**Links**: [`FLOWS/06_council_insights_view.md`](FLOWS/06_council_insights_view.md), [`REQS/reporting_exports.md`](REQS/reporting_exports.md)

**Description**: Council staff can view aggregated hotspot map showing issue density across pilot area.

**Acceptance Criteria**:
- Given a Council staff member accesses the insights dashboard
- When they view the hotspot map
- Then they see issue density visualised (heat map style)
- And they can identify areas where multiple issues converge
- And data source and confidence information is visible

**Dependencies**: Insights aggregation logic, Council access control, hotspot visualisation

---

### N6: Data provenance and confidence indicators
**Links**: [`REQS/data_ingestion_versioning.md`](REQS/data_ingestion_versioning.md), [`REQS/privacy_safety_and_ethics.md`](REQS/privacy_safety_and_ethics.md)

**Description**: All displayed data shows source and confidence level, with clear language about limitations.

**Acceptance Criteria**:
- Given data is displayed on the map or in route details
- When the user views it
- Then they see the data source (community, Council, environmental)
- And they see confidence indicators (high/medium/low or numeric)
- And they see appropriate disclaimers (no safety guarantees)

**Dependencies**: Data model includes provenance, UI patterns for indicators

---

## Next (Beta Phase)

### X1: Compare routes side-by-side
**Links**: [`FLOWS/02_compare_routes.md`](FLOWS/02_compare_routes.md), [`REQS/scoring_and_rankings.md`](REQS/scoring_and_rankings.md)

**Description**: Users can view multiple routes side-by-side with detailed score breakdowns to make informed choices.

**Acceptance Criteria**:
- Given a user has route options
- When they click "Compare routes"
- Then they see routes displayed side-by-side
- And each route shows detailed score breakdown (lighting/accessibility/climate components)
- And differences between routes are highlighted
- And they can select a route from the comparison view

**Dependencies**: Route comparison UI, detailed scoring breakdowns

---

### X2: Submit lighting observation
**Links**: [`FLOWS/04_lighting_observation_submit.md`](FLOWS/04_lighting_observation_submit.md)

**Description**: Users can submit lighting observations with optional LUX measurements.

**Acceptance Criteria**:
- Given a user wants to contribute lighting data
- When they complete a lighting observation form
- Then they can specify location, time, lighting quality, optional LUX measurement
- And their observation is saved and appears on the map
- And it contributes to lighting layer visualisation

**Dependencies**: Lighting observation form design, LUX measurement integration (if available)

---

### X3: Submit heat/shade feedback
**Links**: [`FLOWS/05_heat_shade_feedback_submit.md`](FLOWS/05_heat_shade_feedback_submit.md)

**Description**: Users can submit thermal comfort observations about heat and shade.

**Acceptance Criteria**:
- Given a user wants to contribute climate data
- When they complete a heat/shade feedback form
- Then they can specify location, time, perceived comfort, shade availability
- And their observation is saved and appears on the map
- And it contributes to climate layer visualisation

**Dependencies**: Heat/shade feedback form design

---

### X4: View own contributions
**Links**: [`REQS/accounts_and_roles.md`](REQS/accounts_and_roles.md)

**Description**: Users can see their own submitted observations highlighted on the map.

**Acceptance Criteria**:
- Given a user has submitted observations
- When they view the map
- Then they can see their own contributions highlighted (different colour/style)
- And they can see how many contributions they've made
- And they can click to view details of their contributions

**Dependencies**: Contribution tracking (anonymous or account-based), UI for highlighting

---

### X5: Export hotspot reports
**Links**: [`FLOWS/07_export_report.md`](FLOWS/07_export_report.md), [`REQS/reporting_exports.md`](REQS/reporting_exports.md)

**Description**: Council can export hotspot reports in PDF and CSV formats.

**Acceptance Criteria**:
- Given a Council staff member views hotspots
- When they select an area and click "Export report"
- Then they can download a PDF with summary and visualisations
- And they can download CSV data for the selected area
- And exports include metadata (date ranges, data sources, confidence)

**Dependencies**: Export generation system, PDF/CSV templates

---

### X6: Enhanced insights filtering
**Links**: [`REQS/reporting_exports.md`](REQS/reporting_exports.md)

**Description**: Council insights dashboard supports filtering by data stream, issue type, and time period.

**Acceptance Criteria**:
- Given a Council staff member views insights
- When they apply filters (by stream, issue type, date range)
- Then the hotspot map updates to show filtered data
- And summary statistics update accordingly
- And exports respect the active filters

**Dependencies**: Filtering UI, backend filtering logic

---

## Later (v1 Phase)

### L1: Optional user accounts
**Links**: [`REQS/accounts_and_roles.md`](REQS/accounts_and_roles.md)

**Description**: Users can create optional accounts to track contributions, save routes, and manage preferences.

**Acceptance Criteria**:
- Given a user wants to create an account
- When they sign up (email/password)
- Then they can see their contribution history
- And they can save favourite routes
- And their data is stored securely with privacy controls
- And anonymous usage remains available

**Dependencies**: Authentication system, account data model, privacy controls

---

### L2: User preferences for routing
**Links**: [`REQS/routing.md`](REQS/scoring_and_rankings.md)

**Description**: Users can set preferences (e.g., avoid poorly lit routes, prioritise accessibility) that affect route scoring.

**Acceptance Criteria**:
- Given a user sets preferences
- When they plan a route
- Then route scores are adjusted to reflect their preferences
- And route rankings update accordingly
- And preferences are saved for future sessions (if logged in)

**Dependencies**: Preference system, scoring algorithm updates

---

### L3: Corridor analysis
**Links**: [`REQS/reporting_exports.md`](REQS/reporting_exports.md)

**Description**: Council can view corridor analysis identifying routes with multiple issues that need attention.

**Acceptance Criteria**:
- Given Council views insights
- When they access corridor analysis
- Then they see routes/streets with multiple issues highlighted
- And they can see which issues affect each corridor
- And they can export corridor reports

**Dependencies**: Corridor identification algorithm, visualisation

---

### L4: Prioritisation evidence
**Links**: [`REQS/reporting_exports.md`](REQS/reporting_exports.md)

**Description**: Council insights include prioritisation scores based on issue density and user impact.

**Acceptance Criteria**:
- Given Council views insights
- When they view prioritisation evidence
- Then they see areas scored by issue density and user impact
- And they can understand why areas are prioritised
- And they can export prioritisation reports

**Dependencies**: Prioritisation algorithm, user impact metrics

---

### L5: Comprehensive exports
**Links**: [`FLOWS/07_export_report.md`](FLOWS/07_export_report.md), [`REQS/reporting_exports.md`](REQS/reporting_exports.md)

**Description**: Council can export data with custom filters, date ranges, and multiple formats.

**Acceptance Criteria**:
- Given Council wants to export data
- When they configure export (filters, date range, format)
- Then they can download reports in multiple formats (PDF, CSV, GeoJSON)
- And exports include all requested data with metadata
- And large exports complete within reasonable time

**Dependencies**: Export system enhancements, format support

---

### L6: Basic trend indicators
**Links**: [`REQS/data_ingestion_versioning.md`](REQS/data_ingestion_versioning.md)

**Description**: Council can see basic trend indicators showing improving/declining areas over time.

**Acceptance Criteria**:
- Given the system has collected data over time
- When Council views insights with time filter
- Then they can see trend indicators (improving/declining/stable)
- And they can filter by time period
- And exports include trend data where available

**Dependencies**: Time-series data storage, trend calculation

---

## Icebox (Future Consideration)

### I1: Mobile native apps
**Description**: Native iOS and Android apps for better mobile experience.

**Considerations**: Web app performance, user demand, development resources

---

### I2: Real-time route updates
**Description**: Real-time updates when new observations are submitted that affect current route.

**Considerations**: Real-time infrastructure, user value, complexity

---

### I3: Historical trend analysis
**Description**: Detailed historical analysis showing how conditions change over months/years.

**Considerations**: Data retention, storage costs, analysis complexity

---

### I4: Integration with Council systems
**Description**: API integration with Council asset management and planning systems.

**Considerations**: Council system capabilities, API availability, data standards

---

### I5: Advanced analytics and ML
**Description**: Machine learning models for route prediction, issue prediction, prioritisation.

**Considerations**: Data requirements, model complexity, interpretability

---

### I6: Multi-LGA support
**Description**: Scale to support multiple local government areas with shared infrastructure.

**Considerations**: Architecture scalability, data isolation, Council-specific customisation

---

### I7: Community moderation tools
**Description**: Community members can moderate or validate observations from others.

**Considerations**: Moderation model, quality control, community dynamics

---

### I8: Route sharing and collaboration
**Description**: Users can share routes with others, collaborate on route planning.

**Considerations**: Privacy, use cases, implementation complexity

---

### I9: Offline mode
**Description**: Download map data and plan routes offline.

**Considerations**: Data size, storage, update mechanism

---

### I10: Integration with public transport
**Description**: Combine walking routes with public transport options.

**Considerations**: Transport data availability, routing complexity, user value
