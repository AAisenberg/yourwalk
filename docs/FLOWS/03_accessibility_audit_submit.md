# Flow: Submit Accessibility Audit

## Purpose

Users contribute structured accessibility observations (Project Sidewalk style) about footpaths and crossings that appear on the map and contribute to route scoring.

## Primary User

Residents, particularly people with mobility needs, parents with prams, and community members who want to improve accessibility data.

## Preconditions

- User is on the YourWalk map interface
- Submission feature is available (MVP phase)
- User has location permissions (if using GPS) or can select location on map

## Step-by-Step Flow

1. **User initiates submission**
   - User clicks "Submit observation" or similar button
   - Submission type selection appears (if multiple types available) or goes directly to accessibility form
   - User selects "Accessibility audit" (if multiple types)

2. **User selects location**
   - User can:
     - Click on map to set location
     - Use current location (if permissions granted)
     - Enter address and geocode
   - Location marker appears on map
   - Location is validated (must be on a footpath or crossing, within pilot area)

3. **User completes accessibility audit form**
   - Form includes fields:
     - **Location** (pre-filled from step 2, can be adjusted)
     - **Surface quality** (dropdown or buttons: Smooth, Cracked, Broken, Gravel, Other)
     - **Width** (dropdown or buttons: Narrow < 1.2m, Adequate 1.2-1.8m, Wide > 1.8m, Can't tell)
     - **Obstacles** (checkboxes: High kerb, Obstacles on path, Overhanging vegetation, Other)
     - **Gradient** (dropdown or buttons: Flat, Gentle slope, Steep, Can't tell)
     - **Crossing quality** (if applicable, dropdown: Good, Needs improvement, Poor, N/A)
     - **Tactile indicators** (if applicable, checkbox: Present, Absent, Can't tell)
     - **Signal timing** (if applicable, dropdown: Adequate, Too short, N/A)
     - **Additional notes** (optional text field, max 500 characters)
   - Form validates required fields
   - User can see location on map while filling form

4. **User reviews submission**
   - Summary of submission is shown
   - Location is highlighted on map
   - User can edit any field before submitting

5. **User submits**
   - User clicks "Submit" or "Save observation"
   - Submission is validated (location, required fields)
   - Submission is saved to database
   - Submission enters moderation queue (if moderation enabled)

6. **System confirms submission**
   - Success message is shown ("Thank you for your contribution!")
   - User's observation appears on map (immediately if no moderation, or after moderation)
   - Observation is highlighted or marked as "Your contribution"
   - User can submit another observation or return to map

## Acceptance Criteria

**Given** a user wants to contribute an accessibility observation  
**When** they complete the accessibility audit form with valid data  
**Then** their observation is saved  
**And** it appears on the map (after moderation if applicable)  
**And** they receive confirmation that their contribution was recorded

**Given** a user is completing an accessibility audit  
**When** they select a location  
**Then** the location is validated (on footpath/crossing, within pilot area)  
**And** they can see the location on the map  
**And** they can adjust the location if needed

**Given** a user submits an accessibility audit  
**When** the submission is invalid (missing required fields, invalid location)  
**Then** validation errors are shown  
**And** the user can correct the errors  
**And** the submission is not saved until valid

**Given** a user has submitted an accessibility audit  
**When** they view the map  
**Then** their observation is visible (highlighted if "view own contributions" feature available)  
**And** it contributes to accessibility layer visualisation  
**And** it contributes to route accessibility scoring

## Edge Cases

### Location Selection

- **Location outside pilot area**: Show validation error, prompt to select location within pilot area
- **Location not on footpath**: Warn user, allow them to proceed or adjust location
- **GPS not available**: Fall back to map selection, show instructions
- **Invalid address**: Show "Address not found", allow map selection instead

### Form Validation

- **Missing required fields**: Show validation errors for each missing field, highlight fields
- **Invalid data**: Show validation errors (e.g., notes too long), allow correction
- **Duplicate submission**: Detect if similar observation exists at same location, warn user, allow proceed or cancel

### Submission Failures

- **Network error**: Show error message, allow retry, save draft locally if possible
- **Server error**: Show error message, allow retry, log error for support
- **Timeout**: Show timeout message, allow retry

### Moderation

- **Submission pending moderation**: Show "Pending review" status, explain moderation process
- **Submission rejected**: Notify user (if contact method available), explain reason, allow appeal
- **Submission approved**: Notification when approved (if contact method available)

### Data Quality

- **Conflicting observations**: If user's observation conflicts with existing data, show warning, allow proceed
- **Low confidence data**: If user selects "Can't tell" for many fields, warn that data quality will be lower, allow proceed

### Accessibility

- **Form accessibility**: All form fields keyboard accessible, screen reader compatible
- **Map interaction**: Location selection works with keyboard, screen reader describes location
- **Mobile**: Touch-friendly form, large touch targets, responsive layout

## Telemetry Events Emitted

- `submission_initiated`: User starts submission process
  - Parameters: submission_type (accessibility_audit)
- `submission_location_selected`: User selects location
  - Parameters: location_method (map/gps/address), location_lat, location_lon
- `submission_form_started`: User begins filling form
  - Parameters: submission_type
- `submission_form_field_completed`: User completes a form field
  - Parameters: field_name, field_value (anonymised if sensitive)
- `submission_form_abandoned`: User leaves form without submitting
  - Parameters: fields_completed_count, time_spent_seconds
- `submission_submitted`: User submits observation
  - Parameters: submission_type, location_lat, location_lon, fields_completed, submission_id
- `submission_validation_failed`: Submission validation fails
  - Parameters: error_type, error_fields
- `submission_success`: Submission saved successfully
  - Parameters: submission_id, moderation_required (true/false)
- `submission_failed`: Submission save fails
  - Parameters: error_type, error_message

## Accessibility Considerations

### Form Accessibility

- **Keyboard navigation**: Tab through all fields, Enter to submit
- **Screen reader**: All fields have labels, instructions are announced, validation errors are announced
- **Visual accessibility**: High contrast, clear labels, error messages visible
- **Required fields**: Clearly marked (asterisk, text, or both)

### Location Selection Accessibility

- **Keyboard**: Arrow keys to move map, Enter to select location
- **Screen reader**: Describe location selection process, announce selected coordinates
- **Alternative**: Allow address entry as alternative to map selection

### Mobile Accessibility

- **Touch targets**: All buttons and inputs at least 44x44 pixels
- **Form layout**: Responsive, fields stack vertically on small screens
- **Location selection**: Touch-friendly map interaction, large selection area

### Error Handling

- **Validation errors**: Clear, specific error messages, not just "Invalid"
- **Error recovery**: User can correct errors without losing data
- **Error announcements**: Screen readers announce errors immediately

## Related Documents

- [`REQS/data_ingestion_versioning.md`](../REQS/data_ingestion_versioning.md): Data ingestion requirements
- [`REQS/privacy_safety_and_ethics.md`](../REQS/privacy_safety_and_ethics.md): Privacy and ethics requirements
- [`FLOWS/04_lighting_observation_submit.md`](04_lighting_observation_submit.md): Lighting submission flow
- [`FLOWS/05_heat_shade_feedback_submit.md`](05_heat_shade_feedback_submit.md): Heat/shade submission flow
