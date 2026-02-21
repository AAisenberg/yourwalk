# YourWalk Product Requirements Document

## Overview

YourWalk is a map-first walking route and insights tool that helps residents choose walking routes that better fit their context and needs, while providing Council with evidence-based insights about where the walking network succeeds or fails. The tool integrates three streams of information: lighting and night-time safety perception, footpath and crossing accessibility, and climate resilience and comfort.

This PRD defines the product vision, requirements, and success criteria for the City of Casey Connecting Grant pilot. It is designed to be CEO-readable, with detailed requirements linked to companion documents.

## Problem Statement

Residents in Casey need better information to choose walking routes that match their needs and context. A route that's fine for a morning commute might be poorly lit at night. A path that works for an able-bodied adult might be inaccessible for someone using a mobility aid. A route that's pleasant in spring might be uncomfortably hot in summer.

Currently, residents lack tools that integrate these qualitative factors into route planning. Council also lacks systematic data about where the walking network fails across these dimensions, making it difficult to prioritise infrastructure investments.

YourWalk addresses this gap by combining community observations, Council asset data, and environmental data into a unified map-based experience that supports both resident decision-making and Council planning.

**Note**: Specific statistics about walking rates, safety incidents, or infrastructure gaps in Casey are not included here as they require Council data. These should be added when available.

## Target Users

### Primary Users

1. **Residents planning walking routes**: People who want to walk from A to B and need to understand route conditions
2. **Parents and carers**: People planning routes with children, prams, or mobility considerations
3. **People with mobility needs**: People using wheelchairs, mobility scooters, walking aids, or with other accessibility requirements
4. **Council project officers**: Staff who need evidence to support infrastructure planning and prioritisation decisions

### Secondary Users

5. **Council transport and urban design staff**: Staff who need insights about network performance
6. **Community engagement staff**: Staff who need to understand community concerns and priorities
7. **Researchers**: People studying walkability, accessibility, or urban heat who need access to aggregated data

## Goals and Non-Goals

### Goals

1. **Enable informed route choice**: Help residents choose routes that match their needs and context
2. **Surface network gaps**: Identify where the walking network fails across lighting, accessibility, and climate dimensions
3. **Support Council decision-making**: Provide evidence-based insights for infrastructure prioritisation
4. **Build community engagement**: Create a tool that residents want to use and contribute to
5. **Demonstrate pilot value**: Produce measurable outcomes that support grant reporting and potential scale

### Non-Goals

1. **Real-time navigation**: Not building turn-by-turn navigation; focus on route planning
2. **Crime prediction**: Not predicting or guaranteeing safety; focus on conditions and perceptions
3. **Comprehensive coverage**: Pilot focuses on Casey pilot area, not full LGA coverage
4. **Mobile apps**: Web-first for pilot; native apps are out of scope
5. **Historical trends**: Focus on current conditions; trend analysis may come later
6. **Advanced ML**: No complex machine learning or prediction models in pilot

## Key Journeys

Detailed user flows are documented in `docs/FLOWS/`. Key journeys include:

1. **Plan a route**: [`01_plan_route.md`](FLOWS/01_plan_route.md) - User enters origin and destination, views route options with insights
2. **Compare routes**: [`02_compare_routes.md`](FLOWS/02_compare_routes.md) - User views multiple route options side-by-side
3. **Submit accessibility audit**: [`03_accessibility_audit_submit.md`](FLOWS/03_accessibility_audit_submit.md) - User contributes accessibility observations
4. **Submit lighting observation**: [`04_lighting_observation_submit.md`](FLOWS/04_lighting_observation_submit.md) - User reports lighting conditions
5. **Submit heat/shade feedback**: [`05_heat_shade_feedback_submit.md`](FLOWS/05_heat_shade_feedback_submit.md) - User reports thermal comfort observations
6. **View Council insights**: [`06_council_insights_view.md`](FLOWS/06_council_insights_view.md) - Council staff view hotspots and prioritisation data
7. **Export report**: [`07_export_report.md`](FLOWS/07_export_report.md) - Council staff export data for decision-making

## Success Metrics

### Product Metrics

- **Route planning usage**: Number of routes planned per week/month
- **Community contributions**: Number of observations submitted per week/month
- **Route comparison usage**: Percentage of users who compare multiple routes
- **Layer engagement**: Which map layers are most frequently viewed
- **Return usage**: Percentage of users who return to use the tool again

### Engagement Metrics

- **Pilot participation**: Number of unique users during pilot period
- **Contribution diversity**: Geographic spread of contributions across pilot area
- **Survey response rate**: Percentage of users who complete end-of-pilot survey
- **Community feedback quality**: Qualitative feedback about usefulness and trust

### Council Outcomes

- **Insights usage**: Frequency of Council staff accessing insights dashboard
- **Export usage**: Number of reports exported for decision-making
- **Actionable insights**: Number of hotspots or corridors identified that inform planning
- **Evidence value**: Qualitative feedback from Council about decision support value

**Note**: Specific targets will be set during pilot planning based on engagement strategy and pilot area size.

## Constraints and Assumptions

### Privacy Constraints

- Must comply with Australian Privacy Principles
- Minimise collection of personally identifiable information
- Provide clear privacy notice and data handling transparency
- Support anonymous usage where possible

### Data Quality Constraints

- Community-contributed data will have varying quality and coverage
- Council asset data may be incomplete or outdated
- Environmental data may have spatial or temporal gaps
- Must clearly communicate data confidence and limitations

### Liability Constraints

- Cannot guarantee safety or predict crime
- Must use careful language about route recommendations
- Must include appropriate disclaimers
- Cannot be held responsible for user route choices

### Accessibility Constraints

- Must meet WCAG 2.1 AA standards
- Must work on common browsers and devices
- Must support keyboard navigation and screen readers
- Must provide alternative text and clear labels

### Performance Constraints

- Must load initial map view within 3 seconds on 4G connection
- Must support route calculation within 5 seconds for typical routes
- Must work on mid-range mobile devices
- Must handle pilot area data volumes efficiently

### Assumptions

- Council will provide access to relevant asset data (footpaths, lighting, crossings)
- Community will contribute observations during pilot period
- Pilot area will be clearly defined and communicated
- Council will support engagement activities (web page, comms channels)
- Internet connectivity available for users (web-based tool)

## Solution Overview

### User Experience

YourWalk presents a map-first interface where users can:

1. **Enter origin and destination** to plan a route
2. **View route options** with integrated insights about lighting, accessibility, and climate
3. **Toggle map layers** to see different data streams (lighting, accessibility, heat/shade)
4. **Compare routes** side-by-side with scoring and detailed breakdowns
5. **Contribute observations** through structured forms for each stream
6. **View confidence indicators** and data provenance for all information displayed

The interface emphasises transparency: users always know where data comes from, how confident we are in it, and what limitations apply.

### System Architecture (High Level)

- **Frontend**: Web-based map interface (technology choice pending, see [`DECISIONS.md`](DECISIONS.md))
- **Routing engine**: Calculates route options, then applies scoring/ranking (approach pending, see [`DECISIONS.md`](DECISIONS.md))
- **Data ingestion**: Processes community contributions, Council data, and environmental data sources
- **Scoring system**: Combines multiple data streams into route scores and layer visualisations
- **Insights engine**: Aggregates data for Council dashboard (hotspots, corridors, prioritisation)
- **Export system**: Generates reports and data exports for Council use

Detailed technical requirements are in `docs/REQS/`.

## Functional Requirements

### Routing Capability

Users must be able to plan routes between any two points in the pilot area. See [`REQS/routing.md`](REQS/routing.md) for detailed requirements.

**Key requirements**:
- Enter origin and destination (address, point on map, or current location)
- View multiple route options
- See route distance, estimated time, and integrated scores
- Understand why routes are scored as they are

### Map Layers

Users must be able to view different data streams as map layers. See [`REQS/map_layers.md`](REQS/map_layers.md) for detailed requirements.

**Key requirements**:
- Toggle lighting layer (LUX data, perception data, lighting density)
- Toggle accessibility layer (footpath audits, crossing assessments, Council asset data)
- Toggle climate layer (heat mapping, shade/canopy, exposure)
- View layer legends and data provenance
- Understand confidence levels for displayed data

### Scoring and Rankings

Routes must be scored and ranked based on integrated data streams. See [`REQS/scoring_and_rankings.md`](REQS/scoring_and_rankings.md) for detailed requirements.

**Key requirements**:
- Routes receive scores for lighting, accessibility, and climate
- Overall route score combines all three streams
- Scores are transparent: users can see breakdown and understand weighting
- Rankings help users choose between route options
- Confidence indicators show data quality for each score component

### Transparency and Data Provenance

All data must be transparent about source, confidence, and limitations. See [`REQS/data_ingestion_versioning.md`](REQS/data_ingestion_versioning.md) for detailed requirements.

**Key requirements**:
- Every data point shows source (community, Council, environmental)
- Confidence indicators visible throughout UI
- Clear language about limitations (no safety guarantees, perception data)
- Data versioning and update dates visible
- Links to data policies and privacy information

### Community Submissions

Users must be able to contribute observations for all three streams. See flow documents for detailed requirements.

**Key requirements**:
- Submit accessibility audits (Project Sidewalk style)
- Submit lighting observations (with optional LUX measurements)
- Submit heat/shade feedback
- View own contributions on map
- Understand how contributions are used

### Council Insights

Council staff must be able to access aggregated insights for decision-making. See [`REQS/reporting_exports.md`](REQS/reporting_exports.md) for detailed requirements.

**Key requirements**:
- View hotspots where multiple issues converge
- Identify corridors that need attention
- Access prioritisation evidence (issue density, user impact)
- Filter by data stream (lighting, accessibility, climate)
- Export reports and data for external analysis

### Data Exports

Council must be able to export data for use in other systems. See [`REQS/reporting_exports.md`](REQS/reporting_exports.md) for detailed requirements.

**Key requirements**:
- Export hotspot reports (PDF, CSV)
- Export route-level data
- Export raw observation data (anonymised)
- Include metadata (date ranges, data sources, confidence levels)

## Non-Functional Requirements

### Performance

- Initial map load: < 3 seconds on 4G
- Route calculation: < 5 seconds for typical routes
- Layer toggle: < 1 second
- Map pan/zoom: 60fps on mid-range devices

See [`REQS/performance_and_accessibility.md`](REQS/performance_and_accessibility.md) for detailed requirements.

### Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- Screen reader support
- Alternative text for all images and map elements
- Clear focus indicators

See [`REQS/performance_and_accessibility.md`](REQS/performance_and_accessibility.md) for detailed requirements.

### Privacy and Security

- Minimise data collection (anonymous where possible)
- Secure data storage and transmission
- Clear privacy policy and data handling transparency
- Support data deletion requests
- No tracking without consent

See [`REQS/privacy_safety_and_ethics.md`](REQS/privacy_safety_and_ethics.md) for detailed requirements.

### Browser and Device Support

- Modern browsers (Chrome, Firefox, Safari, Edge - last 2 versions)
- Mobile responsive (iOS and Android)
- Tablet support
- Graceful degradation for older browsers

## Data and Integrations

YourWalk integrates multiple data sources across three streams. See [`DATA_SOURCES.md`](DATA_SOURCES.md) for detailed information about:

- **Lighting data**: LUX measurements, perception data, street lighting assets
- **Accessibility data**: Community audits, Council footpath/crossing assets
- **Climate data**: Urban heat mapping, tree canopy, shade patterns
- **Base mapping**: Street network, addresses, points of interest

Data ingestion, versioning, and quality checks are documented in [`REQS/data_ingestion_versioning.md`](REQS/data_ingestion_versioning.md).

## Risks and Open Questions

See [`RISKS_AND_MITIGATIONS.md`](RISKS_AND_MITIGATIONS.md) for comprehensive risk register. Key risks include:

- Data quality gaps affecting route recommendations
- Interpretation risk (users assuming safety guarantees)
- Performance issues with large datasets
- Engagement fatigue (low participation)
- Bias in crowdsourced data
- IP/licensing constraints on data sources
- Privacy concerns about location data

Open questions are documented in relevant requirements documents and [`DECISIONS.md`](DECISIONS.md). Key open questions include:

- Routing engine approach (post-hoc ranking vs weighted cost routing)
- Map technology choice (MapLibre, Leaflet, etc.)
- Data storage and versioning strategy
- Privacy stance (anonymous by default vs accounts)
- Confidence scoring model for integrated layers

## Next Steps

1. Review and approve this PRD with stakeholders
2. Finalise technical decisions in [`DECISIONS.md`](DECISIONS.md)
3. Begin detailed requirements review in `docs/REQS/`
4. Start MVP planning using [`PHASES.md`](PHASES.md) and [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md)
