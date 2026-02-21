# Requirements: Routing

## Scope

This document defines requirements for route calculation, display, and interaction in YourWalk. It covers route planning between two points, route options, route visualisation, and route selection.

## Requirements

### R1: Route Calculation

**Requirement**: System must calculate 2-3 route options between any two points in the pilot area.

**Acceptance Criteria**:
- Given a user enters an origin and destination within the pilot area
- When they request route calculation
- Then 2-3 route options are calculated
- And routes are displayed on the map within 5 seconds
- And routes avoid obvious obstacles (rivers, highways without crossings, etc.)

**Data Needed**:
- Street network data (OpenStreetMap or Council data)
- Pilot area boundaries
- Obstacle data (if available)

**API/Interface Notes**:
- Route calculation API or service (OSRM, GraphHopper, or custom)
- Input: origin coordinates, destination coordinates, pilot area boundaries
- Output: Route geometries, distances, estimated times

**Testing Notes**:
- Test with 50+ origin/destination pairs across pilot area
- Test edge cases: very short routes (< 100m), very long routes (> 10km), same origin/destination
- Test performance: routes should calculate within 5 seconds
- Test with missing or incomplete street network data

**Open Questions**:
- Which routing engine to use? (See ADR-001 in [`DECISIONS.md`](../DECISIONS.md))
- Should routes optimise for distance, time, or integrated scores? (Post-hoc ranking vs weighted cost)
- How to handle routes outside pilot area? (Error, warning, or allow with limitations)

---

### R2: Route Display

**Requirement**: Calculated routes must be displayed on the map with clear visual distinction and basic information.

**Acceptance Criteria**:
- Given routes are calculated
- When they are displayed on the map
- Then each route is shown with a distinct colour or style
- And routes are clickable to view details
- And route information (distance, time, score) is visible in a panel or tooltip

**Data Needed**:
- Route geometries from calculation
- Route metadata (distance, time, scores)

**API/Interface Notes**:
- Map rendering system must support route line styling
- Route click handlers for interaction
- Route information panel or tooltip component

**Testing Notes**:
- Test route visualisation on different map zoom levels
- Test route interaction (clicking, hovering)
- Test route display on mobile devices
- Test with overlapping routes

**Open Questions**:
- How many routes to show by default? (2-3 recommended, but configurable?)
- Should routes be numbered or named? (Route 1, Route 2, or "Shortest", "Best score"?)
- How to handle routes that are very similar? (Merge, show both, or highlight differences?)

---

### R3: Route Information

**Requirement**: Each route must display distance, estimated walking time, overall score, and score breakdown.

**Acceptance Criteria**:
- Given a route is displayed
- When the user views route information
- Then they see distance in kilometres (e.g., "2.3 km")
- And they see estimated walking time in minutes (e.g., "28 min")
- And they see overall score (0-10 or similar scale)
- And they see score breakdown (lighting, accessibility, climate scores)

**Data Needed**:
- Route distance (from calculation)
- Estimated walking time (calculated from distance and average walking speed)
- Route scores (from scoring system, see [`scoring_and_rankings.md`](scoring_and_rankings.md))

**API/Interface Notes**:
- Route information component or panel
- Score display component
- Time calculation: distance / average walking speed (e.g., 5 km/h)

**Testing Notes**:
- Test distance calculation accuracy
- Test time estimation (compare with actual walking times if available)
- Test score display and breakdown
- Test with missing score data (show "N/A" or low confidence)

**Open Questions**:
- What average walking speed to use? (5 km/h standard, but should it be configurable?)
- Should time account for gradients or other factors? (More complex calculation)
- How to display scores? (Numeric, stars, bars, colours?)

---

### R4: Route Selection

**Requirement**: Users must be able to select a route for further action (save, compare, use for navigation).

**Acceptance Criteria**:
- Given routes are displayed
- When a user clicks on a route or "Select" button
- Then the route is highlighted or marked as selected
- And the user can proceed to save route (if account), compare routes, or submit observations

**Data Needed**:
- Selected route identifier
- Route metadata for saving (if account feature available)

**API/Interface Notes**:
- Route selection handler
- Route state management (selected route)
- Integration with save and compare features

**Testing Notes**:
- Test route selection interaction
- Test route deselection
- Test integration with save and compare features
- Test on mobile (touch interactions)

**Open Questions**:
- Should selection persist across sessions? (If user has account)
- Can users select multiple routes? (For comparison, probably not for single selection)

---

### R5: Origin and Destination Input

**Requirement**: Users must be able to enter origin and destination via address, map click, or current location.

**Acceptance Criteria**:
- Given a user wants to plan a route
- When they enter an origin
- Then they can type an address, click on map, or use current location
- And the origin is geocoded and validated (within pilot area)
- And the origin marker appears on the map
- And the same works for destination

**Data Needed**:
- Geocoding service (address to coordinates)
- Reverse geocoding service (coordinates to address, optional)
- Pilot area boundaries for validation
- User location (if current location used, requires permissions)

**API/Interface Notes**:
- Geocoding API or service
- Map click handler for coordinate selection
- Location permissions and current location API
- Address input with autocomplete (optional but recommended)

**Testing Notes**:
- Test address geocoding accuracy
- Test map click coordinate selection
- Test current location (with and without permissions)
- Test validation (addresses outside pilot area)
- Test with invalid addresses

**Open Questions**:
- Which geocoding service to use? (Google, Mapbox, OpenStreetMap Nominatim, Council data?)
- Should address autocomplete be included? (Improves UX but adds complexity)
- How to handle ambiguous addresses? (Show list of options)

---

### R6: Route Validation

**Requirement**: Routes must be validated to ensure they are within pilot area and use valid street network.

**Acceptance Criteria**:
- Given a route is calculated
- When it is validated
- Then it is checked against pilot area boundaries
- And it is checked against street network validity
- And validation errors are shown to user if route is invalid

**Data Needed**:
- Pilot area boundaries
- Street network data
- Route geometry

**API/Interface Notes**:
- Validation service or function
- Error handling and user feedback

**Testing Notes**:
- Test routes within pilot area (should pass)
- Test routes outside pilot area (should fail or warn)
- Test routes with invalid street segments (should handle gracefully)
- Test error messages are clear and helpful

**Open Questions**:
- Should routes that partially leave pilot area be allowed? (Probably not for MVP)
- How strict should validation be? (Warn vs error)

---

### R7: Route Preferences (v1 Phase)

**Requirement**: Users can set preferences that affect route scoring and ranking (e.g., avoid poorly lit routes, prioritise accessibility).

**Acceptance Criteria**:
- Given a user sets routing preferences
- When they plan a route
- Then route scores are adjusted to reflect their preferences
- And route rankings update accordingly
- And preferences are saved for future sessions (if logged in)

**Data Needed**:
- User preferences (if account system available)
- Route scores (to be adjusted)
- Preference weights or adjustments

**API/Interface Notes**:
- Preference storage (database or local storage)
- Scoring algorithm that incorporates preferences
- Preference UI component

**Testing Notes**:
- Test preference application to route scores
- Test route ranking changes with preferences
- Test preference persistence (if account system)
- Test with multiple preferences set

**Open Questions**:
- Which preferences to support? (Avoid poorly lit, prioritise accessibility, avoid heat, etc.)
- How to weight preferences? (Simple multipliers or more complex algorithm?)
- Should preferences be saved anonymously? (Local storage vs account)

---

## Data Needed

### Street Network Data
- Source: OpenStreetMap or Council data
- Format: Road geometries, road types, one-way restrictions
- Update: Continuous (OSM) or as updated (Council)
- Coverage: Full pilot area

### Pilot Area Boundaries
- Source: Council or project definition
- Format: Polygon geometry
- Update: Static for pilot
- Coverage: Pilot area definition

### Geocoding Data
- Source: Geocoding service (Google, Mapbox, Nominatim, etc.)
- Format: Address to coordinates, coordinates to address
- Update: Real-time via API
- Coverage: Pilot area and surrounding areas

## API or Interface Notes

### Route Calculation Service
- Input: Origin coordinates, destination coordinates, options (avoidances, preferences)
- Output: Route geometries, distances, estimated times, alternative routes
- Performance: Must complete within 5 seconds for typical routes

### Geocoding Service
- Input: Address string or coordinates
- Output: Coordinates or address, confidence score
- Performance: Should complete within 1 second

### Map Rendering
- Must support route line rendering with custom styles
- Must support route interaction (click, hover)
- Must support route information display

## Testing Notes

### Functional Testing
- Test route calculation for various origin/destination pairs
- Test route display and interaction
- Test origin/destination input methods
- Test route validation
- Test error handling

### Performance Testing
- Test route calculation time (target: < 5 seconds)
- Test geocoding time (target: < 1 second)
- Test map rendering performance with multiple routes
- Test on mobile devices

### Accessibility Testing
- Test keyboard navigation for route selection
- Test screen reader support for route information
- Test route visualisation alternatives (text descriptions)

### Edge Case Testing
- Very short routes (< 100m)
- Very long routes (> 10km)
- Same origin and destination
- Addresses outside pilot area
- Invalid addresses
- Missing street network data
- Overlapping routes

## Open Questions

1. **Routing engine choice**: Which engine to use? (See ADR-001)
2. **Route optimisation**: Post-hoc ranking vs weighted cost routing? (See ADR-001)
3. **Geocoding service**: Which service to use? (Cost, accuracy, licensing considerations)
4. **Address autocomplete**: Should we include it? (UX improvement vs complexity)
5. **Route preferences**: Which preferences to support in v1? (Scope decision)
6. **Route naming**: How to name/identify routes? (Route 1/2/3 vs descriptive names)
7. **Route persistence**: Should routes be saved? (Requires account system)

## Related Documents

- [`FLOWS/01_plan_route.md`](../FLOWS/01_plan_route.md): Route planning user flow
- [`FLOWS/02_compare_routes.md`](../FLOWS/02_compare_routes.md): Route comparison flow
- [`REQS/scoring_and_rankings.md`](scoring_and_rankings.md): Scoring requirements
- [`DECISIONS.md`](../DECISIONS.md): Architecture decisions (ADR-001)
