# YourWalk Delivery Plan

This document provides a practical, sprint-by-sprint delivery plan that Council and the delivery team can use to track progress and coordinate activities. It maps phases to sprints, identifies dependencies, and outlines what's needed from Council at each step.

## Sprint Structure

- **Sprint length**: 2 weeks (adjustable based on team capacity)
- **Sprint planning**: First day of sprint, define goals and acceptance criteria
- **Sprint review**: Last day of sprint, demo completed work
- **Sprint retrospective**: After review, identify improvements

**Note**: Exact dates are not included as they depend on project start date. Use "Sprint 1", "Sprint 2" format.

## Phase: MVP (Sprints 1-6)

### Sprint 1: Foundation and Setup

**Objective**: Establish development environment, make core architecture decisions, set up project infrastructure.

**Activities**:
- **Product**: Finalise PRD review, confirm pilot area boundaries with Council
- **Engineering**: Set up development environment, CI/CD pipeline, project structure
- **Data**: Identify and confirm access to core data sources (one per stream minimum)
- **Design**: Establish design system, UI patterns, map visualisation approach
- **Engagement**: Begin engagement material planning

**Decisions Required**:
- Routing engine approach (ADR-001)
- Map technology choice (ADR-002)
- Data storage strategy (ADR-003)

**Council Dependencies**:
- Confirm pilot area boundaries
- Confirm data access (footpath assets, lighting assets, if available)
- Provide base map data or confirm public data sources

**Deliverables**:
- Development environment operational
- Architecture decisions documented
- Pilot area boundaries confirmed
- Data source access confirmed

---

### Sprint 2: Base Map and Routing

**Objective**: Implement base map interface and basic routing functionality.

**Activities**:
- **Engineering**: Implement map interface, routing integration, route display
- **Data**: Load pilot area base map data, street network data
- **Product**: Validate routing UX, confirm route calculation approach
- **Design**: Finalise map UI patterns, route visualisation

**Council Dependencies**:
- Review pilot area boundaries
- Confirm street network data source

**Deliverables**:
- Map interface loads with pilot area
- Users can enter origin/destination
- Routes calculate and display (2-3 options)
- Route shows distance and estimated time

---

### Sprint 3: Data Integration and Scoring

**Objective**: Integrate data sources and implement basic scoring system.

**Activities**:
- **Engineering**: Implement data ingestion pipeline, scoring algorithm, score display
- **Data**: Load and validate data sources (lighting, accessibility, climate)
- **Product**: Validate scoring approach, confirm score breakdown display
- **Design**: Design score visualisation, confidence indicators

**Council Dependencies**:
- Provide asset data (if available) or confirm public sources
- Review data quality and coverage

**Deliverables**:
- Data sources loaded and validated
- Routes show scores (lighting, accessibility, climate, overall)
- Score breakdown visible
- Basic confidence indicators displayed

---

### Sprint 4: Map Layers

**Objective**: Implement map layer toggles for each data stream.

**Activities**:
- **Engineering**: Implement layer system, visualisations for each stream
- **Data**: Prepare layer data, create visualisation styles
- **Product**: Validate layer UX, confirm legend and source indicators
- **Design**: Finalise layer visualisations, legends, source indicators

**Council Dependencies**:
- Review layer visualisations for accuracy
- Confirm data source attribution

**Deliverables**:
- Users can toggle lighting layer
- Users can toggle accessibility layer
- Users can toggle climate layer
- Legends and source indicators visible

---

### Sprint 5: Community Submissions

**Objective**: Implement accessibility audit submission form and display.

**Activities**:
- **Engineering**: Implement submission form, data storage, moderation workflow, map display
- **Product**: Validate submission UX, confirm moderation approach
- **Design**: Finalise form design, submission confirmation
- **Engagement**: Prepare submission prompts and guidance

**Decisions Required**:
- Submission moderation approach (ADR-006)

**Council Dependencies**:
- Review submission form design
- Confirm moderation approach and resources

**Deliverables**:
- Users can submit accessibility audits
- Submissions appear on map
- Basic moderation workflow (approach TBD)
- Submission confirmation displayed

---

### Sprint 6: Council Insights and MVP Polish

**Objective**: Implement Council insights dashboard and complete MVP quality bar.

**Activities**:
- **Engineering**: Implement insights dashboard, hotspot visualisation, basic aggregation
- **Product**: Validate insights UX with Council staff
- **Design**: Finalise insights dashboard design
- **Testing**: Complete functional, performance, accessibility testing
- **Engagement**: Finalise engagement materials, prepare launch

**Council Dependencies**:
- Test insights dashboard, provide feedback
- Confirm Council access approach (accounts, IP restriction, etc.)
- Review engagement materials
- Confirm launch timeline

**Deliverables**:
- Council insights dashboard operational
- Hotspot map displays issue density
- All MVP acceptance criteria pass
- Quality bar met (functional, performance, accessibility, privacy)
- Engagement materials ready
- MVP demo script successful

---

## Phase: Beta (Sprints 7-10)

### Sprint 7: Route Comparison

**Objective**: Implement side-by-side route comparison with detailed breakdowns.

**Activities**:
- **Engineering**: Implement comparison view, detailed score breakdowns, route selection
- **Product**: Validate comparison UX
- **Design**: Design comparison interface, score breakdown visualisation

**Council Dependencies**: None (internal feature)

**Deliverables**:
- Users can compare routes side-by-side
- Detailed score breakdowns visible
- Route differences highlighted
- Users can select route from comparison

---

### Sprint 8: Additional Submission Types

**Objective**: Implement lighting observation and heat/shade feedback submission forms.

**Activities**:
- **Engineering**: Implement lighting and heat/shade forms, data storage, map display
- **Product**: Validate form UX, confirm optional LUX measurement approach
- **Design**: Finalise form designs
- **Engagement**: Update submission prompts

**Council Dependencies**:
- Review new submission forms
- Confirm LUX measurement approach (if applicable)

**Deliverables**:
- Users can submit lighting observations
- Users can submit heat/shade feedback
- Optional LUX measurements supported (if applicable)
- Submissions appear on map

---

### Sprint 9: User Contributions and Enhanced Insights

**Objective**: Implement user contribution tracking and enhanced insights filtering.

**Activities**:
- **Engineering**: Implement contribution tracking, filtering system, enhanced insights
- **Product**: Validate contribution view UX, insights filtering
- **Design**: Design contribution highlighting, filter UI
- **Data**: Improve data coverage through engagement

**Council Dependencies**:
- Test enhanced insights, provide feedback
- Support community engagement to increase contributions

**Deliverables**:
- Users can see their own contributions
- Insights support filtering by stream, issue type, time period
- Data coverage improved (target: 30%+ pilot area)

---

### Sprint 10: Exports and Beta Polish

**Objective**: Implement export functionality and complete Beta quality bar.

**Activities**:
- **Engineering**: Implement export system (PDF, CSV), report generation
- **Product**: Validate export UX with Council staff
- **Design**: Design export templates
- **Testing**: Complete Beta testing, performance validation
- **Engagement**: Continue community engagement, gather feedback

**Council Dependencies**:
- Test export functionality, provide feedback
- Confirm export requirements and formats
- Review export templates

**Deliverables**:
- Council can export hotspot reports (PDF, CSV)
- Exports include metadata
- All Beta acceptance criteria pass
- Quality bar met
- Community engagement showing participation

---

## Phase: v1 (Sprints 11-16)

### Sprint 11-12: Optional Accounts

**Objective**: Implement optional user account system with contribution history and saved routes.

**Activities**:
- **Engineering**: Implement authentication, account system, contribution tracking, saved routes
- **Product**: Validate account UX, confirm privacy controls
- **Design**: Design account interface, privacy controls
- **Security**: Security review, privacy audit

**Decisions Required**:
- Privacy stance finalisation (ADR-004)

**Council Dependencies**:
- Review privacy controls
- Confirm account requirements

**Deliverables**:
- Users can create optional accounts
- Contribution history visible
- Routes can be saved
- Privacy controls implemented
- Security review passed

---

### Sprint 13: User Preferences and Enhanced Routing

**Objective**: Implement user preferences that affect route scoring and ranking.

**Activities**:
- **Engineering**: Implement preference system, scoring algorithm updates, preference persistence
- **Product**: Validate preference UX, confirm preference options
- **Design**: Design preference interface

**Council Dependencies**: None (internal feature)

**Deliverables**:
- Users can set routing preferences
- Route scores adjust based on preferences
- Preferences saved (if logged in)

---

### Sprint 14: Advanced Insights

**Objective**: Implement corridor analysis and prioritisation evidence.

**Activities**:
- **Engineering**: Implement corridor identification, prioritisation algorithm, visualisation
- **Product**: Validate insights with Council staff
- **Design**: Design corridor and prioritisation visualisations

**Council Dependencies**:
- Test advanced insights, provide feedback
- Confirm prioritisation criteria

**Deliverables**:
- Corridor analysis visible
- Prioritisation evidence displayed
- Council can export corridor and prioritisation reports

---

### Sprint 15: Comprehensive Exports and Trends

**Objective**: Implement comprehensive exports and basic trend indicators.

**Activities**:
- **Engineering**: Implement enhanced exports, trend calculation, time-series filtering
- **Product**: Validate export and trend UX
- **Design**: Design trend visualisations, export options

**Council Dependencies**:
- Test comprehensive exports
- Confirm trend requirements

**Deliverables**:
- Multiple export formats supported
- Custom filters and date ranges
- Basic trend indicators visible
- Exports include trend data

---

### Sprint 16: v1 Polish and Evaluation

**Objective**: Complete v1 quality bar, integrate evaluation tools, prepare for production.

**Activities**:
- **Engineering**: Performance optimisations, accessibility refinements, evaluation integration
- **Product**: Final UX polish, user testing
- **Testing**: Complete v1 testing, scalability testing
- **Documentation**: User guides, Council training materials
- **Evaluation**: Set up analytics, in-app survey integration
- **Engagement**: Prepare demo day, showcase materials

**Council Dependencies**:
- Final testing and sign-off
- Review user documentation
- Participate in training
- Support demo day/showcase
- Confirm evaluation approach

**Deliverables**:
- All v1 acceptance criteria pass
- Quality bar met
- User documentation complete
- Council training completed
- Evaluation tools integrated
- Production deployment ready
- Demo day materials ready

---

## Pilot Area Onboarding Checklist

Before MVP can launch, the following must be complete:

- [ ] Pilot area boundaries defined and confirmed with Council
- [ ] Base map data loaded for pilot area
- [ ] Street network data loaded and validated
- [ ] At least one data source per stream available (lighting, accessibility, climate)
- [ ] Data quality validated (coverage, accuracy, recency)
- [ ] Council data access confirmed (if applicable)
- [ ] Community engagement plan finalised
- [ ] Engagement materials ready (web page, posters, etc.)
- [ ] Council comms support confirmed
- [ ] Analytics instrumentation ready
- [ ] Privacy policy published
- [ ] Terms of use published
- [ ] Support contact information confirmed

---

## Go-Live Checklist

Before public launch, the following must be complete:

- [ ] All acceptance criteria for current phase pass
- [ ] Quality bar met (functional, performance, accessibility, privacy)
- [ ] Security review completed
- [ ] Privacy audit completed
- [ ] Performance tested under expected load
- [ ] Error handling and monitoring in place
- [ ] Backup and recovery procedures tested
- [ ] Council staff trained on insights dashboard
- [ ] User documentation published
- [ ] Engagement materials distributed
- [ ] Council web page updated (if applicable)
- [ ] Social media accounts ready (if applicable)
- [ ] Support process defined and staffed
- [ ] Evaluation framework ready
- [ ] Demo script prepared and tested
- [ ] Stakeholder sign-off obtained

---

## Dependencies and Risks

### Critical Dependencies

- **Council data access**: Delays in data access will block data integration sprints
- **Pilot area confirmation**: Needed before Sprint 1 completion
- **Council review cycles**: Budget time for Council feedback in each sprint
- **Community engagement support**: Council comms support needed for engagement activities

### Risk Mitigation

- Start data access conversations early (pre-Sprint 1)
- Have fallback data sources identified for each stream
- Build buffer time into sprints for Council review cycles
- Plan engagement activities with sufficient lead time

---

## Council Touchpoints

### Sprint Reviews (End of Each Sprint)

- Demo completed work
- Gather feedback on UX and functionality
- Confirm next sprint priorities

### Key Decision Points

- **Sprint 1**: Architecture decisions, pilot area boundaries
- **Sprint 3**: Data quality review, scoring approach
- **Sprint 5**: Submission form review, moderation approach
- **Sprint 6**: Insights dashboard review, launch planning
- **Sprint 10**: Export review, Beta completion
- **Sprint 14**: Advanced insights review
- **Sprint 16**: Final sign-off, production readiness

### Regular Updates

- Weekly status updates (brief, focused on blockers and decisions)
- Monthly progress report (usage, engagement, insights)
- End-of-phase reports (MVP, Beta, v1 completion)

---

## Success Criteria by Phase

### MVP Success

- Routes calculate correctly for pilot area
- All three data streams visible and functional
- Community submissions working
- Council insights dashboard operational
- Quality bar met
- Engagement materials ready

### Beta Success

- All submission types functional
- Route comparison working
- Exports generating correctly
- Data coverage 30%+ of pilot area
- Community engagement showing participation
- Council using insights for decision-making

### v1 Success

- All core features complete
- Data coverage 50%+ of pilot area
- Performance and scalability validated
- User documentation complete
- Council trained and using system
- Evaluation data collection in progress
- Grant reporting metrics available
