# YourWalk - City of Casey Connecting Grant Pilot

This repository contains the complete product requirements documentation and delivery plan for YourWalk, a map-first walking route and insights tool being developed as part of the City of Casey Connecting Grant. YourWalk helps residents choose walking routes that better fit their context and needs, while providing Council with evidence-based insights about where the walking network succeeds or fails.

## Quick Start

- **Product Requirements**: Start with [`docs/PRD.md`](docs/PRD.md) for the high-level product vision and requirements
- **Project Context**: Read [`docs/CONTEXT.md`](docs/CONTEXT.md) to understand the three integrated streams (lighting, accessibility, climate resilience) and project scope
- **Delivery Plan**: See [`docs/DELIVERY_PLAN.md`](docs/DELIVERY_PLAN.md) for phased delivery approach and timelines
- **Decisions**: Track architectural and product decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md)
- **Backlog**: View prioritised work items in [`docs/BACKLOG.md`](docs/BACKLOG.md)

## Documentation Structure

- **`docs/PRD.md`**: Core product requirements document (CEO-readable, links to detail)
- **`docs/CONTEXT.md`**: Project context, scope, and documentation map
- **`docs/PHASES.md`**: MVP, Beta, and v1 phase definitions with acceptance criteria
- **`docs/BACKLOG.md`**: Prioritised backlog organised by Now/Next/Later/Icebox
- **`docs/DECISIONS.md`**: Architecture decision records (ADRs)
- **`docs/DELIVERY_PLAN.md`**: Practical delivery plan with sprints and dependencies
- **`docs/EVALUATION.md`**: Pilot evaluation framework, metrics, and methods
- **`docs/STAKEHOLDERS.md`**: Stakeholder map and engagement needs
- **`docs/RISKS_AND_MITIGATIONS.md`**: Risk register with mitigation strategies
- **`docs/DATA_SOURCES.md`**: Data sources, provenance, and versioning approach
- **`docs/COMMS_AND_ENGAGEMENT.md`**: Community engagement plan and communication strategy
- **`docs/FLOWS/`**: Detailed user flow documentation (7 flows)
- **`docs/REQS/`**: Detailed requirements by capability area (9 requirement sets)

## How to Contribute

### Adding Requirements

1. Identify the appropriate requirements document in `docs/REQS/` or create a new one if needed
2. Add the requirement with clear acceptance criteria (Given/When/Then format)
3. Add a corresponding backlog item in `docs/BACKLOG.md` if it's actionable work
4. Update `docs/PRD.md` if it's a new functional area

### Recording Decisions

1. Open `docs/DECISIONS.md`
2. Add a new decision record with:
   - Decision question
   - Options considered
   - Decision (when made)
   - Rationale
   - Consequences
3. Update relevant documentation that references the decision

### Adding Backlog Items

1. Open `docs/BACKLOG.md`
2. Add the item to the appropriate priority section (Now/Next/Later/Icebox)
3. Write as a vertical slice (end-to-end user value), not a component task
4. Link to the relevant Flow or Reqs document
5. Include acceptance criteria

### Updating Flows

1. Navigate to the relevant flow in `docs/FLOWS/`
2. Update step-by-step flow, acceptance criteria, or edge cases as needed
3. Ensure telemetry events are documented for analytics tracking

## Key Principles

- **PRD is source of truth**: All requirements trace back to `docs/PRD.md`
- **No invented facts**: Unknowns go in Open Questions sections
- **Vertical slices**: Work is organised by user value, not technical components
- **Testable criteria**: Every requirement has Given/When/Then acceptance criteria
- **Transparency**: Data provenance and confidence indicators throughout
- **Australian spelling**: All documentation uses Australian English

## Getting Help

For questions about:
- **Product vision**: See `docs/PRD.md` and `docs/CONTEXT.md`
- **What to build next**: See `docs/BACKLOG.md` and `docs/PHASES.md`
- **How to build it**: See `docs/REQS/` and `docs/FLOWS/`
- **Why we chose X**: See `docs/DECISIONS.md`
- **What could go wrong**: See `docs/RISKS_AND_MITIGATIONS.md`
