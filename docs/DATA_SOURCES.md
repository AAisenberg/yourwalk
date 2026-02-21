# YourWalk Data Sources

This document describes the data sources used in YourWalk across the three integrated streams, including source types, minimum viable datasets, update cadence, licensing, quality checks, and data provenance approach.

## Data Stream Overview

YourWalk integrates three data streams:

1. **Lighting and night-time safety perception**: LUX measurements, perception data, street lighting assets
2. **Footpath and crossing accessibility**: Community audits, Council asset data, crossing assessments
3. **Climate resilience and comfort**: Urban heat mapping, tree canopy, shade patterns, exposure data

Each stream combines multiple data sources with varying quality, coverage, and update frequency.

## Stream 1: Lighting and Night-Time Safety

### Source Types

1. **Community observations**: User-submitted lighting quality and perceived safety observations
   - Location (GPS or map selection)
   - Time of observation
   - Lighting quality (subjective scale)
   - Perceived safety (subjective scale)
   - Optional: LUX measurement (if user has device)

2. **Council asset data**: Street lighting infrastructure (if available)
   - Light pole locations
   - Light type and specifications
   - Maintenance status
   - Installation dates

3. **Street lighting density**: Calculated from light pole locations or satellite imagery
   - Lights per kilometre
   - Distance to nearest light
   - Coverage maps

4. **Environmental proxies**: Satellite imagery, street view data (if available)
   - Night-time light intensity from satellite
   - Street view lighting visibility

### Minimum Viable Dataset (MVP)

- **Community observations**: 50+ observations across pilot area
- **Street lighting density**: Calculated from public data or Council data
- **Basic visualisation**: Heat map of lighting quality/safety perception

**Fallback**: If Council data unavailable, use community observations and calculated density from public sources.

### Update Cadence

- **Community observations**: Real-time (as submitted, after moderation)
- **Council asset data**: Monthly or quarterly (depending on Council update frequency)
- **Street lighting density**: Recalculated when asset data updates
- **Environmental proxies**: Annually or as available

### Licensing Notes

- **Community observations**: User-contributed, owned by contributors, used under contribution agreement
- **Council asset data**: Subject to Council data use agreement (TBD)
- **Public data**: Open data licenses (check specific datasets)
- **Satellite imagery**: Subject to provider license (if used)

### Quality Checks

- **Location validation**: Ensure observations are within pilot area
- **Duplicate detection**: Identify and merge duplicate observations
- **Outlier detection**: Flag observations that are significantly different from nearby data
- **Temporal validation**: Check observation times are reasonable (night-time for lighting)
- **Moderation**: Review submissions for quality and appropriateness (see moderation approach in DECISIONS.md)

### Data Provenance

- **Source indicator**: "Community observation", "Council data", "Calculated", "Environmental data"
- **Confidence level**: Based on data source reliability, coverage density, recency
- **Last updated**: Display update date for each data source
- **Coverage map**: Show where data is available vs gaps

---

## Stream 2: Footpath and Crossing Accessibility

### Source Types

1. **Community audits**: Project Sidewalk style accessibility assessments
   - Location (GPS or map selection)
   - Surface quality (smooth, cracked, broken, etc.)
   - Width (narrow, adequate, wide)
   - Obstacles (kerb height, obstacles, overhanging vegetation)
   - Gradients (flat, gentle slope, steep)
   - Crossing quality (if applicable)
   - Tactile indicators (if applicable)
   - Signal timing (if applicable)

2. **Council asset data**: Official footpath and crossing infrastructure (if available)
   - Footpath locations and widths
   - Surface type and condition
   - Accessibility features (ramps, tactile indicators)
   - Maintenance records
   - Crossing locations and types

3. **OpenStreetMap data**: Public footpath and crossing data
   - Footpath geometry
   - Surface tags
   - Accessibility tags (where available)

4. **Satellite/street view**: Visual verification (if available)
   - Footpath visibility
   - Obstacle identification
   - Surface condition estimation

### Minimum Viable Dataset (MVP)

- **Community audits**: 100+ audits across pilot area (more structured, easier to validate)
- **OpenStreetMap data**: Footpath geometry for pilot area
- **Basic visualisation**: Accessibility scores on map, route-level accessibility scoring

**Fallback**: If Council data unavailable, use community audits and OpenStreetMap data.

### Update Cadence

- **Community audits**: Real-time (as submitted, after moderation)
- **Council asset data**: Quarterly or as updated (depending on Council)
- **OpenStreetMap**: Continuous (community-maintained)
- **Satellite/street view**: Annually or as available

### Licensing Notes

- **Community audits**: User-contributed, used under contribution agreement
- **Council asset data**: Subject to Council data use agreement (TBD)
- **OpenStreetMap**: ODbL (Open Database License)
- **Satellite/street view**: Subject to provider license (if used)

### Quality Checks

- **Location validation**: Ensure audits are on actual footpaths
- **Completeness**: Ensure required fields are filled
- **Consistency**: Check for conflicting audits at same location
- **Validation against Council data**: Compare community audits with Council records where available
- **Moderation**: Review audits for quality and accuracy (see moderation approach)

### Data Provenance

- **Source indicator**: "Community audit", "Council data", "OpenStreetMap", "Verified"
- **Confidence level**: Based on source reliability, number of audits at location, agreement between sources
- **Last updated**: Display update date for each data source
- **Coverage map**: Show footpath coverage and gaps

---

## Stream 3: Climate Resilience and Comfort

### Source Types

1. **Community feedback**: User-submitted thermal comfort observations
   - Location (GPS or map selection)
   - Time and date
   - Perceived comfort (too hot, comfortable, too cold)
   - Shade availability (full shade, partial shade, no shade)
   - Weather conditions (if applicable)

2. **Urban heat mapping**: Temperature data and heat island effects
   - Land surface temperature (satellite or sensor data)
   - Air temperature (weather station data, if available)
   - Heat island intensity
   - Historical temperature data

3. **Tree canopy and shade**: Vegetation and shade coverage
   - Tree canopy coverage (LiDAR or satellite)
   - Shade patterns throughout day (calculated from canopy and sun position)
   - Vegetation health (if available)

4. **Exposure mapping**: Sun and wind exposure
   - Solar exposure (calculated from building heights, canopy, orientation)
   - Wind exposure (calculated from urban form, if available)
   - Sky view factor (openness to sky)

5. **Weather data**: Current and historical weather
   - Temperature, humidity, wind (weather station data)
   - Heat index, apparent temperature
   - Extreme heat days

### Minimum Viable Dataset (MVP)

- **Urban heat mapping**: Land surface temperature data for pilot area (satellite or public data)
- **Tree canopy**: Canopy coverage data (LiDAR or satellite, if available)
- **Basic visualisation**: Heat map overlay, shade coverage overlay

**Fallback**: If detailed data unavailable, use community feedback and basic satellite-derived heat data.

### Update Cadence

- **Community feedback**: Real-time (as submitted, after moderation)
- **Urban heat mapping**: Seasonal or monthly (depending on data source)
- **Tree canopy**: Annually or as updated (vegetation changes slowly)
- **Shade patterns**: Calculated daily or on-demand (based on sun position)
- **Weather data**: Real-time or daily (depending on source)

### Licensing Notes

- **Community feedback**: User-contributed, used under contribution agreement
- **Urban heat mapping**: Subject to data provider license (satellite data, sensor networks)
- **Tree canopy**: Subject to data provider license (LiDAR, satellite)
- **Weather data**: Subject to provider license (Bureau of Meteorology, commercial providers)
- **Public data**: Open data licenses where applicable

### Quality Checks

- **Location validation**: Ensure observations are within pilot area
- **Temporal validation**: Check observation times are reasonable (e.g., heat observations in summer)
- **Outlier detection**: Flag observations that are significantly different from environmental data
- **Data consistency**: Compare community feedback with environmental data
- **Moderation**: Review feedback for quality and appropriateness

### Data Provenance

- **Source indicator**: "Community feedback", "Satellite data", "Weather station", "Calculated"
- **Confidence level**: Based on source reliability, data recency, agreement between sources
- **Last updated**: Display update date for each data source
- **Coverage map**: Show data coverage and gaps
- **Temporal note**: Indicate if data is current, historical, or predicted

---

## Base Mapping Data

### Street Network

- **Source**: OpenStreetMap or Council data
- **Update**: Continuous (OSM) or as updated (Council)
- **License**: ODbL (OSM) or Council agreement
- **Use**: Route calculation, base map

### Addresses and Points of Interest

- **Source**: OpenStreetMap, Council data, or geocoding service
- **Update**: Continuous or as updated
- **License**: Varies by source
- **Use**: Address search, origin/destination input

### Aerial/Satellite Imagery

- **Source**: OpenStreetMap, commercial providers, or Council
- **Update**: Annually or as available
- **License**: Varies by source
- **Use**: Base map imagery, visual context

---

## Data Provenance and Confidence Policy

### Provenance Requirements

All displayed data must show:
1. **Data source**: Where the data came from (community, Council, environmental, calculated)
2. **Last updated**: When the data was last updated
3. **Coverage**: Where data is available (visual indication of gaps)
4. **Confidence indicator**: How confident we are in the data (high/medium/low or numeric)

### Confidence Scoring Model

Confidence is calculated based on:
1. **Source reliability**: Council data > environmental data > community data (generally)
2. **Data recency**: More recent data is generally more reliable
3. **Coverage density**: More data points in an area increases confidence
4. **Agreement between sources**: When multiple sources agree, confidence increases
5. **Validation**: Data that has been validated or verified has higher confidence

**Confidence levels**:
- **High**: Multiple reliable sources agree, recent data, good coverage
- **Medium**: Single reliable source or multiple sources with some agreement, reasonable coverage
- **Low**: Single source, limited coverage, or conflicting sources

**Note**: Confidence scoring approach is documented as ADR-005 in [`DECISIONS.md`](DECISIONS.md).

### UI Representation

- **Source indicators**: Icon or text showing data source
- **Confidence indicators**: Visual indicator (colour, icon, or text) showing confidence level
- **Tooltips**: Detailed information about data source, update date, coverage on hover/click
- **Legend**: Explain what confidence levels mean
- **Transparency panel**: Detailed data provenance information accessible from main interface

### Language and Disclaimers

- **No guarantees**: "Data shows conditions and perceptions, not safety guarantees"
- **Limitations**: "Data coverage may be incomplete, confidence indicators show data quality"
- **Community data**: "Community observations reflect individual experiences and perceptions"
- **Council data**: "Council data may not reflect current conditions, last updated [date]"

---

## Data Versioning

### Versioning Approach

Datasets are versioned to support:
- **Reproducibility**: Ability to reproduce insights from specific data versions
- **Transparency**: Clear indication of which data version was used for decisions
- **Quality improvement**: Track how data quality improves over time
- **Historical analysis**: Compare current conditions with past (future feature)

### Versioning Strategy

**Approach**: TBD (see ADR-003 in [`DECISIONS.md`](DECISIONS.md))

**Options under consideration**:
1. **Snapshot-based**: Periodic snapshots of datasets, tag with version number and date
2. **Database versioning**: Version tables in database, reference version in UI
3. **Git LFS**: Store datasets as versioned files, reference in database

### Version Information Display

- **Data version**: Display version number or date for datasets used in route calculation
- **Version history**: Show when data was last updated, what changed
- **Export metadata**: Include version information in exports

### Update Process

1. **Data update**: New data arrives (community submission, Council update, environmental data)
2. **Validation**: Validate and quality check new data
3. **Integration**: Integrate into system
4. **Version tagging**: Tag with version number and date
5. **UI update**: Update UI to show new version, indicate what changed
6. **Notification**: Notify users if significant changes (optional, for logged-in users)

---

## Data Quality Assurance

### Quality Checks by Source Type

**Community observations**:
- Location validation (within pilot area, on relevant feature)
- Completeness (required fields filled)
- Duplicate detection
- Outlier detection
- Moderation review

**Council data**:
- Format validation
- Completeness check
- Temporal validation (not too old)
- Coverage check
- Comparison with community data

**Environmental data**:
- Format validation
- Spatial coverage check
- Temporal validation
- Comparison with other sources

### Quality Metrics

- **Coverage**: Percentage of pilot area with data
- **Recency**: Average age of data points
- **Consistency**: Agreement between different sources
- **Completeness**: Percentage of required fields filled
- **Accuracy**: Validation against known good data (where available)

### Quality Reporting

- **Dashboard**: Internal dashboard showing data quality metrics
- **UI indicators**: Confidence indicators reflect data quality
- **Exports**: Quality metrics included in data exports
- **Documentation**: Data quality documented in exports and reports

---

## Open Questions

- What Council data is available and what are the access requirements?
- What are the specific licensing terms for each data source?
- What is the update frequency for Council asset data?
- Are there existing community mapping initiatives we can partner with?
- What environmental data sources are available for the pilot area?
- What is the cost of commercial data sources (if needed)?
- How do we handle data that becomes unavailable or changes license?
- What is the data retention policy for community observations?
