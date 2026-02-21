# Requirements: Data Ingestion and Versioning

## Scope

This document defines requirements for ingesting data from multiple sources (community, Council, environmental), validating and processing data, storing data with versioning, and ensuring data provenance and quality.

## Requirements

### R1: Community Observation Ingestion

**Requirement**: System must ingest community-submitted observations (accessibility audits, lighting observations, heat/shade feedback) and store them with metadata.

**Acceptance Criteria**:
- Given a user submits an observation
- When the observation is received
- Then it is validated (location, required fields, format)
- And it is stored in the database with metadata (timestamp, source, submission ID)
- And it is assigned a unique identifier
- And it enters moderation queue (if moderation enabled)

**Data Needed**:
- Observation data (from submission forms)
- Location data (coordinates, address)
- Submission metadata (timestamp, user identifier if available, device info)

**API/Interface Notes**:
- Submission API endpoint
- Validation service
- Database storage
- Moderation queue system (if applicable)

**Testing Notes**:
- Test observation ingestion for all submission types
- Test validation (valid and invalid observations)
- Test storage and retrieval
- Test moderation queue (if applicable)
- Test error handling

**Open Questions**:
- What moderation approach? (See ADR-006 in [`DECISIONS.md`](../DECISIONS.md))
- How to handle duplicate submissions? (Detect and merge, or allow multiple)
- Should observations be editable after submission? (Allow corrections)

---

### R2: Council Data Ingestion

**Requirement**: System must ingest Council asset data (footpaths, lighting, crossings) and integrate it with community and environmental data.

**Acceptance Criteria**:
- Given Council data is provided
- When it is ingested
- Then it is validated (format, completeness, spatial coverage)
- And it is stored with metadata (source, date, version)
- And it is integrated with existing data (merged, not replaced)
- And data provenance is recorded

**Data Needed**:
- Council asset data (format TBD: CSV, GeoJSON, database export, API)
- Data schema definition
- Update frequency information

**API/Interface Notes**:
- Data ingestion service or script
- Validation service
- Data integration logic (merge with existing data)
- Versioning system

**Testing Notes**:
- Test Council data ingestion
- Test data validation
- Test data integration (merge with community data)
- Test versioning
- Test error handling

**Open Questions**:
- What format will Council data be in? (CSV, GeoJSON, database, API)
- How often will Council data be updated? (Real-time, daily, weekly, monthly)
- How to handle Council data updates? (Full refresh, incremental, or change detection)

---

### R3: Environmental Data Ingestion

**Requirement**: System must ingest environmental data (urban heat, tree canopy, weather) from external sources and integrate it with other data streams.

**Acceptance Criteria**:
- Given environmental data is available
- When it is ingested
- Then it is validated (format, spatial coverage, temporal coverage)
- And it is stored with metadata (source, date, version, license)
- And it is integrated with existing data
- And data provenance is recorded

**Data Needed**:
- Environmental data sources (satellite data, weather stations, LiDAR, etc.)
- Data access credentials or APIs
- Data schema definitions
- Update frequency information

**API/Interface Notes**:
- Data ingestion service or script
- External API integration (if applicable)
- Validation service
- Data integration logic
- Versioning system

**Testing Notes**:
- Test environmental data ingestion
- Test data validation
- Test data integration
- Test versioning
- Test error handling (API failures, missing data)

**Open Questions**:
- What environmental data sources are available? (Satellite, weather stations, LiDAR)
- How to access environmental data? (APIs, downloads, partnerships)
- How often is environmental data updated? (Real-time, daily, seasonal)
- What are the licensing requirements? (Open data, commercial, attribution)

---

### R4: Data Validation

**Requirement**: All ingested data must be validated for format, completeness, spatial coverage, and quality before storage.

**Acceptance Criteria**:
- Given data is ingested
- When it is validated
- Then format is checked (correct structure, required fields)
- And completeness is checked (required fields present, no obvious errors)
- And spatial coverage is checked (within pilot area, valid coordinates)
- And quality checks are performed (outlier detection, duplicate detection)
- And validation errors are logged and reported

**Data Needed**:
- Data schema definitions
- Validation rules
- Pilot area boundaries
- Quality thresholds

**API/Interface Notes**:
- Validation service
- Validation rules engine
- Error logging and reporting

**Testing Notes**:
- Test validation with valid data (should pass)
- Test validation with invalid data (should fail with clear errors)
- Test validation performance
- Test error reporting

**Open Questions**:
- What validation rules are needed? (Define based on data types)
- How strict should validation be? (Reject vs warn)
- Should validation be automated or manual? (Automated preferred, manual for edge cases)

---

### R5: Data Versioning

**Requirement**: All datasets must be versioned to support reproducibility, transparency, and historical analysis.

**Acceptance Criteria**:
- Given data is ingested or updated
- When it is stored
- Then it is tagged with a version number or date
- And version metadata is recorded (what changed, when, why)
- And previous versions are retained (if applicable)
- And version information is visible in UI

**Data Needed**:
- Version tagging system
- Version metadata
- Version history (if applicable)

**API/Interface Notes**:
- Versioning system (see ADR-003 in [`DECISIONS.md`](../DECISIONS.md))
- Version metadata storage
- Version query API

**Testing Notes**:
- Test versioning system
- Test version metadata recording
- Test version retrieval
- Test version display in UI

**Open Questions**:
- What versioning approach? (See ADR-003)
- How long to retain versions? (Storage considerations)
- Should versions be queryable? (For historical analysis)

---

### R6: Data Provenance

**Requirement**: All data must have clear provenance: source, date, confidence, and how it was processed.

**Acceptance Criteria**:
- Given data is stored
- When provenance is recorded
- Then data source is recorded (community, Council, environmental)
- And data date is recorded (when collected, when ingested)
- And data confidence is recorded (from confidence scoring)
- And processing steps are recorded (how data was transformed, if applicable)
- And provenance is visible in UI

**Data Needed**:
- Provenance metadata (source, date, confidence, processing)
- Provenance storage system

**API/Interface Notes**:
- Provenance metadata storage
- Provenance query API
- Provenance display in UI

**Testing Notes**:
- Test provenance recording
- Test provenance retrieval
- Test provenance display in UI
- Test provenance accuracy

**Open Questions**:
- How detailed should provenance be? (Simple vs comprehensive)
- Should provenance be editable? (Probably not, but corrections may be needed)
- How to handle provenance for aggregated data? (Show all sources)

---

### R7: Data Quality Assurance

**Requirement**: System must monitor and report data quality metrics (coverage, recency, consistency, accuracy).

**Acceptance Criteria**:
- Given data is stored
- When quality is assessed
- Then coverage metrics are calculated (percentage of pilot area with data)
- And recency metrics are calculated (average age of data)
- And consistency metrics are calculated (agreement between sources)
- And quality metrics are reported (dashboard, exports, UI indicators)

**Data Needed**:
- Data quality metrics definitions
- Quality calculation algorithms
- Quality reporting system

**API/Interface Notes**:
- Quality calculation service
- Quality metrics storage
- Quality reporting API or dashboard

**Testing Notes**:
- Test quality calculation accuracy
- Test quality reporting
- Test quality metrics display

**Open Questions**:
- What quality metrics are most important? (Coverage, recency, consistency, accuracy)
- How often should quality be assessed? (Real-time, daily, weekly)
- Should quality affect data display? (Show low-quality data differently)

---

### R8: Data Updates and Synchronisation

**Requirement**: System must handle data updates from all sources, synchronise updates, and maintain data consistency.

**Acceptance Criteria**:
- Given data is updated from a source
- When update is processed
- Then new data is ingested and validated
- And existing data is updated or merged (not duplicated)
- And data consistency is maintained (no conflicts or duplicates)
- And update is versioned and provenance recorded
- And UI reflects updates (if real-time) or on next refresh

**Data Needed**:
- Update detection mechanism
- Data merge logic
- Conflict resolution rules
- Update notification system (if applicable)

**API/Interface Notes**:
- Update detection service
- Data merge service
- Conflict resolution service
- Update notification system (if applicable)

**Testing Notes**:
- Test data updates from all sources
- Test data merging
- Test conflict resolution
- Test update versioning
- Test UI updates

**Open Questions**:
- How to detect updates? (Polling, webhooks, manual triggers)
- How to handle conflicts? (Last write wins, manual resolution, or merge strategy)
- Should updates be real-time? (Depends on source and use case)

---

## Data Needed

### Community Observations
- Submission data (from forms)
- Location data
- Submission metadata
- Moderation status (if applicable)

### Council Data
- Asset data (footpaths, lighting, crossings)
- Data schema
- Update frequency
- Data access method

### Environmental Data
- Satellite data (heat, canopy)
- Weather station data
- LiDAR data (if available)
- Data access credentials or APIs

### Metadata
- Data provenance (source, date, confidence)
- Data versioning (version number, change history)
- Data quality metrics (coverage, recency, consistency)

## API or Interface Notes

### Data Ingestion API
- Endpoints for each data source type
- Validation and processing
- Error handling and reporting

### Data Storage
- Database schema for observations, assets, environmental data
- Versioning system
- Provenance metadata storage

### Data Processing
- Validation service
- Quality calculation service
- Merge and conflict resolution service
- Versioning service

## Testing Notes

### Functional Testing
- Test data ingestion for all source types
- Test data validation
- Test data versioning
- Test data provenance recording
- Test data quality calculation
- Test data updates and synchronisation

### Performance Testing
- Test ingestion performance (target: handle submissions in real-time)
- Test data processing performance
- Test database query performance
- Test with large datasets

### Data Quality Testing
- Test validation accuracy
- Test quality calculation accuracy
- Test data consistency
- Test conflict resolution

### Edge Case Testing
- Invalid data formats
- Missing required fields
- Data outside pilot area
- Duplicate submissions
- Conflicting data from different sources
- Large data updates
- API failures (for external data)

## Open Questions

1. **Moderation approach**: What moderation system? (See ADR-006)
2. **Data formats**: What formats will Council and environmental data be in?
3. **Update frequency**: How often will each data source update?
4. **Versioning approach**: What versioning system? (See ADR-003)
5. **Conflict resolution**: How to handle conflicts between data sources?
6. **Real-time updates**: Should updates be real-time or batched?
7. **Data retention**: How long to retain data and versions?

## Related Documents

- [`FLOWS/03_accessibility_audit_submit.md`](../FLOWS/03_accessibility_audit_submit.md): Accessibility submission flow
- [`FLOWS/04_lighting_observation_submit.md`](../FLOWS/04_lighting_observation_submit.md): Lighting submission flow
- [`FLOWS/05_heat_shade_feedback_submit.md`](../FLOWS/05_heat_shade_feedback_submit.md): Heat/shade submission flow
- [`DATA_SOURCES.md`](../DATA_SOURCES.md): Data sources documentation
- [`DECISIONS.md`](../DECISIONS.md): Architecture decisions (ADR-003, ADR-006)
