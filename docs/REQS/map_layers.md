# Requirements: Map Layers

## Scope

This document defines requirements for map layers that visualise lighting, accessibility, and climate data. It covers layer toggles, visualisations, legends, and data provenance display.

## Requirements

### R1: Layer Toggle System

**Requirement**: Users must be able to toggle map layers for lighting, accessibility, and climate data independently or together.

**Acceptance Criteria**:
- Given a user is viewing the map
- When they toggle the lighting layer
- Then lighting data is visualised on the map
- And the layer can be toggled on/off independently of other layers
- And the same works for accessibility and climate layers
- And multiple layers can be active simultaneously

**Data Needed**:
- Lighting data (for lighting layer)
- Accessibility data (for accessibility layer)
- Climate data (for climate layer)
- Base map data

**API/Interface Notes**:
- Layer toggle UI component (checkboxes, buttons, or similar)
- Map rendering system that supports multiple layers
- Layer state management

**Testing Notes**:
- Test layer toggles work correctly
- Test multiple layers can be active together
- Test layer performance (rendering speed)
- Test layer interactions (clicking, hovering)

**Open Questions**:
- How many layers can be active at once? (All three, or limit to avoid clutter?)
- Should layers have opacity controls? (Allow users to adjust layer transparency)
- Should layers have different zoom levels? (Show different detail at different zooms)

---

### R2: Lighting Layer Visualisation

**Requirement**: Lighting layer must visualise lighting data (LUX measurements, perception data, street lighting density) in a clear and understandable way.

**Acceptance Criteria**:
- Given the lighting layer is toggled on
- When users view the map
- Then lighting data is visualised (heat map, points, or similar)
- And the visualisation clearly shows lighting quality (well-lit vs poorly lit areas)
- And a legend explains what the visualisation means
- And data source indicators are visible

**Data Needed**:
- LUX measurements (if available)
- Lighting perception data (community observations)
- Street lighting density (calculated from asset data or observations)
- Location data for each observation

**API/Interface Notes**:
- Lighting data visualisation component
- Heat map or point visualisation
- Legend component
- Data source indicator component

**Testing Notes**:
- Test visualisation clarity (can users understand what they're seeing?)
- Test visualisation performance (rendering speed)
- Test with various data densities (sparse vs dense data)
- Test legend clarity

**Open Questions**:
- What visualisation style? (Heat map, points, lines, choropleth)
- How to handle missing data? (Show gaps, interpolate, or indicate uncertainty)
- Should visualisation change by time of day? (Day vs night, if time data available)

---

### R3: Accessibility Layer Visualisation

**Requirement**: Accessibility layer must visualise accessibility data (footpath audits, Council asset data, crossing assessments) in a clear and understandable way.

**Acceptance Criteria**:
- Given the accessibility layer is toggled on
- When users view the map
- Then accessibility data is visualised (footpath lines, points, or similar)
- And the visualisation clearly shows accessibility quality (accessible vs inaccessible areas)
- And a legend explains what the visualisation means
- And data source indicators are visible

**Data Needed**:
- Footpath audit data (community observations)
- Council footpath asset data (if available)
- Crossing assessment data
- Footpath geometries (from OpenStreetMap or Council data)

**API/Interface Notes**:
- Accessibility data visualisation component
- Line or point visualisation along footpaths
- Legend component
- Data source indicator component

**Testing Notes**:
- Test visualisation clarity
- Test visualisation performance
- Test with various data densities
- Test legend clarity
- Test footpath geometry matching (data aligned with actual footpaths)

**Open Questions**:
- What visualisation style? (Coloured lines along footpaths, points at issues, icons)
- How to show multiple issues on same footpath? (Stack, combine, or show separately)
- Should visualisation show specific issues? (Narrow, obstacles, gradients) or overall accessibility?

---

### R4: Climate Layer Visualisation

**Requirement**: Climate layer must visualise climate data (urban heat, tree canopy, shade patterns) in a clear and understandable way.

**Acceptance Criteria**:
- Given the climate layer is toggled on
- When users view the map
- Then climate data is visualised (heat map, canopy coverage, or similar)
- And the visualisation clearly shows thermal comfort (comfortable vs uncomfortable areas)
- And a legend explains what the visualisation means
- And data source indicators are visible

**Data Needed**:
- Urban heat mapping data (land surface temperature, air temperature)
- Tree canopy data (coverage, health)
- Shade pattern data (calculated from canopy and sun position)
- Community heat/shade feedback

**API/Interface Notes**:
- Climate data visualisation component
- Heat map or raster visualisation
- Legend component
- Data source indicator component

**Testing Notes**:
- Test visualisation clarity
- Test visualisation performance
- Test with various data densities
- Test legend clarity
- Test seasonal variation (if time-series data available)

**Open Questions**:
- What visualisation style? (Heat map, raster, points)
- Should visualisation change by time of day? (Shade patterns change throughout day)
- Should visualisation change by season? (Heat varies by season)
- How to combine heat and shade data? (Separate toggles or combined visualisation)

---

### R5: Layer Legends

**Requirement**: Each layer must have a clear legend that explains what the visualisation means and how to interpret it.

**Acceptance Criteria**:
- Given a layer is toggled on
- When users view the map
- Then a legend is visible (in panel, overlay, or toggleable)
- And the legend explains what colours/symbols mean
- And the legend explains data sources
- And the legend is accessible (keyboard navigable, screen reader compatible)

**Data Needed**:
- Legend definitions for each layer
- Data source information
- Visualisation scale or categories

**API/Interface Notes**:
- Legend component for each layer
- Legend toggle (show/hide)
- Accessible legend implementation

**Testing Notes**:
- Test legend clarity (user testing recommended)
- Test legend accessibility
- Test legend visibility on different screen sizes
- Test legend toggle functionality

**Open Questions**:
- Where to place legends? (Side panel, overlay, bottom corner)
- Should legends be collapsible? (Save screen space)
- How detailed should legends be? (Simple vs comprehensive)

---

### R6: Data Source Indicators

**Requirement**: Each layer must clearly indicate data sources (community, Council, environmental) and data confidence.

**Acceptance Criteria**:
- Given a layer is displayed
- When users view the map
- Then data source indicators are visible (icons, text, or tooltips)
- And users can see which data comes from community, Council, or environmental sources
- And confidence indicators are visible (high/medium/low or numeric)
- And data provenance information is accessible

**Data Needed**:
- Data source metadata (community, Council, environmental)
- Confidence levels (from confidence scoring)
- Data provenance information

**API/Interface Notes**:
- Data source indicator component
- Confidence indicator component
- Tooltip or info panel for detailed provenance

**Testing Notes**:
- Test source indicator clarity
- Test confidence indicator clarity
- Test provenance information accessibility
- Test with mixed data sources (some areas have multiple sources)

**Open Questions**:
- How to display source indicators? (Icons, colours, text, tooltips)
- Should source indicators be always visible or on hover/click?
- How detailed should provenance be? (Simple vs comprehensive)

---

### R7: Layer Performance

**Requirement**: Map layers must render quickly and not degrade map performance significantly.

**Acceptance Criteria**:
- Given a layer is toggled on
- When the map renders
- Then the layer loads within 1 second (for typical pilot area)
- And map pan/zoom maintains 60fps on mid-range devices
- And layer toggle is responsive (< 1 second)

**Data Needed**:
- Optimised layer data (tiled, simplified, or cached)
- Performance budgets defined

**API/Interface Notes**:
- Layer data optimisation (tiling, simplification, caching)
- Performance monitoring
- Lazy loading for off-screen data

**Testing Notes**:
- Test layer load times
- Test map performance with layers active
- Test on mobile devices
- Test with large datasets
- Test layer toggle responsiveness

**Open Questions**:
- What performance targets are acceptable? (Define based on pilot area size)
- Should layers be tiled? (For large areas, tiling improves performance)
- Should layers be cached? (Improve performance but use more storage)

---

### R8: Layer Interactions

**Requirement**: Users must be able to interact with layer data (click for details, hover for information).

**Acceptance Criteria**:
- Given a layer is displayed
- When users click on layer data
- Then they see details about that data point (observation, measurement, etc.)
- And they can see data source and confidence
- And the same works for hover (if applicable)

**Data Needed**:
- Layer data with metadata (observations, measurements, sources)
- Interaction handlers

**API/Interface Notes**:
- Layer interaction handlers (click, hover)
- Data detail component or tooltip
- Performance optimisation for interactions

**Testing Notes**:
- Test layer interactions work correctly
- Test interaction performance
- Test interaction accessibility (keyboard, screen reader)
- Test on mobile (touch interactions)

**Open Questions**:
- What level of detail to show on click/hover? (Simple vs comprehensive)
- Should interactions work on all devices? (Touch on mobile, hover on desktop)
- How to handle overlapping data points? (Show list, prioritise, or combine)

---

## Data Needed

### Lighting Layer Data
- LUX measurements (community or Council)
- Lighting perception data (community observations)
- Street lighting density (calculated from assets)
- Location data for each data point

### Accessibility Layer Data
- Footpath audit data (community observations)
- Council footpath asset data
- Crossing assessment data
- Footpath geometries (OpenStreetMap or Council)

### Climate Layer Data
- Urban heat mapping (satellite or sensor data)
- Tree canopy data (LiDAR or satellite)
- Shade patterns (calculated from canopy and sun)
- Community heat/shade feedback
- Weather data (if available)

### Base Map Data
- Street network
- Aerial/satellite imagery
- Points of interest (optional)

## API or Interface Notes

### Map Rendering System
- Must support multiple layers
- Must support layer toggles
- Must support layer interactions
- Must support performance optimisation (tiling, caching, lazy loading)

### Layer Data Service
- Provides layer data for rendering
- Handles data aggregation and simplification
- Handles data versioning and updates
- Provides data provenance information

### Visualisation Components
- Lighting visualisation component
- Accessibility visualisation component
- Climate visualisation component
- Legend components
- Data source indicator components

## Testing Notes

### Functional Testing
- Test layer toggles work correctly
- Test layer visualisations are clear and understandable
- Test legends are accurate and helpful
- Test data source indicators are visible
- Test layer interactions work

### Performance Testing
- Test layer load times (target: < 1 second)
- Test map performance with layers (target: 60fps)
- Test layer toggle responsiveness (target: < 1 second)
- Test on mobile devices
- Test with large datasets

### Accessibility Testing
- Test keyboard navigation for layer toggles
- Test screen reader support for layers and legends
- Test layer visualisation alternatives (text descriptions)
- Test high contrast and colour accessibility

### User Testing
- Test layer understandability (user testing recommended)
- Test legend clarity
- Test data source indicator clarity

### Edge Case Testing
- Layers with no data (empty layers)
- Layers with sparse data (few observations)
- Layers with dense data (many observations)
- Layers with conflicting data (different sources disagree)
- Layers with missing data (gaps in coverage)

## Open Questions

1. **Visualisation styles**: What styles for each layer? (Heat map, points, lines, raster)
2. **Layer combinations**: Can all layers be active at once? (Clutter vs information)
3. **Opacity controls**: Should users control layer opacity? (UX improvement)
4. **Zoom levels**: Should layers show different detail at different zooms? (Performance vs detail)
5. **Time variation**: Should layers change by time of day or season? (Complexity vs value)
6. **Performance targets**: What are acceptable performance targets? (Define based on pilot area)
7. **Data interpolation**: How to handle missing data? (Show gaps, interpolate, or indicate uncertainty)

## Related Documents

- [`FLOWS/01_plan_route.md`](../FLOWS/01_plan_route.md): Route planning flow (includes layer toggles)
- [`REQS/data_ingestion_versioning.md`](data_ingestion_versioning.md): Data requirements
- [`REQS/scoring_and_rankings.md`](scoring_and_rankings.md): Scoring requirements (uses layer data)
- [`DATA_SOURCES.md`](../DATA_SOURCES.md): Data sources documentation
