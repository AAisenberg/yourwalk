# YourWalk Project Context

## What is YourWalk?

YourWalk is a map-first walking route and insights tool that helps people choose walking routes that better fit their context and needs. It combines three integrated streams of information to provide a comprehensive view of walking conditions: lighting and night-time safety perception, footpath and crossing accessibility, and climate resilience and comfort.

Unlike traditional routing tools that optimise only for distance or time, YourWalk helps users understand the qualitative aspects of walking routes. Is the path well-lit at night? Is it accessible for someone using a mobility aid? Will it be uncomfortably hot in summer? These questions matter when choosing how to get from A to B on foot.

For Council, YourWalk provides evidence-based insights about where the walking network succeeds or fails. It highlights hotspots where multiple issues converge, identifies corridors that need attention, and provides prioritisation evidence to support infrastructure investment decisions.

## The Three Integrated Streams

### 1. Lighting and Night-Time Safety Perception

This stream focuses on how well-lit routes are and how safe people feel walking them after dark. It includes:

- **LUX measurements**: Actual lighting levels where available from Council or community measurements
- **Perception data**: Community observations about lighting quality and perceived safety
- **Proxy indicators**: Street lighting density, time-of-day routing preferences, reported concerns

**Why it matters in Casey**: Many residents avoid walking at night due to poor lighting. Understanding where lighting is inadequate helps Council prioritise infrastructure improvements and helps residents make informed choices about when and where to walk.

### 2. Footpath and Crossing Accessibility

This stream maps the accessibility of footpaths and crossings for people with mobility needs. It includes:

- **Project Sidewalk style audits**: Community-contributed accessibility assessments (surface quality, width, obstacles, gradients)
- **Council asset information**: Where available, official data about footpath condition, width, and accessibility features
- **Crossing assessments**: Quality and accessibility of pedestrian crossings, including signal timing and tactile indicators

**Why it matters in Casey**: Accessible footpaths and crossings are essential for people using wheelchairs, mobility scooters, prams, or walking aids. This data helps people with mobility needs plan routes they can actually use, and helps Council identify gaps in the accessible network.

### 3. Climate Resilience and Comfort

This stream addresses how comfortable routes are to walk in different weather conditions, particularly heat. It includes:

- **Urban heat mapping**: Temperature data and heat island effects
- **Shade and canopy coverage**: Tree canopy data and shade patterns throughout the day
- **Exposure mapping**: Routes that are exposed to sun, wind, or other weather conditions
- **Seasonal considerations**: How conditions change across seasons

**Why it matters in Casey**: Extreme heat days are becoming more common. Routes with good shade and lower heat exposure are safer and more comfortable, especially for vulnerable populations. This helps people choose routes that are more comfortable in summer and helps Council prioritise tree planting and shade infrastructure.

## Grant Pilot Scope

### In Scope for Pilot

- **Geographic scope**: City of Casey pilot area (specific boundaries to be confirmed with Council)
- **Public-facing experience**: Web-based map interface for residents to plan routes and view insights
- **Community contributions**: Ability for residents to submit observations about lighting, accessibility, and heat/shade
- **Council insights dashboard**: Partner-ready view of hotspots, corridors, and prioritisation evidence
- **Data exports**: Ability for Council to export reports and data for decision-making
- **Community engagement**: Engagement activities to encourage participation and gather feedback
- **Evaluation**: End-of-pilot survey and usage analytics

### Out of Scope for Pilot (Future Scale)

- **Multi-LGA support**: Architecture will be scalable, but pilot focuses on Casey only
- **Mobile apps**: Web-first approach for pilot; native apps may come later
- **Real-time routing**: Initial focus on route planning, not turn-by-turn navigation
- **Historical trend analysis**: Pilot focuses on current conditions; trends may come in future versions
- **Advanced analytics**: Machine learning predictions or complex modelling beyond basic aggregation
- **Integration with Council systems**: Manual export for pilot; API integration may come later

## Documentation Map

This documentation set is organised to support both strategic decision-making and tactical delivery:

### Strategic Documents

- **`PRD.md`**: The stable spine. High-level product vision, goals, success metrics, and functional requirements. CEO-readable with links to detail.
- **`CONTEXT.md`**: This document. Project context, scope boundaries, and documentation structure.
- **`STAKEHOLDERS.md`**: Who is involved, what they need, and what success looks like for each group.
- **`RISKS_AND_MITIGATIONS.md`**: What could go wrong and how we'll prevent or respond.

### Planning Documents

- **`PHASES.md`**: MVP, Beta, and v1 definitions with clear entry/exit criteria and demo scripts.
- **`DELIVERY_PLAN.md`**: Practical sprint-by-sprint plan with dependencies and Council touchpoints.
- **`BACKLOG.md`**: Prioritised work items organised as vertical slices.

### Requirements Documents

- **`REQS/`**: Detailed requirements by capability area (routing, scoring, map layers, data ingestion, accounts, privacy, analytics, performance, reporting).
- **`FLOWS/`**: Step-by-step user journeys with acceptance criteria and edge cases.

### Supporting Documents

- **`DATA_SOURCES.md`**: What data we use, where it comes from, how we handle provenance and versioning.
- **`COMMS_AND_ENGAGEMENT.md`**: How we'll engage the community and communicate about the pilot.
- **`EVALUATION.md`**: How we'll measure success, what questions we'll answer, and what methods we'll use.
- **`DECISIONS.md`**: Architecture and product decisions with rationale and consequences.

## How to Use This Documentation

1. **New to the project?** Start with `PRD.md` and `CONTEXT.md` (this document).
2. **Planning a feature?** Check `BACKLOG.md` for prioritised work, then read the relevant `FLOWS/` and `REQS/` documents.
3. **Making a technical decision?** Check `DECISIONS.md` first, then add your decision there.
4. **Wondering about data?** See `DATA_SOURCES.md` for what's available and how it's versioned.
5. **Preparing for engagement?** See `COMMS_AND_ENGAGEMENT.md` for messaging and channels.
6. **Evaluating progress?** See `EVALUATION.md` for metrics and methods, and `PHASES.md` for phase criteria.
