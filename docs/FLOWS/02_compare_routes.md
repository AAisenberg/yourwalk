# Flow: Compare Routes

## Purpose

Users view multiple route options side-by-side with detailed score breakdowns to make informed choices about which route to take.

## Primary User

Residents planning walking routes who want to understand trade-offs between different route options.

## Preconditions

- User has planned a route and multiple route options are available
- Route comparison feature is available (Beta phase or later)

## Step-by-Step Flow

1. **User has route options displayed**
   - User has completed route planning flow
   - 2-3 route options are visible on map
   - Routes show basic information (distance, time, overall score)

2. **User clicks "Compare routes" button or similar**
   - Comparison view opens (modal, side panel, or dedicated view)
   - Routes are displayed side-by-side
   - Map view may be minimised or shown alongside comparison

3. **System displays route comparison**
   - Each route is shown in a column or card
   - Routes show:
     - Route name or identifier (e.g., "Route 1", "Shortest", "Best score")
     - Distance (kilometres)
     - Estimated walking time (minutes)
     - Overall score (0-10 or similar)
     - Detailed score breakdown:
       - Lighting score (with confidence indicator)
       - Accessibility score (with confidence indicator)
       - Climate score (with confidence indicator)
     - Visual indicators (colours, icons) for score components
   - Routes are ordered by score (highest first) or user preference

4. **User views detailed breakdowns**
   - User can expand each route to see:
     - Score component details (what contributes to each score)
     - Data sources for each component
     - Confidence levels
     - Key factors (e.g., "Well-lit", "Narrow footpath", "Good shade")
   - Differences between routes are highlighted (e.g., "Route 1 has better lighting than Route 2")

5. **User can view routes on map**
   - User can click "Show on map" for any route
   - Route is highlighted on map
   - Other routes may be dimmed or hidden
   - User can toggle between routes on map

6. **User can toggle map layers in comparison view**
   - User can toggle lighting, accessibility, or climate layers
   - Map updates to show layer data
   - Comparison view remains visible

7. **User selects a route**
   - User clicks "Use this route" or "Select route" button
   - Selected route is confirmed
   - Comparison view closes (or minimises)
   - Selected route is highlighted on main map
   - User can proceed to save route (if account) or submit observations

## Acceptance Criteria

**Given** a user has route options displayed  
**When** they click "Compare routes"  
**Then** they see routes displayed side-by-side with detailed score breakdowns  
**And** each route shows distance, time, overall score, and component scores  
**And** differences between routes are highlighted

**Given** a user is viewing route comparison  
**When** they expand a route's details  
**Then** they see score component details, data sources, and confidence levels  
**And** key factors are explained (e.g., "Well-lit", "Narrow footpath")

**Given** a user is comparing routes  
**When** they click "Show on map" for a route  
**Then** that route is highlighted on the map  
**And** other routes are dimmed or hidden  
**And** they can toggle between routes

**Given** a user has compared routes  
**When** they select a route  
**Then** the selected route is confirmed  
**And** the comparison view closes  
**And** the selected route is highlighted on the main map

## Edge Cases

### Single Route Available

- **Only one route found**: Show message "Only one route available", show route details without comparison
- **Comparison not applicable**: Disable "Compare routes" button or hide it

### Route Details Unavailable

- **Missing score components**: Show "Data not available" for missing components, explain why
- **Low confidence scores**: Show confidence indicators prominently, explain limitations
- **Conflicting data**: Show confidence indicators, explain data sources, allow user to interpret

### Performance

- **Slow loading**: Show loading indicator, allow cancellation
- **Large comparison view**: Optimise rendering, consider pagination if many routes (unlikely in MVP)

### Mobile View

- **Small screen**: Stack routes vertically instead of side-by-side, allow scrolling
- **Touch interactions**: Ensure touch targets are large enough, swipe gestures work

### Accessibility

- **Keyboard navigation**: All comparison interactions work with keyboard
- **Screen reader**: Route comparisons announced clearly, differences described
- **Visual accessibility**: Colour not only indicator, high contrast, clear labels

## Telemetry Events Emitted

- `route_comparison_opened`: User opens comparison view
  - Parameters: route_count, average_score_difference
- `route_comparison_route_expanded`: User expands route details
  - Parameters: route_id, score_breakdown_viewed
- `route_comparison_route_selected`: User selects route from comparison
  - Parameters: route_id, selected_route_score, comparison_duration_seconds
- `route_comparison_closed`: User closes comparison without selecting
  - Parameters: time_spent_seconds
- `route_comparison_map_toggled`: User toggles route on map from comparison
  - Parameters: route_id, map_state (shown/hidden)

## Accessibility Considerations

### Keyboard Navigation

- Tab through route cards, expand/collapse buttons, "Select route" buttons
- Enter/Space to expand route details, select route
- Arrow keys to navigate between routes (if applicable)
- Escape to close comparison view

### Screen Reader Support

- Announce route comparison when opened ("Comparing 3 routes")
- Announce route details when expanded (scores, factors, differences)
- Describe differences between routes clearly
- Announce when route is selected

### Visual Accessibility

- High contrast for route cards and scores
- Colour not the only indicator (use icons, patterns, text)
- Clear focus indicators
- Scalable text and interface elements
- Differences clearly highlighted (not just colour)

### Mobile Accessibility

- Touch-friendly interface (large touch targets)
- Swipe gestures for navigation (if applicable)
- Responsive layout for different screen sizes
- Vertical stacking on small screens

## Related Documents

- [`FLOWS/01_plan_route.md`](01_plan_route.md): Route planning flow
- [`REQS/scoring_and_rankings.md`](../REQS/scoring_and_rankings.md): Scoring requirements
- [`REQS/routing.md`](../REQS/routing.md): Routing requirements
