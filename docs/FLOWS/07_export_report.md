# Flow: Export Report

## Purpose

Council staff export data and reports from the insights dashboard for use in planning documents, decision-making, and external analysis.

## Primary User

Council project officers, transport and urban design staff, and assets team members who need to export data for reports, presentations, or analysis in other tools.

## Preconditions

- User has access to Council insights dashboard
- User has permission to export data (if access control implemented)
- Data is available for the selected area or filters

## Step-by-Step Flow

1. **User prepares export**
   - User views insights dashboard with desired data visible
   - User applies filters if needed (by stream, issue type, time period, area)
   - User selects area on map (if area selection available) or uses current view
   - User reviews what will be exported (summary shown)

2. **User initiates export**
   - User clicks "Export" or "Download report" button
   - Export options dialog or menu appears
   - User selects export type:
     - **Hotspot report**: Summary of hotspots with visualisations
     - **Corridor analysis**: Corridor data and analysis (if available)
     - **Prioritisation evidence**: Prioritisation scores and rationale (if available)
     - **Raw data**: Observation data, route data, or aggregated data
     - **Custom export**: User selects specific data types and formats

3. **User selects export format**
   - User selects format:
     - **PDF**: Formatted report with visualisations and summary
     - **CSV**: Tabular data for spreadsheet analysis
     - **GeoJSON**: Geographic data for GIS tools (if applicable)
     - **Excel**: Formatted spreadsheet (if applicable)
   - Format options may vary by export type

4. **User configures export options** (if available)
   - User can configure:
     - **Date range**: Specific time period (if time-series data available)
     - **Data sources**: Include/exclude specific sources (community, Council, environmental)
     - **Confidence threshold**: Only include data above confidence threshold
     - **Include metadata**: Whether to include data provenance, confidence, version info
     - **Anonymisation**: Whether to anonymise community observations (if applicable)

5. **User confirms and generates export**
   - User reviews export configuration
   - User clicks "Generate export" or "Download"
   - System validates export request (area, filters, data availability)
   - Export generation begins (may take time for large exports)

6. **System generates export**
   - System processes data based on configuration
   - System generates file in selected format
   - System includes metadata (date ranges, filters, data sources, confidence, version)
   - Progress indicator shows (if generation takes time)

7. **User downloads export**
   - Export file is ready
   - Download link appears or file downloads automatically
   - User can download file
   - User receives confirmation

8. **User can view export history** (if available, v1 phase)
   - User can view previously generated exports
   - User can re-download exports (if stored)
   - User can see export metadata (when generated, what included)

## Acceptance Criteria

**Given** a Council staff member wants to export data  
**When** they select an area or apply filters and click "Export"  
**Then** they can select export type and format  
**And** they can configure export options (date range, data sources, etc.)  
**And** export is generated with selected configuration

**Given** a Council staff member generates an export  
**When** the export is ready  
**Then** they can download the file  
**And** the file includes metadata (date ranges, filters, data sources, confidence, version)  
**And** the file format is correct (PDF, CSV, GeoJSON, etc.)

**Given** a Council staff member exports a hotspot report as PDF  
**When** they open the PDF  
**Then** it contains summary statistics, hotspot visualisations, and data provenance information  
**And** it is formatted for use in reports or presentations

**Given** a Council staff member exports raw data as CSV  
**When** they open the CSV  
**Then** it contains observation data with appropriate columns  
**And** it includes metadata in header or separate sheet  
**And** data is properly formatted for spreadsheet analysis

**Given** a Council staff member exports data for a large area  
**When** export generation takes time  
**Then** progress indicator is shown  
**And** they can cancel if needed  
**And** they are notified when export is ready

## Edge Cases

### Export Configuration

- **Invalid configuration**: Show validation errors (e.g., date range invalid, no data for filters)
- **Missing data**: Warn if selected area or filters have no data, allow proceed or adjust
- **Large export**: Warn if export will be large, suggest narrowing filters, allow proceed or cancel

### Export Generation

- **Generation failure**: Show error message, allow retry, log error for support
- **Timeout**: Show timeout message, suggest narrowing filters, allow retry
- **Format errors**: Validate format, show errors if invalid, allow correction

### File Download

- **Download failure**: Show error message, allow retry, provide alternative download method
- **File corruption**: Validate file integrity, regenerate if corrupted
- **Storage limits**: Warn if export history storage is full, allow cleanup

### Data Privacy

- **Sensitive data**: Ensure community observations are properly anonymised in exports
- **Access control**: Verify user has permission to export requested data
- **Data retention**: Respect data retention policies in exports

### Performance

- **Large exports**: Optimise generation, show progress, allow cancellation
- **Concurrent exports**: Handle multiple export requests, queue if needed
- **Export history**: Limit export history size, archive old exports if needed

### Format-Specific Issues

- **PDF generation**: Handle large PDFs, optimise file size, ensure accessibility (tags)
- **CSV formatting**: Handle special characters, large datasets, encoding issues
- **GeoJSON**: Validate geometry, handle coordinate systems, optimise file size

### Mobile/Tablet

- **Mobile export**: Optimise for mobile, consider simplified export options
- **File download**: Ensure mobile browsers can download files correctly
- **File viewing**: Provide guidance on viewing exports on mobile

### Accessibility

- **Export interface**: Keyboard accessible, screen reader compatible
- **Export files**: PDFs should be tagged for accessibility, CSVs should be structured clearly
- **Progress indicators**: Accessible progress indicators, announcements for screen readers

## Telemetry Events Emitted

- `export_initiated`: User initiates export
  - Parameters: export_type, area_selected (true/false), filters_applied
- `export_configuration_started`: User begins configuring export
  - Parameters: export_type
- `export_format_selected`: User selects export format
  - Parameters: export_type, export_format (pdf/csv/geojson/excel)
- `export_options_configured`: User configures export options
  - Parameters: date_range_selected, data_sources_selected, confidence_threshold, anonymisation_enabled
- `export_generation_started`: Export generation begins
  - Parameters: export_type, export_format, estimated_size, filters_applied
- `export_generation_progress`: Export generation progress update
  - Parameters: export_id, progress_percent
- `export_generation_completed`: Export generated successfully
  - Parameters: export_id, export_type, export_format, file_size, generation_time_ms
- `export_generation_failed`: Export generation fails
  - Parameters: export_id, export_type, error_type, error_message
- `export_downloaded`: User downloads export
  - Parameters: export_id, export_type, export_format, download_method
- `export_download_failed`: Export download fails
  - Parameters: export_id, error_type, error_message

## Accessibility Considerations

### Export Interface Accessibility

- **Keyboard navigation**: Tab through all export options, Enter to confirm
- **Screen reader**: Export options announced, configuration described, progress announced
- **Visual accessibility**: High contrast, clear labels, progress indicators visible

### Export File Accessibility

- **PDF accessibility**: PDFs should be tagged, have proper structure, alternative text for images
- **CSV accessibility**: CSVs should have clear headers, structured data, metadata in separate sheet or header
- **File naming**: Descriptive file names that indicate content and date

### Progress Indicators

- **Visual**: Clear progress bar or percentage
- **Screen reader**: Progress announced periodically
- **Cancellation**: Cancel button keyboard accessible, clearly labeled

### Error Handling

- **Error messages**: Clear, specific error messages, not just "Export failed"
- **Error recovery**: User can retry or adjust configuration
- **Error announcements**: Screen readers announce errors immediately

## Related Documents

- [`REQS/reporting_exports.md`](../REQS/reporting_exports.md): Reporting and export requirements
- [`FLOWS/06_council_insights_view.md`](06_council_insights_view.md): Council insights view flow
- [`REQS/data_ingestion_versioning.md`](../REQS/data_ingestion_versioning.md): Data versioning requirements
