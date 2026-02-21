# YourWalk Data Set Register

This document catalogues datasets that could feed into the YourWalk vulnerability index, which scores locations on lighting and night-time safety, footpath and crossing accessibility, and urban heat and shade. Each dataset is classified by theme and layer (base, LGA-specific essential, LGA-specific enriching).

---

## 1. Summary

### Layering Model

| Layer | Definition | Key Insight |
|-------|------------|-------------|
| **Base** | Data available at state, national, or global scale. Can underpin the index in any LGA without council-specific supply. | Enables replicability across LGAs. |
| **LGA-specific essential** | Data sourced per-LGA but essential to compute the index for a given theme. Most councils have this data; it should be requested when onboarding a new LGA. | Without this, a theme cannot be reliably scored. |
| **LGA-specific enriching** | Data sourced per-LGA that enriches the index but is not essential. If missing, the index can still run using base + essential data. | Optional depth; can be layered on later. |

### Themes

1. **Lighting and night-time safety** – Street lighting assets, LUX measurements, night-time visibility, perceived safety after dark.
2. **Footpath and crossing accessibility** – Footpath location, condition, width, surface, obstacles, gradients; crossing location, type, signals, tactile indicators.
3. **Urban heat and shade** – Land surface temperature, air temperature, tree canopy, shade, exposure, thermal comfort.
4. **Safety perceptions** – Participatory or survey data on perceived safety, comfort, or fear.
5. **Crash / incident data** – Pedestrian-involved crashes or incidents.
6. **Other / contextual** – Demographics, land use, points of interest, elevation, or other data that supports the index or routing.

### Key Findings

- **Casey pilot is well-supported**: Casey Open Data provides essential lighting assets, footpaths, school crossings, and parks data.
- **Tree canopy data exists at state level**: Vicmap Vegetation Tree Urban covers metropolitan Melbourne (including Casey) with individual tree points and heights.
- **Urban heat data available but dated**: The "Cooling and Greening Melbourne" dataset provides 2018 land surface temperature and heat vulnerability index at mesh block level for Greater Melbourne.
- **Crash data is comprehensive**: VicRoads/Transport Victoria provides detailed crash data with pedestrian filtering capability back to 2012.
- **Perception data exists**: YourGround (2021) and WalkSpot (2017) provide participatory safety data, though WalkSpot is now dated.
- **General crossing data gap**: Casey provides school crossings but a comprehensive pedestrian crossing dataset (signalised, zebra, refuge) was not found on the open data portal. This may need to be requested from Council or derived from OpenStreetMap.

---

## 2. Data Set Register

### 2.1 Lighting and Night-Time Safety

| Dataset | Source | Link | Layer | Geographic Scope | Vintage / Update | Access / License | Pedestrian Relevance | Notes |
|---------|--------|------|-------|------------------|------------------|------------------|---------------------|-------|
| **Casey Maintained Lights** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/casey-maintained-lights) | LGA-specific essential | City of Casey | Current; updated periodically | Open Data (CC-BY-4.0) | High – provides light pole locations and types for street lighting coverage | Essential for Lighting theme. Includes location and asset type. |
| **OpenStreetMap Lighting Tags** | OpenStreetMap | [Overpass query](https://overpass-turbo.eu/) / [Wiki](https://wiki.openstreetmap.org/wiki/Key:lit) | Base | Global | Continuous (community-maintained) | ODbL | Medium – lit=yes/no tags on streets and paths | Coverage varies; useful fallback where council data unavailable. Quality inconsistent. |
| **YourGround** | Monash XYX Lab / CrowdSpot | [YourGround VIC](https://www.yourground.org/yourground-vic) / [Research page](https://research.monash.edu/en/projects/your-ground/) | LGA-specific enriching | Victoria-wide | 2021 (April–July) | Research data; access TBC with XYX Lab | High – perceived safety after dark is core to dataset | ~6,000 submissions across Victoria. Focus on women and gender-diverse people. |
| **WalkSpot** | Victoria Walks / CrowdSpot | [WalkSpot site](https://www.walkspot.org.au/) / [Victoria Walks page](https://www.victoriawalks.org.au/WalkSpot/) | LGA-specific enriching | Metropolitan Melbourne | 2017 (March–April) | Research data; VicRoads/councils received data | High – includes "poor street lighting" as category | ~2,350 safe/unsafe spots. Now 8+ years old; limited currency. |

### 2.2 Footpath and Crossing Accessibility

| Dataset | Source | Link | Layer | Geographic Scope | Vintage / Update | Access / License | Pedestrian Relevance | Notes |
|---------|--------|------|-------|------------------|------------------|------------------|---------------------|-------|
| **Footpaths in City of Casey** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/footpaths) | LGA-specific essential | City of Casey | Current; last updated 2025 | Open Data (CC-BY-4.0) | High – location and width of footpaths | Essential for Accessibility theme. Extracted from Asset Management System. |
| **Footpaths (T1EAM)** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/) | LGA-specific essential | City of Casey | Current | Open Data (CC-BY-4.0) | High – alternative footpath dataset from OneCouncil system | May have different attributes; compare with main footpath dataset. |
| **School Crossing Locations** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/school-crossings) | LGA-specific enriching | City of Casey | Current | Open Data (CC-BY-4.0) | High – school crossing locations with supervision times, speed zones | Useful for safe routes to school; does not cover all pedestrian crossings. |
| **OpenStreetMap Footways/Crossings** | OpenStreetMap | [Overpass query](https://overpass-turbo.eu/) / [AU Tagging Guide](https://wiki.openstreetmap.org/wiki/Australian_Tagging_Guidelines/Cycling_and_Foot_Paths) | Base | Global | Continuous | ODbL | High – footpath geometry, surface tags, crossing tags | Quality varies. Australian tagging guidelines exist. May have gaps in crossing data. |
| **Vicmap Elevation 1m DEM** | DEECA / DataVic | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-elevation-1m-digital-elevation-model-dem-footprints) / [Product info](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-elevation/1m-dem) | Base | Victoria (60% coverage; 99% in populated areas) | 2009–present (LiDAR) | Government users free; others via Data Service Providers | Medium – derive slope/gradient for accessibility | High accuracy (+/- 10cm vertical). Slope data important for wheelchair/mobility access. |
| **MOVE Accessibility Data** | MOVE | [MOVE website](https://movethemap.com.au/) | LGA-specific enriching | Australian cities | Ongoing crowdsourced | Open contributions | High – crowdsourced accessibility barriers (broken footpaths, ramps, steps) | Australian equivalent of Project Sidewalk. Coverage in Casey unknown. |
| **WalkSpot** | Victoria Walks / CrowdSpot | [WalkSpot site](https://www.walkspot.org.au/) | LGA-specific enriching | Metropolitan Melbourne | 2017 | Research data | High – includes footpath condition and crossing concerns | Same dataset as lighting; relevant to accessibility. Dated. |

### 2.3 Urban Heat and Shade

| Dataset | Source | Link | Layer | Geographic Scope | Vintage / Update | Access / License | Pedestrian Relevance | Notes |
|---------|--------|------|-------|------------------|------------------|------------------|---------------------|-------|
| **Metropolitan Melbourne Urban Heat Islands and Vegetation 2018** | DEECA / DataVic | [DataVic page](https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018) / [Interactive map](https://mapshare.vic.gov.au/coolinggreening/) | Base | Greater Melbourne (incl. Casey) | 2018 satellite imagery | CC-BY-4.0 | High – land surface temperature and vegetation at mesh block level | Best available state-level heat data. 2018 vintage is a limitation. |
| **Vicmap Vegetation Tree Urban (Points)** | DEECA / DataVic | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-point) / [Product info](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-vegetation) | Base | Metropolitan Melbourne + regional urban areas | 2019/2020 aerial + LiDAR | CC-BY-4.0 | High – individual tree locations with heights | Covers Casey as part of metro Melbourne. Derived from ML on aerial imagery. |
| **Vicmap Vegetation Tree Density (Polygons)** | DEECA / DataVic | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon) | Base | Metropolitan Melbourne + regional | 2019/2020 | CC-BY-4.0 | High – canopy density polygons | Alternative to point data; may be easier for coverage analysis. |
| **Heat Vulnerability Index 2018** | DEECA / DataVic | [Planning Vic info](https://www.planning.vic.gov.au/guides-and-resources/data-and-insights/melbournes-vegetation-heat-and-land-use-data) | Base | Greater Melbourne | 2018 | CC-BY-4.0 | High – combines heat exposure, population sensitivity, adaptive capacity | Could inform weighting of heat theme by vulnerable populations. |
| **MODIS Land Surface Temperature** | NASA Earthdata | [Earthdata catalogue](https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod11a1-061) / [NASA LST info](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php) | Base | Global | Daily; ongoing | Free | Medium – 1km resolution; continental-scale | Too coarse for street-level but could supplement/validate. |
| **Casey Parks and Reserves** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/parks-and-reserves1) | LGA-specific enriching | City of Casey | Current | Open Data (CC-BY-4.0) | Medium – park locations often correlate with shade/greenery | Indirect indicator of shade availability. |
| **Bureau of Meteorology Temperature** | BoM | [Data services](https://www.bom.gov.au/resources/data-services) / [Vic observations](https://www.bom.gov.au/vic/observations/) | Base | Australia | Real-time and historical | Free for historical; paid for real-time API | Medium – weather station temperature data | Limited spatial coverage within LGA; supports temporal context (hot days). |
| **Google Environmental Insights Explorer** | Google | [EIE platform](https://insights.sustainability.google/) / [Tree Canopy Lab](https://sustainability.google/operating-sustainably/stories/tree-canopy-lab/) | Base | Cities (coverage varies) | Seasonal updates | Free web access; no API confirmed | High – tree canopy and heat vulnerability data | Coverage for Casey/Melbourne unknown. Worth investigating. |

### 2.4 Safety Perceptions

| Dataset | Source | Link | Layer | Geographic Scope | Vintage / Update | Access / License | Pedestrian Relevance | Notes |
|---------|--------|------|-------|------------------|------------------|------------------|---------------------|-------|
| **YourGround** | Monash XYX Lab / CrowdSpot | [YourGround VIC](https://www.yourground.org/yourground-vic) / [Research publication](https://research.monash.edu/en/publications/yourground-mapping-a-safer-victoria-for-women-and-gender-diverse-) | LGA-specific enriching | Victoria-wide | 2021 | Research data; access TBC with XYX Lab | High – perceived safety in outdoor spaces, focus on women/gender-diverse | ~6,000 submissions. Supported by 23 local governments. |
| **WalkSpot** | Victoria Walks / CrowdSpot | [WalkSpot site](https://www.walkspot.org.au/) / [Victoria Walks page](https://www.victoriawalks.org.au/WalkSpot/) | LGA-specific enriching | Metropolitan Melbourne | 2017 | Research data; Victoria Walks project | High – safe/unsafe walking spots with categories | Dated but provides baseline perception data. |
| **BikeSpot** | Victoria Walks / CrowdSpot | [BikeSpot site](https://bikespot.org/) | LGA-specific enriching | Metropolitan Melbourne | Various | Research data | Low – cycling-focused but may include shared path data | Could inform shared path conditions; less relevant to pedestrian-only routes. |

### 2.5 Crash / Incident Data

| Dataset | Source | Link | Layer | Geographic Scope | Vintage / Update | Access / License | Pedestrian Relevance | Notes |
|---------|--------|------|-------|------------------|------------------|------------------|---------------------|-------|
| **Victoria Road Crash Data** | Transport Victoria / VicRoads | [Open Data portal](https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data) / [Dashboard](https://vic.gov.au/road-crash-statistics) | Base | Victoria-wide | 2012–present; monthly updates (7-month lag) | CC-BY-4.0 | High – includes pedestrian crashes via "person" table filtering | Comprehensive dataset with location (lat/long), crash type, road user type. Essential for crash theme. |
| **TAC Road Trauma Statistics** | TAC via DataVic | [DataVic page](https://discover.data.vic.gov.au/dataset/victorian-road-toll-tac) / [TAC search](https://www.tac.vic.gov.au/road-safety/statistics/online-crash-database) | Base | Victoria-wide | 1987–present (fatalities); 2000–present (claims) | CC-BY-4.0 | High – fatalities and hospitalisations including pedestrians | Complements VicRoads crash data with severity/injury detail. |
| **Victorian Serious Road Casualties** | TAC via DataVic | [DataVic page](https://discover.data.vic.gov.au/dataset/victorian-serious-road-casualties-tac) | Base | Victoria-wide | Ongoing | CC-BY-4.0 | High – hospital admissions within 7 days of crash | Captures serious injuries not just fatalities. |

### 2.6 Other / Contextual

| Dataset | Source | Link | Layer | Geographic Scope | Vintage / Update | Access / License | Pedestrian Relevance | Notes |
|---------|--------|------|-------|------------------|------------------|------------------|---------------------|-------|
| **SEIFA 2021 (Socio-Economic Indexes)** | ABS / City of Casey | [ABS SEIFA](https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021) / [Casey SEIFA](https://data.casey.vic.gov.au/explore/dataset/seifa21_coc_sa2_relativesocioeconomic_index) | Base | Australia (available at SA2) | 2021 Census | Open | Medium – could weight vulnerability by socio-economic disadvantage | Available on Casey Open Data at SA2 level. |
| **ABS Census Demographics** | ABS | [Census 2021](https://www.abs.gov.au/census/find-census-data) / [TableBuilder](https://www.abs.gov.au/statistics/microdata-tablebuilder/tablebuilder) | Base | Australia | 2021 (next 2026) | Open | Medium – age, disability, population density for weighting | Supports identification of vulnerable populations. |
| **Pedestrian Count (Hourly)** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/pedestrian) / [IoT Sensors](https://data.casey.vic.gov.au/explore/dataset/iot-sensors-insights) | LGA-specific enriching | Casey (select locations) | August 2021–present | Open Data (CC-BY-4.0) | High – pedestrian volumes at sensor locations | Useful for understanding usage patterns; limited spatial coverage. |
| **OpenStreetMap Street Network** | OpenStreetMap | [OpenStreetMap](https://www.openstreetmap.org/) / [Geofabrik downloads](https://download.geofabrik.de/australia-oceania/australia.html) | Base | Global | Continuous | ODbL | High – base routing network | Essential for routing engine. |
| **OpenStreetMap POIs** | OpenStreetMap | [Overpass Turbo](https://overpass-turbo.eu/) / [TagInfo](https://taginfo.openstreetmap.org/) | Base | Global | Continuous | ODbL | Medium – destinations (schools, shops, transit) | Supports origin/destination context. |

---

## 3. Themes Map

### Theme 1: Lighting and Night-Time Safety

| Dataset | Layer | Coverage | Priority |
|---------|-------|----------|----------|
| Casey Maintained Lights | LGA-specific essential | Casey | **Must have** |
| OpenStreetMap Lighting Tags | Base | Global (variable) | Fallback |
| YourGround | LGA-specific enriching | Victoria | Enriching |
| WalkSpot (2017) | LGA-specific enriching | Metro Melbourne | Enriching (dated) |
| VIIRS Night-Time Lights | Base | Global | Optional (coarse) |

**Essential dependency**: Lighting theme requires council lighting asset data. Without it, the theme cannot be reliably scored.

### Theme 2: Footpath and Crossing Accessibility

| Dataset | Layer | Coverage | Priority |
|---------|-------|----------|----------|
| Footpaths in City of Casey | LGA-specific essential | Casey | **Must have** |
| OpenStreetMap Footways/Crossings | Base | Global (variable) | Base network |
| Vicmap Elevation 1m DEM | Base | Victoria (99% populated) | Gradient/slope |
| School Crossing Locations | LGA-specific enriching | Casey | Enriching |
| MOVE Accessibility Data | LGA-specific enriching | Aust cities (variable) | Enriching |
| WalkSpot (2017) | LGA-specific enriching | Metro Melbourne | Enriching (dated) |

**Essential dependency**: Footpath asset data (location, width) is essential. Crossing data (all types) is a gap for Casey—may need council request or OSM.

### Theme 3: Urban Heat and Shade

| Dataset | Layer | Coverage | Priority |
|---------|-------|----------|----------|
| Vicmap Vegetation Tree Urban | Base | Metro Melbourne | **Key dataset** |
| Metro Melbourne Urban Heat 2018 | Base | Greater Melbourne | **Key dataset** |
| Heat Vulnerability Index 2018 | Base | Greater Melbourne | Weighting |
| Casey Parks and Reserves | LGA-specific enriching | Casey | Proxy |
| BoM Temperature | Base | Australia (stations) | Context |
| MODIS LST | Base | Global | Validation |

**Essential dependency**: Tree canopy/vegetation data is essential for shade. Heat data from 2018 is available but dated; no council-specific heat data identified.

### Theme 4: Safety Perceptions

| Dataset | Layer | Coverage | Priority |
|---------|-------|----------|----------|
| YourGround (2021) | LGA-specific enriching | Victoria | Primary |
| WalkSpot (2017) | LGA-specific enriching | Metro Melbourne | Secondary (dated) |
| BikeSpot | LGA-specific enriching | Metro Melbourne | Optional (cycling-focused) |

**Note**: All perception datasets are enriching, not essential. The index can run without them but loses the participatory/community voice.

### Theme 5: Crash / Incident Data

| Dataset | Layer | Coverage | Priority |
|---------|-------|----------|----------|
| Victoria Road Crash Data | Base | Victoria | **Key dataset** |
| TAC Road Trauma Statistics | Base | Victoria | Supplementary |
| Victorian Serious Road Casualties | Base | Victoria | Supplementary |

**Essential dependency**: None—crash data is base-layer and available statewide.

### Theme 6: Other / Contextual

| Dataset | Layer | Coverage | Priority |
|---------|-------|----------|----------|
| OSM Street Network | Base | Global | **Essential for routing** |
| SEIFA 2021 | Base | Australia | Weighting |
| ABS Census | Base | Australia | Context |
| Pedestrian Count (Hourly) | LGA-specific enriching | Casey (select) | Usage patterns |

---

## 4. Essential Data Checklist (for LGA Onboarding)

When onboarding a new LGA to YourWalk, request the following **essential** data:

### Must Request from Council

| Data | Theme | Format | Notes |
|------|-------|--------|-------|
| **Lighting assets** (location, type, wattage if available) | Lighting | GeoJSON/SHP/CSV | Location and type are minimum. Wattage/lumen output valuable if available. |
| **Footpath assets** (location, width, surface, condition) | Accessibility | GeoJSON/SHP/CSV | Width is important for accessibility scoring. Condition if available. |
| **Pedestrian crossings** (all types: signalised, zebra, refuge, school) | Accessibility | GeoJSON/SHP/CSV | May not be on open data; request specifically. Include crossing type and signals. |

### Confirm Base Data Coverage

| Data | Source | Check |
|------|--------|-------|
| Vicmap Vegetation Tree Urban | DataVic | Confirm LGA is within metro Melbourne coverage |
| Metro Melbourne Urban Heat 2018 | DataVic | Confirm LGA is within Greater Melbourne boundary |
| Victoria Road Crash Data | Transport Victoria | Filter to LGA and verify pedestrian crash records exist |
| OSM Street Network | OpenStreetMap | Verify footway/path coverage in LGA |

### Optional Enriching Data (Nice to Have)

| Data | Theme | Notes |
|------|-------|-------|
| Tree inventory (if more detailed than Vicmap) | Heat/Shade | Some councils maintain their own tree registers |
| Community perception data | Safety | YourGround, WalkSpot, local surveys |
| Pedestrian counts | Context | Sensor or survey data |
| Local accessibility audits | Accessibility | MOVE, Project Sidewalk-style, council audits |

---

## 5. Gaps and Recommendations

### Data Gaps Identified

| Gap | Theme | Impact | Mitigation |
|-----|-------|--------|------------|
| **General pedestrian crossings (Casey)** | Accessibility | Cannot score crossing accessibility beyond school crossings | Request from Casey Council; supplement with OSM |
| **Urban heat data vintage (2018)** | Heat/Shade | Data is 6+ years old; urban development may have changed | Use tree canopy (2019/2020) as more current proxy; investigate Google EIE |
| **WalkSpot vintage (2017)** | Perceptions | Perception data is 8+ years old | Rely on YourGround (2021) as primary; consider new community data collection |
| **Footpath condition data** | Accessibility | Casey footpath data includes width but condition unclear | Verify with Council; may need community audits |
| **LUX measurements** | Lighting | No systematic LUX data identified | Could be community-contributed; lower priority than asset locations |

### Recommendations

1. **Prioritise Casey lighting + footpath asset data** – These are available on Casey Open Data and are essential. Ingest first.

2. **Request crossing data from Casey Council** – School crossings are available but a complete crossing dataset is needed for accessibility scoring. Send a specific data request.

3. **Adopt Vicmap Vegetation Tree Urban as base canopy layer** – This is the best available tree data covering Casey at individual tree resolution.

4. **Use 2018 Urban Heat data with caveats** – It's the most complete heat dataset for Greater Melbourne. Display with vintage disclaimer; note that vegetation data (2019/2020) is more current.

5. **Confirm YourGround data access with XYX Lab** – This is the most relevant and recent perception dataset. Clarify licensing and data sharing.

6. **Integrate VicRoads crash data filtered to pedestrians** – Straightforward base data. Filter on road user type = pedestrian.

7. **Investigate Google Environmental Insights Explorer** – Check if Casey/Melbourne is covered for tree canopy and heat data; could provide more recent data than state sources.

8. **Plan for community data collection** – Perception and accessibility audits can be collected during pilot. Design contribution flows to fill gaps.

---

## 6. References

### Casey Open Data

| Resource | URL |
|----------|-----|
| Home / Portal | https://data.casey.vic.gov.au/pages/home/ |
| All datasets | https://data.casey.vic.gov.au/explore/ |
| Casey Maintained Lights | https://data.casey.vic.gov.au/explore/dataset/casey-maintained-lights |
| Footpaths | https://data.casey.vic.gov.au/explore/dataset/footpaths |
| Footpaths (T1EAM) | https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/ |
| School Crossings | https://data.casey.vic.gov.au/explore/dataset/school-crossings |
| Parks and Reserves | https://data.casey.vic.gov.au/explore/dataset/parks-and-reserves1 |
| Pedestrian Count (Hourly) | https://data.casey.vic.gov.au/explore/dataset/pedestrian |
| IoT Sensors | https://data.casey.vic.gov.au/explore/dataset/iot-sensors-insights |
| SEIFA 2021 | https://data.casey.vic.gov.au/explore/dataset/seifa21_coc_sa2_relativesocioeconomic_index |
| WFS Service | https://data.casey.vic.gov.au/api/wfs?service=wfs&request=getcapabilities |

### Victorian Government Data (DataVic)

| Resource | URL |
|----------|-----|
| DataVic Portal | https://discover.data.vic.gov.au/ |
| Vicmap Vegetation Tree Urban (Points) | https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-point |
| Vicmap Vegetation Tree Density (Polygons) | https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon |
| Vicmap Vegetation REST API | https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-rest-api |
| Vicmap Vegetation Product Info | https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-vegetation |
| Metro Melbourne Urban Heat 2018 | https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018 |
| Cooling & Greening Interactive Map | https://mapshare.vic.gov.au/coolinggreening/ |
| Cooling & Greening Info (Planning Vic) | https://www.planning.vic.gov.au/guides-and-resources/data-and-insights/melbournes-vegetation-heat-and-land-use-data |
| Vicmap Elevation REST API | https://discover.data.vic.gov.au/dataset/vicmap-elevation-rest-api |
| Vicmap Elevation 1m DEM Info | https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-elevation/1m-dem |

### Transport Victoria / VicRoads

| Resource | URL |
|----------|-----|
| Transport Victoria Open Data | https://opendata.transport.vic.gov.au/ |
| Victoria Road Crash Data | https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data |
| Road Crash Statistics Dashboard | https://vic.gov.au/road-crash-statistics |

### TAC (Transport Accident Commission)

| Resource | URL |
|----------|-----|
| TAC Road Trauma Statistics (DataVic) | https://discover.data.vic.gov.au/dataset/victorian-road-toll-tac |
| Victorian Serious Road Casualties (DataVic) | https://discover.data.vic.gov.au/dataset/victorian-serious-road-casualties-tac |
| TAC Online Crash Database Search | https://www.tac.vic.gov.au/road-safety/statistics/online-crash-database |

### Perception / Participatory Data (Monash XYX Lab / Partners)

| Resource | URL | Notes |
|----------|-----|-------|
| YourGround VIC | https://www.yourground.org/yourground-vic | Main project site (XYX Lab) |
| YourGround Research Publication | https://research.monash.edu/en/publications/yourground-mapping-a-safer-victoria-for-women-and-gender-diverse- | Academic publication |
| YourGround Project Page (Monash) | https://research.monash.edu/en/projects/your-ground/ | Research project details |
| XYX Lab | https://www.monash.edu/mada/research/xyx-lab | Monash XYX Lab homepage |
| WalkSpot | https://www.walkspot.org.au/ | Project site (2017) |
| WalkSpot (Victoria Walks) | https://www.victoriawalks.org.au/WalkSpot/ | Victoria Walks summary |
| BikeSpot | https://bikespot.org/ | Victoria Walks cycling project |
| MOVE Accessibility | https://movethemap.com.au/ | Australian accessibility mapping |

### OpenStreetMap

| Resource | URL |
|----------|-----|
| OpenStreetMap | https://www.openstreetmap.org/ |
| Geofabrik Australia Downloads | https://download.geofabrik.de/australia-oceania/australia.html |
| Overpass Turbo (query tool) | https://overpass-turbo.eu/ |
| Australian Tagging Guidelines (Paths) | https://wiki.openstreetmap.org/wiki/Australian_Tagging_Guidelines/Cycling_and_Foot_Paths |
| Lighting Tags Wiki | https://wiki.openstreetmap.org/wiki/Key:lit |

### ABS (Australian Bureau of Statistics)

| Resource | URL |
|----------|-----|
| SEIFA 2021 | https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021 |
| Census 2021 Data | https://www.abs.gov.au/census/find-census-data |
| TableBuilder | https://www.abs.gov.au/statistics/microdata-tablebuilder/tablebuilder |

### Other Data Sources

| Resource | URL |
|----------|-----|
| Google Environmental Insights Explorer | https://insights.sustainability.google/ |
| Google Tree Canopy Lab | https://sustainability.google/operating-sustainably/stories/tree-canopy-lab/ |
| NASA Earthdata | https://earthdata.nasa.gov/ |
| MODIS Land Surface Temperature | https://modis.gsfc.nasa.gov/data/dataprod/mod11.php |
| VIIRS Night-Time Lights | https://www.ncei.noaa.gov/maps/VIIRS_DNB_nighttime_imagery/ |
| Earth Observation Group (Payne Institute) | https://payne.mines.edu/eog/ |
| Bureau of Meteorology Data Services | https://www.bom.gov.au/resources/data-services |
| BoM Victorian Observations | https://www.bom.gov.au/vic/observations/ |

### Project Documentation

| Document | Description |
|----------|-------------|
| `docs/DATA_SOURCES.md` | Current data sources documentation |
| `docs/PRD.md` | Product requirements document |
| `docs/CONTEXT.md` | Project context and three streams |
| `docs/DATA_INVESTIGATION_PROMPT.md` | Prompt used to generate this register |

---

## Open Questions

1. **Does Casey have a general pedestrian crossing dataset?** (Not just school crossings) – Request from Council if not on open data.
2. **Does Google EIE cover Casey/Melbourne?** – Check platform for local availability.
3. **What is footpath condition status in Casey data?** – Verify if condition/surface attributes are available or just width.
4. **Are there more recent urban heat datasets?** – The 2018 data is aging; investigate updates or alternatives.

---

*Document created: February 2026*
*Based on investigation of publicly available data sources for YourWalk pilot (City of Casey).*
