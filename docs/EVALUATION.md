# YourWalk Pilot Evaluation Framework

This document defines how we will evaluate the YourWalk pilot, including evaluation questions, methods, metrics, and ethics considerations.

## Evaluation Objectives

The pilot evaluation aims to answer:

1. **Usage and adoption**: Are people using the tool? How often? For what purposes?
2. **Perceived usefulness**: Do users find the tool helpful for route planning?
3. **Trust and transparency**: Do users trust the data and understand its limitations?
4. **Behaviour intent**: Do users intend to change their walking behaviour based on insights?
5. **Council decision support**: Does the tool provide useful evidence for Council planning?
6. **Community engagement**: Are people contributing observations? Is the engagement sustainable?

## Evaluation Questions

### Usage and Adoption

- How many unique users accessed the tool during the pilot?
- How many routes were planned?
- What was the average session length?
- What percentage of users returned to use the tool again?
- Which features were used most (route planning, layers, submissions, comparisons)?
- What devices and browsers were used?

### Perceived Usefulness

- Do users find route scores helpful for choosing routes?
- Do users find map layers informative?
- Do users understand why routes are scored as they are?
- Would users recommend the tool to others?
- What barriers prevent users from using the tool more?

### Trust and Transparency

- Do users understand where data comes from?
- Do users understand confidence indicators?
- Do users trust the route recommendations?
- Do users understand the limitations (no safety guarantees)?
- Are users concerned about privacy?

### Behaviour Intent

- Do users intend to use the tool for future route planning?
- Do users intend to change walking routes based on insights?
- Do users feel more confident walking in areas they've explored via the tool?
- Would users use the tool for different trip types (commute, recreation, errands)?

### Council Decision Support

- Do Council staff find insights useful for planning?
- Do insights identify areas that align with known issues?
- Do insights reveal previously unknown problem areas?
- Are exports useful for reports and decision-making?
- Would Council continue using the tool post-pilot?

### Community Engagement

- How many observations were submitted?
- What was the geographic distribution of contributions?
- What was the quality of contributions?
- Do contributors understand how their data is used?
- Would contributors submit more observations?

## Evaluation Methods

### Telemetry and Analytics

**What we measure**:
- Page views, unique users, sessions, return usage
- Route planning events (origin/destination, route selected)
- Layer toggles and views
- Submission events (type, location, completion rate)
- Comparison usage
- Export usage (Council)
- Error events and performance metrics

**How we measure**:
- Anonymous analytics (no personally identifiable information)
- Event tracking for key user actions
- Performance monitoring
- Error logging

**Privacy considerations**:
- No tracking without consent (clear privacy notice)
- Anonymous by default (no user IDs unless account created)
- IP addresses not stored or used for identification
- Location data aggregated (not precise coordinates stored)

### In-App Survey (Short)

**When**: After user completes a route or submits an observation (optional, dismissible)

**Questions** (2-3 questions, < 30 seconds):
1. "Was this information helpful for planning your route?" (Yes/No/Somewhat)
2. "Would you use YourWalk again?" (Yes/No/Maybe)
3. "Any feedback?" (Optional text, max 200 characters)

**Implementation**:
- Appears once per session maximum
- Can be dismissed without answering
- Non-intrusive (small banner or modal)
- Mobile-friendly

**Privacy**: Responses anonymous, no personal information collected

### End-of-Pilot Survey

**When**: Final 2 weeks of pilot period

**Distribution**:
- In-app prompt (non-intrusive, can dismiss)
- Email to registered users (if accounts implemented)
- Council web page link
- QR code on engagement materials

**Length**: 5-7 minutes (estimated)

**Sections**:

1. **Usage** (3 questions)
   - How often did you use YourWalk? (Once, A few times, Weekly, Daily)
   - What did you use it for? (Route planning, Exploring area, Contributing data, Other)
   - Which features did you use? (Checkboxes: Route planning, Map layers, Submissions, Comparisons)

2. **Usefulness** (4 questions)
   - How useful was the route scoring? (5-point scale: Not useful to Very useful)
   - How useful were the map layers? (5-point scale)
   - Did the tool help you choose better routes? (Yes/No/Somewhat)
   - Would you recommend YourWalk to others? (Yes/No/Maybe, with optional reason)

3. **Trust and Transparency** (3 questions)
   - Did you understand where the data came from? (Yes/No/Somewhat)
   - Did you trust the route recommendations? (5-point scale)
   - Were the limitations clear (no safety guarantees)? (Yes/No/Unsure)

4. **Behaviour Intent** (3 questions)
   - Do you plan to use YourWalk for future route planning? (Yes/No/Maybe)
   - Has YourWalk changed how you think about walking routes? (Yes/No/Somewhat)
   - Would you use it for different trip types? (Checkboxes: Commute, Recreation, Errands, Other)

5. **Community Engagement** (2 questions, if submitted observations)
   - Why did you contribute observations? (Optional text)
   - Would you contribute more? (Yes/No/Maybe)

6. **Demographics** (Optional, 2 questions)
   - Age range (Under 18, 18-30, 31-50, 51-70, Over 70, Prefer not to say)
   - Do you have mobility needs? (Yes/No/Prefer not to say)

7. **Open Feedback** (1 question)
   - Any other feedback? (Optional text, max 500 characters)

**Privacy**: All responses anonymous, demographics optional, no personally identifiable information required

### Stakeholder Interviews (Optional)

**Who**: Council staff, community leaders, accessibility advocates (5-10 interviews)

**When**: After pilot completion, before final evaluation report

**Format**: 30-minute semi-structured interviews

**Topics**:
- Experience using the tool (or viewing insights)
- Perceived value and usefulness
- Suggestions for improvement
- Potential for continued use or scale

**Privacy**: Interviews recorded (with consent), transcribed, anonymised for reporting

## Key Performance Indicators (KPIs)

### Product KPIs

- **Unique users**: Target TBD (based on pilot area size and engagement strategy)
- **Routes planned**: Target TBD (aim for 10+ routes per user on average)
- **Return usage**: Target 30%+ of users return within pilot period
- **Submission rate**: Target 20%+ of users submit at least one observation
- **Layer engagement**: Target 60%+ of users view at least one layer

### Engagement KPIs

- **Survey response rate**: Target 20%+ of users complete end-of-pilot survey
- **Geographic coverage**: Target 30%+ of pilot area has at least one observation per stream
- **Contribution diversity**: Target contributions from 50+ unique contributors

### Council KPIs

- **Insights usage**: Target Council staff access insights dashboard 10+ times during pilot
- **Export usage**: Target 5+ reports exported for decision-making
- **Actionable insights**: Target 5+ hotspots or corridors identified that inform planning

**Note**: Specific targets will be set during pilot planning based on engagement strategy, pilot area size, and Council capacity.

## Measurement Approach

### Telemetry Implementation

- Implement analytics from MVP launch
- Track all key events defined in flow documents
- Monitor performance metrics continuously
- Review analytics weekly during pilot

### Survey Implementation

- In-app survey: Implement in Beta phase, active throughout pilot
- End-of-pilot survey: Launch in final 2 weeks, remain open for 4 weeks
- Analyse responses within 2 weeks of survey close

### Data Analysis

- **Quantitative**: Analyse telemetry and survey responses for patterns and trends
- **Qualitative**: Analyse open-ended survey responses and interview transcripts for themes
- **Triangulation**: Compare telemetry, survey, and interview data for consistency

### Reporting

- **Weekly updates**: Brief usage and engagement metrics during pilot
- **Mid-pilot report**: Preliminary findings at Beta completion
- **Final evaluation report**: Comprehensive findings, recommendations, and grant reporting metrics

## Ethics and Privacy Considerations

### What We Will Do

- **Informed consent**: Clear privacy notice explaining data collection and use
- **Anonymous by default**: No personally identifiable information collected unless user creates account
- **Minimal data collection**: Only collect what's necessary for evaluation
- **Transparent use**: Clearly explain how data is used in privacy policy
- **Secure storage**: Data stored securely, access restricted to evaluation team
- **Data retention**: Define retention period, delete data after evaluation complete
- **Right to withdraw**: Users can opt out of analytics (if technically feasible)

### What We Will Not Do

- **No tracking without consent**: Clear opt-in for analytics (or clear notice with opt-out)
- **No personal identification**: Cannot identify individual users from analytics
- **No sharing with third parties**: Evaluation data not shared outside project team and Council
- **No surveillance**: Not tracking individual movement patterns or precise locations
- **No prediction**: Not using data to predict behaviour or make assumptions about users
- **No discrimination**: Not using data in ways that could discriminate against users

### Privacy Policy Requirements

The privacy policy must clearly state:
- What data is collected (analytics, submissions, survey responses)
- How data is used (evaluation, product improvement, Council insights)
- Who has access (project team, Council, no third parties)
- How long data is retained
- How users can access or delete their data
- Contact information for privacy questions

### Ethics Review

- Review evaluation approach with Council privacy officer (if applicable)
- Ensure compliance with Australian Privacy Principles
- Consider if ethics review required (university, if applicable)
- Document ethics considerations in evaluation report

## Evaluation Timeline

### During Pilot

- **Week 1-2**: Analytics active, in-app survey implemented
- **Ongoing**: Monitor analytics, review weekly
- **Mid-pilot**: Preliminary analysis, identify trends

### End of Pilot

- **Final 2 weeks**: Launch end-of-pilot survey
- **Week after close**: Survey remains open
- **2 weeks after close**: Survey closes, begin analysis

### Post-Pilot

- **Week 3-4**: Complete data analysis, stakeholder interviews (if applicable)
- **Week 5-6**: Draft evaluation report
- **Week 7-8**: Review with stakeholders, finalise report
- **Week 9**: Publish evaluation report, grant reporting

## Grant Reporting

The evaluation will support grant reporting by providing:

- **Usage metrics**: Demonstrate tool adoption and engagement
- **User feedback**: Demonstrate perceived value and usefulness
- **Council outcomes**: Demonstrate decision support value
- **Community engagement**: Demonstrate participation and contribution
- **Lessons learned**: Identify improvements for future phases or scale

Evaluation report will be structured to align with grant reporting requirements (format TBD based on grant guidelines).

## Open Questions

- What are the specific grant reporting requirements? (Format, metrics, timeline)
- Is ethics review required? (University, Council, other)
- What is the target response rate for end-of-pilot survey? (Based on engagement strategy)
- Should we conduct stakeholder interviews? (Resources, value)
- How long should we retain evaluation data? (Grant requirements, privacy considerations)
