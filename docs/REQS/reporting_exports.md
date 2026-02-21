# Requirements: Reporting and Exports

## Scope

This document defines requirements for Council insights dashboard, hotspot visualisation, corridor analysis, prioritisation evidence, and data export functionality.

## Requirements

### R1: Council Insights Dashboard

**Requirement**: Council staff must have access to an insights dashboard that displays aggregated data about walking network performance.

**Acceptance Criteria**:
- Given Council staff access the insights dashboard
- When they view the dashboard
- Then they see summary statistics (total observations, coverage, key metrics)
- And they see hotspot map visualisation
- And they can filter data (by stream, issue type, time period)
- And they can explore hotspots (click for details)
- And data source and confidence information is visible

**Data Needed**:
- Aggregated insights data (hotspots, statistics, coverage)
- Filter options (streams, issue types, time periods)
- Data source and confidence metadata

**API/Interface Notes**:
- Insights dashboard interface
- Insights data API
- Filtering and aggregation service
- Hotspot visualisation component

**Testing Notes**:
- Test dashboard access and display
- Test summary statistics accuracy
- Test hotspot visualisation
- Test filtering functionality
- Test hotspot exploration
- Test with Council staff (user testing recommended)

**Open Questions**:
- What summary statistics are most useful? (Define with Council input)
- Should dashboard be customisable? (May be complex, but helpful)
- How often should data refresh? (Real-time, daily, or manual)

---

### R2: Hotspot Visualisation

**Requirement**: Insights dashboard must visualise hotspots where multiple issues converge across lighting, accessibility, and climate streams.

**Acceptance Criteria**:
- Given Council staff view insights dashboard
- When they view hotspot map
- Then issue density is visualised (heat map style or similar)
- And areas with multiple issues are highlighted (darker = more issues)
- And they can identify problem areas easily
- And hotspot details are available on click (issue summary, count, sources)

**Data Needed**:
- Issue density data (aggregated by area)
- Hotspot identification algorithm
- Issue type data (lighting, accessibility, climate)

**API/Interface Notes**:
- Hotspot calculation service
- Hotspot visualisation component
- Hotspot detail component

**Testing Notes**:
- Test hotspot calculation accuracy
- Test hotspot visualisation clarity
- Test hotspot detail display
- Test with various data densities
- Test with Council staff (user testing recommended)

**Open Questions**:
- How to define hotspots? (Issue density threshold, clustering algorithm)
- What visualisation style? (Heat map, choropleth, points)
- How granular should hotspots be? (Street level, area level, or both)

---

### R3: Corridor Analysis (v1 Phase)

**Requirement**: Council staff must be able to view corridor analysis identifying routes/streets with multiple issues that need attention.

**Acceptance Criteria**:
- Given Council staff view insights dashboard
- When they access corridor analysis
- Then routes/streets with multiple issues are highlighted
- And they can see which issues affect each corridor
- And corridors are ranked or prioritised (if prioritisation available)
- And they can export corridor reports

**Data Needed**:
- Route/street geometries
- Issue data along routes/streets
- Corridor identification algorithm
- Prioritisation data (if available)

**API/Interface Notes**:
- Corridor identification service
- Corridor visualisation component
- Corridor detail component
- Export functionality

**Testing Notes**:
- Test corridor identification accuracy
- Test corridor visualisation
- Test corridor ranking/prioritisation
- Test corridor export
- Test with Council staff (user testing recommended)

**Open Questions**:
- How to identify corridors? (Routes with multiple issues, threshold-based)
- Should corridors be ranked? (By issue count, user impact, or prioritisation score)
- What level of detail? (Street level, route level, or both)

---

### R4: Prioritisation Evidence (v1 Phase)

**Requirement**: Council staff must be able to view prioritisation evidence showing which areas should be prioritised for infrastructure improvements.

**Acceptance Criteria**:
- Given Council staff view insights dashboard
- When they view prioritisation evidence
- Then areas are scored by prioritisation (issue density, user impact)
- And they can see why areas are prioritised (factors explained)
- And prioritisation scores are transparent (how calculated)
- And they can export prioritisation reports

**Data Needed**:
- Prioritisation algorithm (issue density, user impact, data confidence)
- Prioritisation scores
- Prioritisation factors (what contributes to score)
- User impact data (route usage, population density, if available)

**API/Interface Notes**:
- Prioritisation calculation service
- Prioritisation visualisation component
- Prioritisation detail component
- Export functionality

**Testing Notes**:
- Test prioritisation calculation accuracy
- Test prioritisation visualisation
- Test prioritisation factor explanations
- Test prioritisation export
- Test with Council staff (user testing recommended)

**Open Questions**:
- What prioritisation factors? (Issue density, user impact, data confidence, cost)
- How to calculate user impact? (Route usage, population density, accessibility needs)
- Should prioritisation be customisable? (Council-specific factors, but may be complex)

---

### R5: Data Filtering

**Requirement**: Insights dashboard must support filtering by data stream, issue type, time period, and data source.

**Acceptance Criteria**:
- Given Council staff view insights dashboard
- When they apply filters
- Then hotspot map updates to show filtered data
- And summary statistics update accordingly
- And active filters are clearly displayed
- And filters can be combined (multiple filters at once)
- And filters can be cleared or reset

**Data Needed**:
- Filter options (streams, issue types, time periods, sources)
- Filtered data aggregation
- Active filter state

**API/Interface Notes**:
- Filtering service
- Filter UI component
- Filtered data aggregation

**Testing Notes**:
- Test filtering functionality
- Test filter combinations
- Test filter clearing
- Test filtered data accuracy
- Test filter performance

**Open Questions**:
- What filter options are needed? (Define with Council input)
- Should filters be saved? (User preferences, but may be complex)
- How to handle no results? (Clear message, suggest adjusting filters)

---

### R6: Export Functionality

**Requirement**: Council staff must be able to export data and reports in multiple formats (PDF, CSV, GeoJSON) for use in planning documents and analysis.

**Acceptance Criteria**:
- Given Council staff want to export data
- When they configure export (type, format, filters, area)
- Then export is generated with selected configuration
- And export includes metadata (date ranges, filters, data sources, confidence, version)
- And export is downloadable
- And export formats are correct (PDF, CSV, GeoJSON)

**Data Needed**:
- Export configuration (type, format, filters, area)
- Export data (hotspots, corridors, prioritisation, raw data)
- Export metadata
- Export templates (for PDF)

**API/Interface Notes**:
- Export generation service
- Export format handlers (PDF, CSV, GeoJSON)
- Export metadata inclusion
- Export download functionality

**Testing Notes**:
- Test export generation for all types and formats
- Test export configuration
- Test export metadata inclusion
- Test export format correctness
- Test export download
- Test with Council staff (user testing recommended)

**Open Questions**:
- What export formats are needed? (PDF, CSV, GeoJSON - or more?)
- Should exports be customisable? (Templates, custom fields - may be complex)
- How to handle large exports? (Progress indicator, chunking, or limits)

---

### R7: Export Metadata

**Requirement**: All exports must include metadata about data sources, confidence, version, date ranges, and filters used.

**Acceptance Criteria**:
- Given Council staff export data
- When export is generated
- Then export includes metadata:
  - Date ranges (when data was collected)
  - Filters applied (what data is included)
  - Data sources (community, Council, environmental)
  - Confidence levels (data quality indicators)
  - Data version (which version of datasets)
  - Export date and time
- And metadata is clearly formatted and accessible

**Data Needed**:
- Export metadata (date ranges, filters, sources, confidence, version)
- Metadata formatting templates

**API/Interface Notes**:
- Metadata collection service
- Metadata formatting (for each export format)
- Metadata inclusion in exports

**Testing Notes**:
- Test metadata collection accuracy
- Test metadata formatting for each export format
- Test metadata accessibility (clearly visible, not hidden)
- Test metadata completeness

**Open Questions**:
- How detailed should metadata be? (Balance detail vs readability)
- Where to place metadata in exports? (Header, footer, separate sheet, or all)
- Should metadata be editable? (Probably not, but may need corrections)

---

### R8: Export Performance

**Requirement**: Export generation must complete within reasonable time and handle large datasets efficiently.

**Acceptance Criteria**:
- Given Council staff generate exports
- When export is requested
- Then export generation completes within 15 seconds for typical areas
- And progress indicator is shown for long exports
- And export can be cancelled if needed
- And large exports are handled efficiently (chunking, optimisation)

**Data Needed**:
- Performance budgets (15 seconds for typical areas)
- Export performance monitoring

**API/Interface Notes**:
- Export generation optimisation
- Progress indicators
- Cancellation support
- Large export handling (chunking, streaming)

**Testing Notes**:
- Test export generation times
- Test progress indicators
- Test cancellation
- Test large export handling
- Test export performance monitoring

**Open Questions**:
- What is typical area size? (Define based on pilot area)
- Should exports be generated asynchronously? (For very large exports, may need background jobs)
- How to handle export failures? (Retry, error messages, logging)

---

## Data Needed

### Insights Data
- Aggregated hotspot data
- Corridor data (v1)
- Prioritisation data (v1)
- Summary statistics
- Filter options

### Export Data
- Hotspot reports
- Corridor reports (v1)
- Prioritisation reports (v1)
- Raw observation data (anonymised)
- Route-level data

### Metadata
- Data sources
- Confidence levels
- Data versions
- Date ranges
- Filters applied

## API or Interface Notes

### Insights Dashboard
- Dashboard interface
- Insights data API
- Filtering and aggregation service
- Visualisation components

### Export System
- Export generation service
- Export format handlers (PDF, CSV, GeoJSON)
- Export metadata inclusion
- Export download functionality
- Performance optimisation

## Testing Notes

### Functional Testing
- Test dashboard access and display
- Test hotspot visualisation
- Test corridor analysis (v1)
- Test prioritisation evidence (v1)
- Test filtering functionality
- Test export generation for all types and formats
- Test export metadata inclusion
- Test with Council staff (user testing recommended)

### Performance Testing
- Test export generation times
- Test dashboard performance
- Test filtering performance
- Test with large datasets

### Edge Case Testing
- No data for filters
- Very large exports
- Export failures
- Missing metadata
- Invalid export configurations

## Open Questions

1. **Summary statistics**: What statistics are most useful? (Define with Council input)
2. **Hotspot definition**: How to define hotspots? (Issue density threshold, clustering)
3. **Corridor identification**: How to identify corridors? (Routes with multiple issues)
4. **Prioritisation factors**: What factors? (Issue density, user impact, cost)
5. **Export formats**: What formats are needed? (PDF, CSV, GeoJSON - or more?)
6. **Export customisation**: Should exports be customisable? (Templates, custom fields)
7. **Large exports**: How to handle very large exports? (Asynchronous, chunking, limits)

## Related Documents

- [`FLOWS/06_council_insights_view.md`](../FLOWS/06_council_insights_view.md): Council insights flow
- [`FLOWS/07_export_report.md`](../FLOWS/07_export_report.md): Export report flow
- [`REQS/data_ingestion_versioning.md`](data_ingestion_versioning.md): Data requirements
- [`REQS/accounts_and_roles.md`](accounts_and_roles.md): Council access requirements
