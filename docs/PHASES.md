# YourWalk Phase Definitions

This document defines the three delivery phases for YourWalk: MVP, Beta, and v1. Each phase has clear objectives, scope boundaries, acceptance criteria, instrumentation requirements, quality bars, and demo scripts.

## Phase: MVP (Minimum Viable Product)

### Objective

Deliver a vertical slice that demonstrates core value: a resident can plan a route, see integrated insights, and contribute an observation. Council can view basic aggregated insights. The MVP must be usable in a small pilot area and support initial community engagement.

### In Scope

- **Routing**: Plan route between two points, view 2-3 route options
- **Basic scoring**: Routes show overall score with simple breakdown (lighting, accessibility, climate)
- **Map layers**: Toggle one layer per stream (lighting, accessibility, climate) with basic visualisation
- **One submission type**: Users can submit accessibility audits (most structured, easiest to validate)
- **Basic insights**: Council can view hotspot map (issue density visualisation)
- **Data transparency**: Source indicators and basic confidence levels visible
- **Pilot area**: Single defined pilot area within Casey (boundaries TBD)
- **Web interface**: Responsive web app, no mobile app

### Out of Scope

- Route comparison side-by-side view
- Multiple submission types (lighting, heat/shade)
- Detailed route breakdowns and explanations
- Export functionality
- User accounts or profiles
- Advanced filtering or search
- Historical data or trends
- Real-time updates

### Acceptance Criteria

**Given** a user is on the YourWalk map interface  
**When** they enter an origin and destination in the pilot area  
**Then** they see 2-3 route options displayed on the map  
**And** each route shows distance, estimated time, and overall score  
**And** the score breakdown (lighting/accessibility/climate) is visible

**Given** a user is viewing a route  
**When** they toggle the lighting layer  
**Then** they see lighting data visualised on the map  
**And** a legend explains what the visualisation means  
**And** data source indicators are visible

**Given** a user wants to contribute data  
**When** they click "Submit observation" and complete an accessibility audit form  
**Then** their observation is saved  
**And** they see their observation appear on the map  
**And** they receive confirmation that their contribution was recorded

**Given** a Council staff member accesses the insights dashboard  
**When** they view the hotspot map  
**Then** they see issue density visualised across the pilot area  
**And** they can identify areas where multiple issues converge  
**And** data source and confidence information is visible

### Instrumentation Required

- **Route planning events**: Track origin/destination, route selected, layers viewed
- **Submission events**: Track submission type, location, completion rate
- **Insights access events**: Track Council dashboard views, filters used
- **Error events**: Track failures in route calculation, data loading, submissions
- **Performance metrics**: Track page load times, route calculation times, map render performance
- **Basic user analytics**: Unique users, sessions, return usage (anonymous)

### Quality Bar

**Functional Testing**:
- All acceptance criteria pass
- Routes calculate correctly for 50+ test origin/destination pairs in pilot area
- All three map layers render without errors
- Submission form validates input and saves successfully
- Insights dashboard loads and displays hotspot data

**Performance**:
- Initial map load < 3 seconds on 4G connection
- Route calculation < 5 seconds for routes up to 5km
- Layer toggle < 1 second
- Map pan/zoom maintains 60fps on mid-range mobile device

**Accessibility**:
- WCAG 2.1 AA compliance verified with automated and manual testing
- Keyboard navigation works throughout
- Screen reader tested (VoiceOver on iOS, NVDA on Windows)
- All images and map elements have alternative text

**Privacy**:
- No personally identifiable information collected without consent
- Privacy policy clearly displayed
- Data handling practices documented
- Anonymous usage supported

**Data Quality**:
- Data provenance visible for all displayed information
- Confidence indicators displayed where data quality varies
- Clear language about limitations (no safety guarantees)

### Demo Script

1. **Open YourWalk map** - Show clean, map-first interface
2. **Plan a route** - Enter "Casey Central Shopping Centre" as origin, "Casey RACE" as destination
3. **Show route options** - Highlight 2-3 routes with scores visible
4. **Explain scoring** - Show breakdown: "This route scores 7/10 for lighting, 6/10 for accessibility, 8/10 for climate"
5. **Toggle lighting layer** - Show lighting data visualised on map, explain legend
6. **Toggle accessibility layer** - Show footpath audits and Council data
7. **Toggle climate layer** - Show heat mapping and shade data
8. **Submit observation** - Complete accessibility audit form, show submission confirmation
9. **Switch to Council view** - Show insights dashboard, highlight hotspot areas
10. **Explain transparency** - Point out data sources and confidence indicators

**Duration**: 5-7 minutes

## Phase: Beta

### Objective

Expand functionality to support all three submission types, route comparison, and basic export. Improve data coverage and quality. Support broader community engagement with more sophisticated features.

### In Scope

- **All submission types**: Accessibility audits, lighting observations, heat/shade feedback
- **Route comparison**: Side-by-side view of multiple routes with detailed breakdowns
- **Enhanced scoring**: More sophisticated scoring with user preferences (e.g., prioritise accessibility)
- **Improved layers**: Multiple visualisation options per layer, better legends
- **Basic exports**: Council can export hotspot reports (PDF, CSV)
- **User contributions view**: Users can see their own contributions
- **Enhanced insights**: Filtering by data stream, issue type, time period
- **Better data coverage**: More community contributions, additional Council data sources

### Out of Scope

- User accounts or authentication
- Advanced analytics or machine learning
- Historical trend analysis
- Real-time collaboration features
- Mobile native apps
- Integration with external Council systems

### Acceptance Criteria

**Given** a user is viewing route options  
**When** they click "Compare routes"  
**Then** they see routes side-by-side with detailed score breakdowns  
**And** they can see which factors differ between routes  
**And** they can select a route from the comparison view

**Given** a user wants to contribute  
**When** they choose to submit a lighting observation  
**Then** they can complete a form with location, time, lighting quality, optional LUX measurement  
**And** their observation is saved and appears on the map  
**And** they can also submit heat/shade feedback using a similar flow

**Given** a Council staff member wants to export data  
**When** they select a hotspot area and click "Export report"  
**Then** they can download a PDF report with summary and visualisations  
**And** they can download CSV data for the selected area  
**And** exports include metadata (date ranges, data sources, confidence)

**Given** a user has submitted observations  
**When** they view the map  
**Then** they can see their own contributions highlighted  
**And** they can see how many contributions they've made

### Instrumentation Required

- All MVP instrumentation plus:
- **Comparison usage**: Track when users compare routes, which routes compared
- **Submission diversity**: Track submission types, geographic distribution
- **Export usage**: Track Council export frequency, report types downloaded
- **User preferences**: Track scoring preference selections
- **Engagement depth**: Track multi-session usage, contribution patterns

### Quality Bar

**Functional Testing**:
- All MVP tests pass
- All new acceptance criteria pass
- Route comparison works correctly for various route pairs
- All three submission types save and display correctly
- Export functionality generates valid PDFs and CSVs

**Performance**:
- All MVP performance targets maintained
- Comparison view loads within 2 seconds
- Export generation completes within 10 seconds for typical areas

**Accessibility**:
- WCAG 2.1 AA maintained
- Comparison view accessible via keyboard and screen reader
- Export documents accessible (PDF tags, CSV structure)

**Data Quality**:
- Data coverage improved (target: 30%+ of pilot area has at least one observation per stream)
- Confidence scoring refined based on data quality metrics
- Data provenance clearly documented for all new features

### Demo Script

1. **Recap MVP features** - Quick overview of route planning and basic layers
2. **Show route comparison** - Plan route, click compare, show side-by-side breakdown
3. **Demonstrate all submissions** - Show accessibility, lighting, and heat/shade forms
4. **Show user contributions** - Highlight user's own observations on map
5. **Council insights** - Show enhanced filtering (by stream, issue type)
6. **Export demonstration** - Select area, export PDF report, show contents
7. **Data coverage** - Show improved coverage with community contributions
8. **Transparency** - Emphasise data provenance and confidence throughout

**Duration**: 8-10 minutes

## Phase: v1 (Version 1.0)

### Objective

Production-ready release that supports full pilot evaluation, comprehensive Council insights, and demonstrates value for potential scale to other LGAs. All core features complete, robust data coverage, polished UX.

### In Scope

- **User accounts** (optional): Users can create accounts to track contributions, save routes
- **Advanced insights**: Corridor analysis, prioritisation evidence, trend indicators
- **Comprehensive exports**: Multiple export formats, custom date ranges, filtered exports
- **Enhanced routing**: User preferences (avoid poorly lit routes, prioritise accessibility)
- **Data quality improvements**: Validation, moderation, quality scoring
- **Performance optimisations**: Faster loading, better mobile experience
- **Accessibility refinements**: Full WCAG 2.1 AAA where feasible
- **Documentation**: User guides, Council training materials
- **Evaluation support**: In-app survey integration, analytics dashboard

### Out of Scope

- Multi-LGA support (architecture ready, but not implemented)
- Mobile native apps
- Real-time collaboration
- Advanced ML or prediction models
- Historical trend analysis beyond basic indicators
- Integration with external Council systems (APIs)

### Acceptance Criteria

**Given** a user wants to track their contributions  
**When** they create an optional account  
**Then** they can see their contribution history  
**And** they can save favourite routes  
**And** their data is stored securely with privacy controls

**Given** a Council staff member needs prioritisation evidence  
**When** they view the insights dashboard  
**Then** they can see corridor analysis (routes with multiple issues)  
**And** they can see prioritisation scores based on issue density and user impact  
**And** they can export comprehensive reports with evidence

**Given** a user has specific route preferences  
**When** they set preferences (e.g., "avoid poorly lit routes", "prioritise accessibility")  
**Then** route scores are adjusted to reflect their preferences  
**And** route rankings update accordingly  
**And** preferences are saved for future sessions (if logged in)

**Given** the system has collected data over time  
**When** Council views insights  
**Then** they can see basic trend indicators (improving/declining areas)  
**And** they can filter by time period  
**And** exports include trend data where available

### Instrumentation Required

- All Beta instrumentation plus:
- **Account usage**: Track account creation, login frequency, feature usage by account type
- **Preference usage**: Track which preferences are set, how they affect route selection
- **Corridor analysis**: Track which corridors are viewed, exported
- **Trend analysis**: Track time-period filtering, trend indicator usage
- **Evaluation metrics**: Survey completion rates, key metric tracking for grant reporting

### Quality Bar

**Functional Testing**:
- All Beta tests pass
- All new acceptance criteria pass
- Account system works securely (authentication, data isolation)
- Advanced insights calculate correctly
- Exports generate correctly for all formats and filters
- Performance maintained with increased data volumes

**Performance**:
- All previous performance targets maintained
- System handles 10x data volume from MVP (scalability tested)
- Advanced insights calculate within 5 seconds
- Exports generate within 15 seconds for large areas

**Accessibility**:
- WCAG 2.1 AA maintained, AAA where feasible
- Account system accessible
- All new features keyboard and screen reader accessible

**Data Quality**:
- Data coverage target: 50%+ of pilot area has observations across all streams
- Data validation and moderation processes in place
- Quality scoring refined and transparent

**Security**:
- Account system securely implemented (authentication, authorisation, data protection)
- Privacy controls working correctly
- Data exports properly anonymised

### Demo Script

1. **Full user journey** - Plan route with preferences, compare options, submit observation
2. **Account features** - Show contribution history, saved routes
3. **Advanced insights** - Show corridor analysis, prioritisation evidence, trends
4. **Comprehensive exports** - Export with custom filters, show multiple formats
5. **Data coverage** - Show comprehensive coverage across pilot area
6. **Transparency** - Emphasise data provenance, confidence, limitations throughout
7. **Evaluation readiness** - Show survey integration, analytics dashboard
8. **Production polish** - Highlight performance, accessibility, UX refinements

**Duration**: 10-12 minutes

## Phase Entry and Exit Criteria

### MVP Entry Criteria

- Pilot area boundaries defined and confirmed with Council
- Core data sources identified and access confirmed (at least one per stream)
- Technical architecture decisions made (routing engine, map tech, data storage)
- Design system and UI patterns established
- Development environment and CI/CD pipeline set up

### MVP Exit Criteria

- All MVP acceptance criteria pass
- Quality bar met (functional, performance, accessibility, privacy)
- Demo script successfully executed with stakeholders
- Community engagement materials ready
- Basic analytics instrumentation working
- Pilot area data loaded and validated

### Beta Entry Criteria

- MVP deployed and initial user feedback collected
- Data coverage baseline established
- Performance monitoring in place
- Community engagement launched
- Council staff trained on insights dashboard

### Beta Exit Criteria

- All Beta acceptance criteria pass
- Quality bar met
- Data coverage targets met (30%+ pilot area)
- Community engagement showing participation
- Export functionality validated by Council users
- Demo script successfully executed

### v1 Entry Criteria

- Beta feedback incorporated
- Data coverage targets met (50%+ pilot area)
- Evaluation framework ready
- Council insights validated as useful
- Performance and scalability validated

### v1 Exit Criteria

- All v1 acceptance criteria pass
- Quality bar met
- Production deployment successful
- User documentation complete
- Council training completed
- Evaluation data collection in progress
- Grant reporting metrics available
