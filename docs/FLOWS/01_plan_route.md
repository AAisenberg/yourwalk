# Flow: Plan a Route

## Purpose

Users plan a walking route between two points and see route options with integrated insights about lighting, accessibility, and climate conditions.

## Primary User

Residents planning walking routes (commute, recreation, errands, etc.)

## Preconditions

- User is on the YourWalk map interface
- Pilot area data is loaded
- Routing engine is operational
- Data sources are available (at least one per stream)

## Step-by-Step Flow

1. **User opens YourWalk map interface**
   - Map displays with pilot area visible
   - Origin and destination input fields are visible
   - Map layers toggle is visible
   - "Submit observation" button is visible

2. **User enters origin**
   - User can:
     - Type address in origin field
     - Click on map to set origin
     - Use "Use current location" button (if location permissions granted)
   - Origin marker appears on map
   - Address is geocoded and validated (must be within pilot area)

3. **User enters destination**
   - User can:
     - Type address in destination field
     - Click on map to set destination
   - Destination marker appears on map
   - Address is geocoded and validated (must be within pilot area)

4. **User clicks "Plan route" or similar action**
   - System calculates 2-3 route options
   - Routes are displayed on map with different colours/styles
   - Route calculation progress indicator shows (if calculation takes > 2 seconds)

5. **System displays route options**
   - Each route shows:
     - Route line on map (different colour per route)
     - Distance (kilometres)
     - Estimated walking time (minutes)
     - Overall score (0-10 or similar scale)
     - Score breakdown (lighting, accessibility, climate scores)
   - Routes are listed in a panel or sidebar (if space allows)
   - Default route is highlighted (highest score or shortest distance, TBD)

6. **User views route details**
   - User can click on a route to see:
     - Detailed score breakdown
     - Confidence indicators for each score component
     - Data sources for each stream
     - Brief explanation of scores
   - Route is highlighted on map when selected

7. **User can toggle map layers**
   - User can toggle lighting layer to see lighting data on map
   - User can toggle accessibility layer to see accessibility data on map
   - User can toggle climate layer to see climate data on map
   - Layers can be toggled independently or together
   - Legend explains what each layer shows

8. **User selects a route (optional)**
   - User can click "Use this route" or similar
   - Selected route is saved (if user has account) or highlighted
   - User can proceed to compare routes (if feature available) or submit observations

## Acceptance Criteria

**Given** a user is on the YourWalk map interface  
**When** they enter an origin and destination within the pilot area  
**Then** 2-3 route options are calculated and displayed on the map  
**And** each route shows distance, estimated time, and overall score  
**And** score breakdown (lighting, accessibility, climate) is visible

**Given** a user has viewed route options  
**When** they click on a route  
**Then** they see detailed score breakdown  
**And** confidence indicators are visible for each score component  
**And** data sources are indicated

**Given** a user is viewing routes  
**When** they toggle a map layer (lighting, accessibility, or climate)  
**Then** the layer data is visualised on the map  
**And** a legend explains what the visualisation means  
**And** data source indicators are visible

**Given** a user enters an origin or destination outside the pilot area  
**When** they try to plan a route  
**Then** they see a message explaining the pilot area boundaries  
**And** they are prompted to choose a location within the pilot area

**Given** route calculation is in progress  
**When** it takes more than 2 seconds  
**Then** a progress indicator is shown  
**And** the user can cancel the calculation if needed

## Edge Cases

### Invalid Input

- **Empty origin or destination**: Show validation message, disable "Plan route" button
- **Invalid address**: Show "Address not found" message, suggest alternatives
- **Address outside pilot area**: Show message with pilot area boundaries, suggest nearby locations
- **Same origin and destination**: Show message "Origin and destination are the same", allow user to change

### Route Calculation Failures

- **No route found**: Show message "No route found between these points", suggest checking origin/destination
- **Route calculation error**: Show error message, allow retry, log error for support
- **Timeout**: Show timeout message, allow retry, suggest simpler route

### Data Availability

- **No data for route area**: Show routes with low confidence scores, explain data limitations
- **Partial data**: Show scores for available data streams, indicate missing data
- **Conflicting data**: Show confidence indicators, explain data sources, allow user to interpret

### Performance

- **Slow calculation**: Show progress indicator, allow cancellation
- **Large route distance**: Warn if route is very long (> 10km), suggest breaking into segments
- **Map performance**: Optimise rendering for large routes, show simplified view if needed

### Accessibility

- **Keyboard navigation**: All interactions work with keyboard only
- **Screen reader**: Route information announced, map interactions described
- **Mobile**: Touch-friendly interface, responsive layout

## Telemetry Events Emitted

- `route_plan_initiated`: User enters origin and destination
  - Parameters: origin_type (address/map/current), destination_type, pilot_area
- `route_calculation_started`: Route calculation begins
  - Parameters: origin_lat, origin_lon, dest_lat, dest_lon, distance_estimate
- `route_calculation_completed`: Routes calculated successfully
  - Parameters: route_count, calculation_time_ms, average_score
- `route_calculation_failed`: Route calculation fails
  - Parameters: error_type, error_message
- `route_selected`: User selects a route
  - Parameters: route_id, route_score, route_distance, route_time
- `route_details_viewed`: User views detailed route breakdown
  - Parameters: route_id, score_breakdown_viewed
- `layer_toggled`: User toggles a map layer
  - Parameters: layer_name (lighting/accessibility/climate), layer_state (on/off)
- `geocoding_success`: Address geocoded successfully
  - Parameters: address_type (origin/destination), geocoding_time_ms
- `geocoding_failed`: Address geocoding fails
  - Parameters: address_type, error_type

## Accessibility Considerations

### Keyboard Navigation

- Tab through origin/destination fields, "Plan route" button, route list, layer toggles
- Enter/Space to activate buttons and select routes
- Arrow keys to navigate route list (if applicable)
- Escape to close modals or cancel actions

### Screen Reader Support

- Announce when routes are calculated ("3 routes found")
- Announce route details when selected (distance, time, scores)
- Describe map layers when toggled ("Lighting layer shows street lighting data")
- Announce errors and validation messages
- Provide skip links for main content

### Visual Accessibility

- High contrast for route lines and markers
- Colour not the only indicator (use patterns, labels)
- Clear focus indicators for interactive elements
- Text alternatives for map visualisations
- Scalable text and interface elements

### Mobile Accessibility

- Touch targets at least 44x44 pixels
- Swipe gestures for map navigation
- Voice input for addresses (if supported)
- Responsive layout for different screen sizes

## Related Documents

- [`REQS/routing.md`](../REQS/routing.md): Detailed routing requirements
- [`REQS/scoring_and_rankings.md`](../REQS/scoring_and_rankings.md): Scoring requirements
- [`REQS/map_layers.md`](../REQS/map_layers.md): Map layer requirements
- [`FLOWS/02_compare_routes.md`](02_compare_routes.md): Route comparison flow
