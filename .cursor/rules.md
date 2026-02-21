# YourWalk Development Rules

## Documentation Principles

- **PRD is source of truth**: All requirements trace back to `docs/PRD.md`. If a requirement isn't documented, it doesn't exist.
- **Do not invent requirements**: If something is unknown or uncertain, add it to Open Questions sections with options and decision criteria.
- **If unclear, add Open Questions**: Use the Open Questions pattern in requirements docs. Propose 2-3 options with decision criteria rather than guessing.
- **Prefer vertical slices**: Work should be organised by end-to-end user value, not by technical component. Each backlog item should deliver a complete user journey.
- **Update DECISIONS.md when changing architecture**: Any architectural choice or significant technical decision must be recorded in `docs/DECISIONS.md` using ADR format.
- **Every requirement needs acceptance criteria**: Use Given/When/Then format for all acceptance criteria. Requirements without testable criteria are incomplete.

## Data and Privacy

- **Minimise sensitive data collection**: Only collect what's necessary for the feature. Prefer anonymous usage patterns over personal identifiers.
- **Transparency first**: Data provenance, confidence indicators, and clear language about limitations must be visible in the UI.
- **No safety guarantees**: Never imply that the tool guarantees safety or predicts crime. Use careful language about perceptions and conditions.

## Language and Style

- **Use Australian spelling**: All documentation, UI copy, and code comments use Australian English (e.g. "colour", "organise", "centre").
- **No em dashes**: Use en dashes or commas instead of em dashes in documentation.
- **CEO-readable PRD**: Keep `docs/PRD.md` high-level and accessible. Push technical detail into companion docs.

## Development Approach

- **Vertical slices over components**: Build complete user journeys end-to-end rather than building all components separately.
- **Testable acceptance criteria**: Every feature must have clear Given/When/Then criteria before development starts.
- **Link requirements**: Backlog items must link to Flows or Reqs documents. Requirements must trace to PRD.

## Quality Standards

- **Accessibility first**: All features must meet WCAG 2.1 AA standards. Document accessibility considerations in flow docs.
- **Performance budgets**: Respect performance budgets defined in `docs/PHASES.md` for each phase.
- **Privacy checks**: Review privacy implications before adding new data collection or features.

## Pilot Context

- **Casey first**: Assume pilot in City of Casey. Keep architecture scalable to other LGAs but don't over-engineer for multi-tenancy in MVP.
- **Grant-ready**: Documentation should support grant reporting and evaluation requirements.
- **Community engagement**: Consider community engagement implications in all features. See `docs/COMMS_AND_ENGAGEMENT.md`.
