# Requirements: Privacy, Safety, and Ethics

## Scope

This document defines requirements for privacy protection, safety disclaimers, ethical data use, and compliance with Australian Privacy Principles and relevant regulations.

## Requirements

### R1: Privacy Policy and Transparency

**Requirement**: System must have a clear, accessible privacy policy that explains data collection, use, storage, and user rights.

**Acceptance Criteria**:
- Given a user accesses the system
- When they view privacy information
- Then privacy policy is easily accessible (link in footer, privacy page)
- And privacy policy explains what data is collected
- And privacy policy explains how data is used
- And privacy policy explains data storage and retention
- And privacy policy explains user rights (access, correction, deletion)
- And privacy policy is written in plain language

**Data Needed**:
- Privacy policy content
- Privacy policy version and update date

**API/Interface Notes**:
- Privacy policy page or component
- Privacy policy link in footer and key locations
- Privacy policy versioning

**Testing Notes**:
- Test privacy policy accessibility
- Test privacy policy clarity (user testing recommended)
- Test privacy policy compliance (legal review recommended)
- Test privacy policy updates

**Open Questions**:
- Should privacy policy be reviewed by legal counsel? (Recommended)
- How often should privacy policy be updated? (As needed, but versioned)
- Should privacy policy be customisable per user? (Probably not, but may need translations)

---

### R2: Minimal Data Collection

**Requirement**: System must collect only necessary data and support anonymous usage where possible.

**Acceptance Criteria**:
- Given the system collects data
- When data is collected
- Then only necessary data is collected (no excessive collection)
- And anonymous usage is supported (no account required for basic features)
- And optional data is clearly marked (e.g., account creation, preferences)
- And data collection purpose is explained

**Data Needed**:
- Data collection inventory (what data is collected, why, how long retained)
- Anonymous usage support

**API/Interface Notes**:
- Data collection minimisation
- Anonymous usage support
- Optional data marking

**Testing Notes**:
- Test data collection minimisation
- Test anonymous usage
- Test optional data marking
- Test data collection purpose explanations

**Open Questions**:
- What data is necessary? (Define clearly for each feature)
- Should analytics be opt-in or opt-out? (Opt-out with clear notice probably acceptable)
- How to handle location data? (Required for route planning, but minimise storage)

---

### R3: Data Security

**Requirement**: All collected data must be stored and transmitted securely.

**Acceptance Criteria**:
- Given data is collected
- When it is stored or transmitted
- Then it is encrypted in transit (HTTPS)
- And it is encrypted at rest (database encryption)
- And access is restricted (authorised users only)
- And security measures are documented

**Data Needed**:
- Security measures documentation
- Encryption configuration
- Access control configuration

**API/Interface Notes**:
- HTTPS enforcement
- Database encryption
- Access control
- Security monitoring

**Testing Notes**:
- Test HTTPS enforcement
- Test database encryption
- Test access control
- Test security monitoring
- Security audit recommended

**Open Questions**:
- What encryption standards? (TLS 1.2+, AES-256)
- Should security be audited? (Recommended, especially for Council data)
- What access logging is needed? (For audit and security)

---

### R4: User Data Rights

**Requirement**: Users must be able to access, correct, and delete their data in accordance with Australian Privacy Principles.

**Acceptance Criteria**:
- Given a user has data in the system
- When they request access
- Then they can view their data (contributions, account data, preferences)
- And they can correct their data (update information, edit contributions if allowed)
- And they can delete their data (delete account, delete contributions)
- And requests are processed within reasonable time (e.g., 30 days)

**Data Needed**:
- User data (contributions, account data, preferences)
- Data access, correction, and deletion functionality

**API/Interface Notes**:
- Data access API
- Data correction API
- Data deletion API
- Request processing workflow

**Testing Notes**:
- Test data access
- Test data correction
- Test data deletion
- Test request processing time
- Test privacy compliance

**Open Questions**:
- Should users be able to delete contributions? (Privacy right vs data quality)
- How long to process requests? (30 days is standard, but faster is better)
- Should data be anonymised instead of deleted? (For aggregated insights, but user choice)

---

### R5: Safety Disclaimers

**Requirement**: System must include clear disclaimers that it does not guarantee safety or predict crime, and that route recommendations are based on conditions and perceptions.

**Acceptance Criteria**:
- Given users view route recommendations
- When they see route information
- Then disclaimers are visible (in route details, on map, in help text)
- And disclaimers state: "This tool shows conditions and perceptions, not safety guarantees"
- And disclaimers state: "Route recommendations are based on available data and may not reflect current conditions"
- And language is clear and non-alarmist

**Data Needed**:
- Disclaimer content
- Disclaimer placement locations

**API/Interface Notes**:
- Disclaimer component
- Disclaimer display in key locations (route details, map, help)

**Testing Notes**:
- Test disclaimer visibility
- Test disclaimer clarity (user testing recommended)
- Test disclaimer placement
- Test disclaimer language (legal review recommended)

**Open Questions**:
- Where should disclaimers appear? (Route details, map, help, footer)
- How prominent should disclaimers be? (Visible but not intrusive)
- Should disclaimers be customisable? (Probably not, but may need updates)

---

### R6: Ethical Data Use

**Requirement**: Data must be used ethically: no discrimination, no surveillance, no misuse of community contributions.

**Acceptance Criteria**:
- Given data is collected and used
- When it is processed
- Then it is not used for discrimination (no bias in route recommendations)
- And it is not used for surveillance (no tracking of individual movement patterns)
- And community contributions are used as intended (route planning, insights, not commercial exploitation)
- And data use is transparent (users know how their data is used)

**Data Needed**:
- Ethical use guidelines
- Data use documentation
- Bias monitoring (if applicable)

**API/Interface Notes**:
- Ethical use enforcement
- Bias monitoring (if applicable)
- Data use transparency

**Testing Notes**:
- Test ethical use compliance
- Test bias detection (if applicable)
- Test data use transparency
- Ethical review recommended

**Open Questions**:
- How to detect and prevent bias? (Monitoring, testing, diverse data sources)
- Should data use be audited? (Recommended for ethical compliance)
- What constitutes misuse? (Define clearly)

---

### R7: Community Contribution Ethics

**Requirement**: Community contributions must be used ethically: contributors understand how data is used, contributions are valued, and contributors are not exploited.

**Acceptance Criteria**:
- Given users contribute observations
- When contributions are used
- Then contributors understand how their data is used (clear explanation)
- And contributions are valued (acknowledgment, impact shown if possible)
- And contributors are not exploited (no commercial use without consent, no surveillance)
- And contribution terms are clear (what contributors agree to)

**Data Needed**:
- Contribution terms and conditions
- Contribution use documentation
- Contribution acknowledgment system

**API/Interface Notes**:
- Contribution terms display
- Contribution acknowledgment
- Contribution use tracking (for transparency)

**Testing Notes**:
- Test contribution terms clarity
- Test contribution acknowledgment
- Test contribution use transparency
- Test ethical compliance

**Open Questions**:
- Should contributors see impact of their contributions? (Shows value, but may be complex)
- Should contributions be attributed? (Privacy vs acknowledgment)
- What are contribution terms? (Define clearly, legal review recommended)

---

### R8: Data Sharing and Third Parties

**Requirement**: Data sharing with third parties must be transparent, limited, and compliant with privacy principles.

**Acceptance Criteria**:
- Given data may be shared
- When sharing occurs
- Then sharing is transparent (users know if data is shared)
- And sharing is limited (only necessary data, only for stated purposes)
- And third parties are bound by privacy agreements (if applicable)
- And sharing is documented

**Data Needed**:
- Data sharing inventory (what is shared, with whom, why)
- Third party agreements (if applicable)
- Sharing documentation

**API/Interface Notes**:
- Data sharing controls
- Third party integration management
- Sharing documentation

**Testing Notes**:
- Test data sharing transparency
- Test data sharing limitations
- Test third party agreements (if applicable)
- Test privacy compliance

**Open Questions**:
- Will data be shared with third parties? (Define clearly, probably minimal for pilot)
- What third party agreements are needed? (If sharing occurs)
- Should sharing be opt-in? (Depends on purpose and consent requirements)

---

## Data Needed

### Privacy Documentation
- Privacy policy
- Data collection inventory
- Data use documentation
- User rights information

### Security Configuration
- Encryption settings
- Access control settings
- Security monitoring configuration

### Ethical Guidelines
- Ethical use guidelines
- Bias prevention measures
- Contribution ethics guidelines

## API or Interface Notes

### Privacy Controls
- Privacy policy display
- Data access, correction, deletion
- Privacy settings (if applicable)

### Security
- HTTPS enforcement
- Database encryption
- Access control
- Security monitoring

### Disclaimers
- Safety disclaimers
- Data limitation disclaimers
- Route recommendation disclaimers

## Testing Notes

### Privacy Testing
- Test privacy policy accessibility and clarity
- Test data collection minimisation
- Test user data rights (access, correction, deletion)
- Test privacy compliance (Australian Privacy Principles)

### Security Testing
- Test data encryption (in transit, at rest)
- Test access control
- Test security monitoring
- Security audit recommended

### Ethical Testing
- Test ethical use compliance
- Test bias detection (if applicable)
- Test contribution ethics
- Ethical review recommended

### Legal Compliance
- Legal review of privacy policy recommended
- Legal review of disclaimers recommended
- Legal review of terms and conditions recommended

## Open Questions

1. **Legal review**: Should privacy policy and disclaimers be reviewed by legal counsel? (Recommended)
2. **Data retention**: How long to retain data? (Privacy vs data quality, define clearly)
3. **Data sharing**: Will data be shared with third parties? (Define clearly, probably minimal)
4. **Bias prevention**: How to detect and prevent bias? (Monitoring, testing, diverse data)
5. **Contribution terms**: What are contribution terms? (Define clearly, legal review)
6. **Security audit**: Should security be audited? (Recommended, especially for Council data)

## Related Documents

- [`REQS/accounts_and_roles.md`](accounts_and_roles.md): Account and privacy control requirements
- [`REQS/analytics_and_telemetry.md`](analytics_and_telemetry.md): Analytics privacy requirements
- [`COMMS_AND_ENGAGEMENT.md`](../COMMS_AND_ENGAGEMENT.md): Communication and engagement (includes privacy messaging)
