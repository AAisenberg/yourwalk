# Flow: View Council Insights

## Purpose

Council staff access aggregated insights about walking network performance, including hotspots, corridors, and prioritisation evidence, to support infrastructure planning and decision-making.

## Primary User

Council project officers, transport and urban design staff, and assets team members who need evidence for planning and prioritisation decisions.

## Preconditions

- User has access to Council insights dashboard (authentication/authorisation TBD)
- Insights data is available (aggregated from community observations, Council data, environmental data)
- User is logged in or has appropriate access permissions

## Step-by-Step Flow

1. **User accesses Council insights dashboard**
   - User navigates to insights dashboard (separate URL or section)
   - Dashboard loads with map view of pilot area
   - Summary statistics are displayed (total observations, coverage, key metrics)

2. **User views hotspot map**
   - Hotspot visualisation is displayed by default (heat map style)
   - Areas with multiple issues are highlighted (darker colours = more issues)
   - User can see issue density across pilot area
   - Legend explains hotspot visualisation

3. **User can filter insights**
   - User can filter by:
     - **Data stream** (lighting, accessibility, climate, or all)
     - **Issue type** (specific issues within each stream, if available)
     - **Time period** (date range, if time-series data available)
     - **Data source** (community, Council, environmental, or all)
   - Map and statistics update based on filters
   - Active filters are displayed clearly

4. **User explores hotspots**
   - User can click on hotspot areas to see:
     - Issue summary (what issues are present)
     - Issue count or density
     - Data sources contributing to hotspot
     - Confidence levels
     - Related observations (if available)
   - Detailed view opens (modal, side panel, or dedicated view)

5. **User views corridor analysis** (if available, v1 phase)
   - User can switch to corridor view
   - Routes/streets with multiple issues are highlighted
   - User can see which issues affect each corridor
   - Corridors are ranked or prioritised (if prioritisation available)

6. **User views prioritisation evidence** (if available, v1 phase)
   - User can view prioritisation scores for areas
   - Prioritisation is based on:
     - Issue density
     - User impact (route usage, population density)
     - Data confidence
   - User can see why areas are prioritised
   - Prioritisation can be exported

7. **User can export data**
   - User can select area or apply filters
   - User clicks "Export" or "Download report"
   - Export options available (PDF, CSV, GeoJSON, etc.)
   - User selects format and downloads
   - Export includes metadata (date ranges, filters, data sources, confidence)

## Acceptance Criteria

**Given** a Council staff member accesses the insights dashboard  
**When** they view the hotspot map  
**Then** they see issue density visualised across the pilot area  
**And** they can identify areas where multiple issues converge  
**And** data source and confidence information is visible

**Given** a Council staff member views insights  
**When** they apply filters (by stream, issue type, time period)  
**Then** the hotspot map updates to show filtered data  
**And** summary statistics update accordingly  
**And** active filters are clearly displayed

**Given** a Council staff member clicks on a hotspot area  
**When** they view hotspot details  
**Then** they see issue summary, issue count, data sources, and confidence levels  
**And** they can see related observations (if available)

**Given** a Council staff member views corridor analysis  
**When** corridors are displayed  
**Then** they can see routes/streets with multiple issues highlighted  
**And** they can see which issues affect each corridor  
**And** corridors are ranked or prioritised (if available)

**Given** a Council staff member views prioritisation evidence  
**When** prioritisation scores are displayed  
**Then** they can see why areas are prioritised (issue density, user impact)  
**And** they can export prioritisation data

## Edge Cases

### Data Availability

- **No data for area**: Show message "No data available for this area", explain why
- **Low data coverage**: Show coverage map, indicate areas with limited data
- **Conflicting data**: Show confidence indicators, explain data sources, allow interpretation

### Filtering

- **No results for filter**: Show message "No data matches these filters", suggest adjusting filters
- **Too many results**: Show message if results are too large, suggest narrowing filters
- **Filter combinations**: Ensure filters work together correctly, handle edge cases

### Performance

- **Large datasets**: Optimise rendering for large areas, show loading indicators
- **Slow calculations**: Show progress for corridor analysis or prioritisation calculations
- **Export generation**: Show progress for large exports, allow cancellation

### Access Control

- **Unauthorised access**: Show error, redirect to login or contact admin
- **Limited permissions**: Show only data user has permission to view
- **Session expiry**: Handle session timeout gracefully, prompt to re-login

### Export

- **Export failures**: Show error message, allow retry, log error
- **Large exports**: Warn if export will be large, allow cancellation, show progress
- **Export format issues**: Validate export format, show errors if invalid

### Mobile/Tablet

- **Small screen**: Responsive layout, stack filters vertically, optimise map view
- **Touch interactions**: Touch-friendly interface, large touch targets
- **Performance**: Optimise for mobile performance, consider simplified view

### Accessibility

- **Keyboard navigation**: All interactions work with keyboard
- **Screen reader**: Insights announced clearly, filters described, exports explained
- **Visual accessibility**: High contrast, colour not only indicator, clear labels

## Telemetry Events Emitted

- `insights_dashboard_accessed`: Council staff accesses dashboard
  - Parameters: user_role (if available, anonymised), access_method
- `insights_filter_applied`: User applies filter
  - Parameters: filter_type (stream/issue_type/time_period/source), filter_value
- `insights_hotspot_clicked`: User clicks on hotspot
  - Parameters: hotspot_location_lat, hotspot_location_lon, issue_count, issue_types
- `insights_corridor_viewed`: User views corridor analysis
  - Parameters: corridor_count, average_issues_per_corridor
- `insights_prioritisation_viewed`: User views prioritisation evidence
  - Parameters: prioritisation_method, top_priorities_count
- `insights_export_initiated`: User initiates export
  - Parameters: export_type (hotspot/corridor/prioritisation), export_format, filters_applied
- `insights_export_completed`: Export generated successfully
  - Parameters: export_type, export_format, export_size, generation_time_ms
- `insights_export_failed`: Export generation fails
  - Parameters: export_type, error_type, error_message

## Accessibility Considerations

### Dashboard Accessibility

- **Keyboard navigation**: Tab through all interactive elements, Enter to activate
- **Screen reader**: Dashboard structure announced, filters described, map interactions explained
- **Visual accessibility**: High contrast, clear labels, colour not only indicator
- **Focus management**: Clear focus indicators, logical tab order

### Map Accessibility

- **Keyboard**: Arrow keys to pan map, zoom controls keyboard accessible
- **Screen reader**: Map regions described, hotspots announced, filters explained
- **Alternative**: Table view of hotspots as alternative to map (if feasible)

### Filter Accessibility

- **Keyboard**: All filter controls keyboard accessible
- **Screen reader**: Filter options announced, selected filters described
- **Visual**: Clear labels, selected state obvious

### Export Accessibility

- **Keyboard**: Export button keyboard accessible, format selection keyboard accessible
- **Screen reader**: Export process announced, progress described
- **Visual**: Clear export buttons, progress indicators visible

### Mobile Accessibility

- **Touch targets**: All interactive elements at least 44x44 pixels
- **Responsive layout**: Filters stack vertically, map optimised for mobile
- **Performance**: Optimised for mobile performance

## Related Documents

- [`REQS/reporting_exports.md`](../REQS/reporting_exports.md): Reporting and export requirements
- [`REQS/accounts_and_roles.md`](../REQS/accounts_and_roles.md): Account and role requirements
- [`FLOWS/07_export_report.md`](07_export_report.md): Export report flow
