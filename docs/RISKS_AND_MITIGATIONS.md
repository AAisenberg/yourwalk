# YourWalk Risks and Mitigations

This document identifies risks to the YourWalk pilot, their likelihood and impact, mitigation strategies, early warning signs, and ownership.

## Risk Register

| Risk | Likelihood | Impact | Mitigation | Early Warning Sign | Owner |
|------|------------|--------|------------|-------------------|-------|
| Data quality gaps affect route recommendations | High | High | Use confidence indicators, transparent about limitations, validate data sources, aggregate multiple sources | Users report inaccurate route scores, low confidence scores throughout pilot area | Data Team |
| Interpretation risk: users assume safety guarantees | Medium | High | Clear disclaimers throughout UI, careful language in all copy, no "safety" guarantees, emphasise "conditions" and "perceptions" | User feedback mentions safety expectations, support requests about safety guarantees | Product Team |
| Performance issues with large datasets | Medium | Medium | Performance budgets defined, load testing, data pagination, efficient data structures, caching | Page load times exceed targets, route calculation slow, user complaints about performance | Engineering Team |
| Low community engagement and participation | Medium | High | Strong engagement strategy, multiple channels, clear value proposition, easy submission process, regular prompts | Low submission rates, low survey response, low return usage | Engagement Team |
| Bias in crowdsourced data | Medium | Medium | Aggregate multiple sources, validate against Council data where available, statistical methods to identify outliers, transparent about data sources | Data shows geographic or demographic bias, Council data conflicts with community data | Data Team |
| IP/licensing constraints on data sources | Low | High | Identify licensing requirements early, use open data where possible, negotiate data use agreements, have fallback sources | Data source access denied, licensing costs prohibitive, legal concerns raised | Data Team |
| Privacy concerns about location data | Medium | Medium | Minimise data collection, anonymous by default, clear privacy policy, transparent data use, secure storage | User privacy complaints, low participation due to privacy concerns, regulatory questions | Product Team |
| Council data access delays | High | Medium | Start data access conversations early, identify fallback sources, build with public data first, plan for delays | Data access not confirmed by Sprint 1, Council data unavailable, delays in data integration sprints | Data Team |
| Technical architecture decisions delay development | Medium | Medium | Make architecture decisions early (Sprint 1), document options and trade-offs, have fallback options | Architecture decisions not made by Sprint 1, development blocked, rework required | Engineering Team |
| Scope creep beyond MVP capabilities | Medium | Medium | Clear phase boundaries, strict acceptance criteria, regular scope reviews, say no to out-of-scope requests | Feature requests beyond MVP, timeline pressure, quality compromises | Product Team |
| Accessibility compliance issues | Low | High | Accessibility requirements from start, regular testing, expert review, WCAG 2.1 AA compliance | Accessibility testing failures, user complaints about accessibility, legal concerns | Engineering Team |
| Community submissions contain sensitive or inappropriate content | Low | Medium | Moderation process, automated validation, community reporting, clear submission guidelines | Inappropriate submissions, sensitive content reported, moderation backlog | Engagement Team |
| Route calculation errors or incorrect recommendations | Medium | Medium | Extensive testing, validate against known routes, error handling, user feedback channels | User reports incorrect routes, routes don't match reality, calculation errors | Engineering Team |
| Council staff don't use insights dashboard | Medium | Medium | Council training, clear value proposition, easy-to-use interface, regular check-ins, gather feedback | Low dashboard usage, Council feedback about usability, exports not used | Product Team |
| Evaluation data insufficient for grant reporting | Low | High | Define evaluation requirements early, implement analytics from start, regular data collection, backup methods | Low survey response, insufficient usage data, missing grant reporting metrics | Evaluation Team |
| Engagement fatigue: community loses interest | Medium | Medium | Varied engagement activities, regular updates, show impact of contributions, maintain momentum | Declining submission rates, low return usage, engagement metrics drop | Engagement Team |
| Data coverage insufficient for useful insights | Medium | Medium | Strong engagement strategy, multiple data sources, Council data where available, realistic coverage targets | Low data coverage in pilot area, insufficient observations per stream, gaps in coverage | Data Team |
| Performance degradation with increased usage | Low | Medium | Load testing, performance monitoring, scalability planning, optimisation | Performance issues under load, user complaints, system slowdowns | Engineering Team |
| Security vulnerabilities or data breaches | Low | High | Security review, secure development practices, regular security audits, incident response plan | Security issues identified, data breach, vulnerability reports | Engineering Team |
| Integration failures with external data sources | Medium | Medium | Robust error handling, fallback data sources, data validation, monitoring | Data source failures, integration errors, missing data | Engineering Team |
| User confusion about tool purpose or usage | Medium | Low | Clear onboarding, help documentation, tooltips, engagement materials, support channels | User support requests, low feature usage, survey feedback about confusion | Product Team |

## Risk Categories

### Technical Risks

- Performance issues
- Architecture decisions
- Integration failures
- Security vulnerabilities
- Accessibility compliance

**Mitigation**: Early technical decisions, performance budgets, security reviews, regular testing

### Data Risks

- Data quality gaps
- Data access delays
- IP/licensing constraints
- Insufficient coverage
- Bias in data

**Mitigation**: Early data access conversations, multiple data sources, validation, transparency

### User and Engagement Risks

- Low participation
- Engagement fatigue
- User confusion
- Privacy concerns
- Interpretation risk

**Mitigation**: Strong engagement strategy, clear communication, privacy-first approach, careful language

### Project Management Risks

- Scope creep
- Timeline pressure
- Resource constraints
- Council dependencies

**Mitigation**: Clear phase boundaries, regular reviews, early stakeholder alignment, buffer time

### Evaluation Risks

- Insufficient evaluation data
- Grant reporting gaps

**Mitigation**: Early evaluation planning, analytics from start, multiple data collection methods

## Risk Monitoring

### Weekly Risk Review

- Review risk register in weekly team meetings
- Update likelihood/impact based on new information
- Identify new risks as they emerge
- Track early warning signs

### Monthly Risk Assessment

- Comprehensive risk review with stakeholders
- Update mitigation strategies if needed
- Escalate high-risk items to project sponsor
- Document risk decisions and rationale

### Risk Escalation

- **Low risk**: Monitor, no action required
- **Medium risk**: Mitigation in place, regular monitoring
- **High risk**: Active mitigation, regular updates to project sponsor, contingency planning

## Contingency Planning

### Data Quality Gaps

**If data quality is insufficient**:
- Increase confidence threshold for route recommendations
- Emphasise data limitations in UI
- Focus on areas with better data coverage
- Accelerate community engagement to improve coverage

### Low Community Engagement

**If participation is low**:
- Increase engagement activities (events, workshops, school visits)
- Simplify submission process
- Show impact of contributions (e.g., "Your observation helped improve this route")
- Partner with community groups for promotion

### Performance Issues

**If performance degrades**:
- Implement data pagination and lazy loading
- Reduce data resolution or coverage
- Optimise map rendering
- Scale infrastructure if needed

### Council Data Access Delays

**If Council data unavailable**:
- Use public data sources and community contributions
- Focus on areas with available data
- Adjust scope if necessary
- Document data limitations clearly

### Scope Creep

**If scope expands beyond capacity**:
- Revisit phase boundaries and priorities
- Defer non-essential features to later phases
- Communicate trade-offs to stakeholders
- Adjust timeline if necessary

## Early Warning Indicators

Monitor these metrics to identify risks early:

- **Data quality**: Confidence scores, data coverage, validation failures
- **Engagement**: Submission rates, survey response, return usage
- **Performance**: Page load times, route calculation times, error rates
- **User satisfaction**: Support requests, survey feedback, feature usage
- **Council usage**: Dashboard access, export usage, feedback
- **Technical health**: Error rates, system uptime, security issues

## Risk Ownership

Each risk has an owner responsible for:
- Monitoring the risk and early warning signs
- Implementing and maintaining mitigation strategies
- Escalating if risk likelihood or impact increases
- Updating risk register with new information

Owners are assigned based on expertise and responsibility areas (see Risk Register table).

## Open Questions

- What are the specific data licensing requirements for each source?
- What is the Council data access process and timeline?
- What security review process is required?
- What are the grant reporting requirements and deadlines?
- What contingency budget is available for risk mitigation?
