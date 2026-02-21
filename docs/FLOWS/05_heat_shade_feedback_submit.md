# Flow: Submit Heat/Shade Feedback

## Purpose

Users contribute observations about thermal comfort, shade availability, and heat exposure that appear on the map and contribute to route climate scores.

## Primary User

Residents who walk in hot weather or want to share information about shade and thermal comfort conditions.

## Preconditions

- User is on the YourWalk map interface
- Heat/shade submission feature is available (Beta phase or later)
- User has location permissions (if using GPS) or can select location on map

## Step-by-Step Flow

1. **User initiates submission**
   - User clicks "Submit observation" or similar button
   - Submission type selection appears (if multiple types available)
   - User selects "Heat/shade feedback"

2. **User selects location**
   - User can:
     - Click on map to set location
     - Use current location (if permissions granted)
     - Enter address and geocode
   - Location marker appears on map
   - Location is validated (within pilot area, on a street or path)

3. **User completes heat/shade feedback form**
   - Form includes fields:
     - **Location** (pre-filled from step 2, can be adjusted)
     - **Date and time** (pre-filled with current, can be adjusted)
     - **Perceived comfort** (dropdown or buttons: Too hot, Uncomfortably warm, Comfortable, Cool, Too cold)
     - **Shade availability** (dropdown or buttons: Full shade, Partial shade, No shade, Can't tell)
     - **Shade source** (checkboxes: Tree canopy, Building shade, Awning/cover, Other, None)
     - **Weather conditions** (optional, dropdown: Sunny, Partly cloudy, Cloudy, Overcast, Other)
     - **Temperature** (optional, number input with unit, if user has thermometer or weather app)
     - **Time of day** (pre-filled from time field, can be adjusted, important for shade patterns)
     - **Seasonal context** (optional, dropdown: Summer, Autumn, Winter, Spring, or auto-detect from date)
     - **Additional notes** (optional text field, max 500 characters, e.g., "Shade disappears in afternoon", "Very exposed to sun")
   - Form validates required fields
   - User can see location on map while filling form

4. **User reviews submission**
   - Summary of submission is shown
   - Location is highlighted on map
   - Date, time, and key observations are shown
   - User can edit any field before submitting

5. **User submits**
   - User clicks "Submit" or "Save observation"
   - Submission is validated (location, required fields, date/time reasonable)
   - Submission is saved to database
   - Submission enters moderation queue (if moderation enabled)

6. **System confirms submission**
   - Success message is shown ("Thank you for your contribution!")
   - User's observation appears on map (immediately if no moderation, or after moderation)
   - Observation is highlighted or marked as "Your contribution"
   - User can submit another observation or return to map

## Acceptance Criteria

**Given** a user wants to contribute heat/shade feedback  
**When** they complete the heat/shade feedback form with valid data  
**Then** their observation is saved  
**And** it appears on the map (after moderation if applicable)  
**And** they receive confirmation that their contribution was recorded

**Given** a user is completing heat/shade feedback  
**When** they select a location, date, and time  
**Then** the location is validated (within pilot area)  
**And** the date and time are validated (reasonable, not too far in past/future)  
**And** they can see the location on the map

**Given** a user submits heat/shade feedback with temperature measurement  
**When** the temperature value is provided  
**Then** the temperature measurement is stored with the observation  
**And** it contributes to climate layer visualisation  
**And** it is used in route climate scoring (if applicable)

**Given** a user has submitted heat/shade feedback  
**When** they view the map  
**Then** their observation is visible (highlighted if "view own contributions" feature available)  
**And** it contributes to climate layer visualisation  
**And** it contributes to route climate scoring

## Edge Cases

### Location Selection

- **Location outside pilot area**: Show validation error, prompt to select location within pilot area
- **GPS not available**: Fall back to map selection, show instructions
- **Invalid address**: Show "Address not found", allow map selection instead

### Time Selection

- **Time too far in past**: Warn if observation is more than 90 days old (seasonal relevance), allow proceed or adjust
- **Time in future**: Show validation error, require current or past time
- **Time not specified**: Default to current time, allow user to adjust
- **Seasonal relevance**: Warn if observation is from different season (e.g., winter observation in summer), allow proceed

### Temperature Measurement

- **Temperature out of range**: Warn if value seems unreasonable (e.g., > 50°C or < -10°C for Melbourne area), allow proceed or adjust
- **Temperature unit confusion**: Clearly label as "°C" (Celsius), provide unit conversion if needed
- **No thermometer**: Form works without temperature measurement, clearly marked as optional

### Form Validation

- **Missing required fields**: Show validation errors for each missing field, highlight fields
- **Invalid data**: Show validation errors, allow correction
- **Duplicate submission**: Detect if similar observation exists at same location and time, warn user, allow proceed or cancel

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
- **Perception vs measurement**: If temperature measurement conflicts with perceived comfort, store both, allow user to note discrepancy
- **Seasonal variation**: Note that observations from different seasons may not be directly comparable

### Accessibility

- **Form accessibility**: All form fields keyboard accessible, screen reader compatible
- **Map interaction**: Location selection works with keyboard, screen reader describes location
- **Mobile**: Touch-friendly form, large touch targets, responsive layout

## Telemetry Events Emitted

- `submission_initiated`: User starts submission process
  - Parameters: submission_type (heat_shade_feedback)
- `submission_location_selected`: User selects location
  - Parameters: location_method (map/gps/address), location_lat, location_lon
- `submission_form_started`: User begins filling form
  - Parameters: submission_type
- `submission_form_field_completed`: User completes a form field
  - Parameters: field_name, field_value (anonymised if sensitive)
- `submission_temperature_provided`: User provides temperature measurement
  - Parameters: temperature_value (anonymised, range only if privacy concern)
- `submission_form_abandoned`: User leaves form without submitting
  - Parameters: fields_completed_count, time_spent_seconds
- `submission_submitted`: User submits observation
  - Parameters: submission_type, location_lat, location_lon, has_temperature, season, submission_id
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
- **Date/time input**: Accessible date/time picker or clear format instructions

### Location Selection Accessibility

- **Keyboard**: Arrow keys to move map, Enter to select location
- **Screen reader**: Describe location selection process, announce selected coordinates
- **Alternative**: Allow address entry as alternative to map selection

### Mobile Accessibility

- **Touch targets**: All buttons and inputs at least 44x44 pixels
- **Form layout**: Responsive, fields stack vertically on small screens
- **Location selection**: Touch-friendly map interaction, large selection area
- **Temperature input**: Large, easy-to-use number input on mobile

### Error Handling

- **Validation errors**: Clear, specific error messages, not just "Invalid"
- **Error recovery**: User can correct errors without losing data
- **Error announcements**: Screen readers announce errors immediately

## Related Documents

- [`REQS/data_ingestion_versioning.md`](../REQS/data_ingestion_versioning.md): Data ingestion requirements
- [`REQS/privacy_safety_and_ethics.md`](../REQS/privacy_safety_and_ethics.md): Privacy and ethics requirements
- [`FLOWS/03_accessibility_audit_submit.md`](03_accessibility_audit_submit.md): Accessibility submission flow
- [`FLOWS/04_lighting_observation_submit.md`](04_lighting_observation_submit.md): Lighting submission flow
