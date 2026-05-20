# YourWalk Data Set Register

This document catalogues datasets that could feed into the YourWalk vulnerability index, which now computes separate Day and Night scores. The Day Index combines footpath accessibility with heat/shade. The Night Index combines footpath accessibility with lighting / after-dark safety. Each dataset is classified by theme and layer (base, LGA-specific essential, LGA-specific enriching).

---

## 1. Summary

### Layering Model


| Layer                      | Definition                                                                                                                                                 | Key Insight                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Base**                   | Data available at state, national, or global scale. Can underpin the index in any LGA without council-specific supply.                                     | Enables replicability across LGAs.               |
| **LGA-specific essential** | Data sourced per-LGA but essential to compute the index for a given theme. Most councils have this data; it should be requested when onboarding a new LGA. | Without this, a theme cannot be reliably scored. |
| **LGA-specific enriching** | Data sourced per-LGA that enriches the index but is not essential. If missing, the index can still run using base + essential data.                        | Optional depth; can be layered on later.         |


### Themes

1. **Lighting and night-time safety** – Street lighting assets, illumination type/wattage, night-time visibility, after-dark proxies, perceived safety after dark.
2. **Footpath and crossing accessibility** – Footpath location, condition, width, surface, obstacles, gradients; crossing location, type, signals, tactile indicators.
3. **Urban heat and shade** – Land surface temperature, air temperature, tree canopy, shade, exposure, thermal comfort.
4. **Safety perceptions** – Participatory or survey data on perceived safety, comfort, or fear.
5. **Crash / incident data** – Pedestrian-involved crashes or incidents.
6. **Other / contextual** – Demographics, land use, points of interest, elevation, cellular coverage, or other data that supports the index or routing.

### Key Findings

- **Casey pilot is well-supported**: Casey Open Data provides essential footpaths, streetlights, park/reserve lights, school crossings, parks, drinking fountains, benches/seats, and council tree inventory data.
- **Footpath source is strong but incomplete for full accessibility**: Footpaths (T1EAM) includes geometry, surface, width, length, ownership, function/use, and modified date, but not kerb ramps or general crossings. Gradient can likely be derived from Vicmap Elevation REST / DEM after method QA.
- **Tree canopy data exists at state level**: Vicmap Vegetation Tree Urban REST API and Tree Density cover metropolitan Melbourne (including Casey). The REST layer exposes canopy radius, canopy dimensions, height, and dense canopy fields. Casey Council Trees is useful local inventory data, but its canopy width fields are not reliable enough to replace canopy-cover data.
- **Urban heat data available but dated**: The "Cooling and Greening Melbourne" dataset provides 2018 land surface temperature and heat vulnerability index at mesh block level for Greater Melbourne.
- **Day/night scoring changes the role of streams**: Accessibility is the shared foundation. Heat/shade is a Day Index input; lighting / after-dark safety is a Night Index input.
- **Crash and speed data are comprehensive**: VicRoads/Transport Victoria provides detailed crash data with pedestrian/night filtering capability back to 2012, and Speed Zones provides current road speed segment data.
- **Graffiti and cellular mapping are promising but not yet core**: Casey Graffiti Locations is granular and current enough to investigate as an after-dark maintenance/safety proxy. Cellular Mapping Data is recent but methodologically unclear and should start as context/confidence overlay only.
- **Perception data exists**: YourGround (2021) and WalkSpot (2017) provide participatory safety data, though WalkSpot is now dated.
- **General crossing data gap**: Casey provides school crossings but a comprehensive pedestrian crossing dataset (signalised, zebra, refuge) was not found on the open data portal. This may need to be requested from Council or derived from OpenStreetMap.

### Prompt A Methodology-Lock Status

This register lists candidate datasets, but listing a dataset here does not mean it has been confirmed for scoring. For the methodology-lock gate, each scoring input must be assessed against four criteria: access, format, vintage, and required attributes.

Current status: several candidate datasets have now been assessed at metadata and field level, but the methodology is still not locked. Public availability and apparent coverage are not enough on their own; scoring thresholds, QA rules, and Nikki sign-off are still required before `docs/VULNERABILITY_INDEX.md` can move to v1.0.


| Scoring input                     | Dataset                                                                             | Register status                 | Prompt A confirmation status                                      | Access assessed? | Format assessed? | Vintage assessed? | Required attributes assessed? |
| --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- | ---------------- | ---------------- | ----------------- | ----------------------------- |
| Path surface type                 | Footpaths (T1EAM)                                                                   | Listed                          | Confirmed candidate attribute                                     | Y                | Y                | Y                 | Y                             |
| Path width                        | Footpaths (T1EAM)                                                                   | Listed                          | Confirmed candidate attribute; QA needed for outliers             | Y                | Y                | Y                 | Y                             |
| Kerb ramp presence                | Casey footpath network or separate Council asset layer                              | Missing / uncertain             | Unconfirmed                                                       | N                | N                | N                 | N                             |
| Path continuity / gaps            | Footpaths (T1EAM) + OpenStreetMap Footways/Crossings                                | Listed                          | Conditional; network review still required                        | Y                | Y                | Y                 | Partial                       |
| Gradient / steepness              | Vicmap Elevation REST API / Vicmap Elevation 1m DEM or Casey slope data             | Listed / scoring method pending | Candidate source identified                                       | Y                | Y                | Y                 | Partial                       |
| Tree canopy cover                 | Vicmap Vegetation Tree Urban REST API / Tree Density; Casey Council Trees as local inventory | Listed                          | Strong candidate source identified; Casey canopy width fields are not reliable | Y                | Y                | Y                 | Y                             |
| Land surface temperature          | Metropolitan Melbourne Urban Heat Islands and Vegetation 2018                       | Listed                          | Conditional; vintage decision required                            | Y                | Y                | Y                 | Y                             |
| Sealed surface area               | Vicmap parcels / aerial-derived impervious surface                                  | Missing                         | Unconfirmed                                                       | N                | N                | N                 | N                             |
| Drinking fountain locations       | Drinking Fountains (T1EAM)                                                          | Listed                          | Confirmed candidate dataset                                       | Y                | Y                | Partial           | Y                             |
| Seating / rest point locations    | Benches and Seats (T1EAM)                                                           | Listed                          | Confirmed candidate dataset; capacity fields unreliable           | Y                | Y                | Partial           | Partial                       |
| Street lighting asset locations   | AusNet Services and United Energy Street Lights; Casey Asset Lights (parks/reserves) | Listed                          | Confirmed candidate datasets                                      | Y                | Y                | Y                 | Y                             |
| Lighting coverage gaps            | Derived from streetlights + segment network                                         | Derived                         | Conditional; depends on buffer/spacing rule                       | Y                | Y                | Y                 | Partial                       |
| Pedestrian crash history at night | Victoria Road Crash Data                                                            | Listed                          | Confirmed candidate dataset                                       | Y                | Y                | Y                 | Y                             |
| Road speed exposure               | Speed Zones                                                                         | Listed                          | Candidate input pending scope decision                            | Y                | Y                | Y                 | Y                             |
| Graffiti maintenance / safety proxy | Casey Graffiti Locations                                                           | Listed                          | Candidate Night Index proxy; research evidence required           | Y                | Y                | Y                 | Partial                       |
| Cellular signal context           | Cellular Mapping Data                                                               | Listed                          | Context / confidence overlay only until methodology is reviewed   | Y                | Y                | Y                 | Partial                       |
| School crossing locations (supplementary) | School Crossing Locations / School Crossings (T1EAM)                       | Listed                          | Enrichment only; reconcile overlapping portal layers; does not replace general crossing gap | Y | Y | Y | Partial |
| Public toilet facility locations  | Public Toilet Blocks (T1EAM)                                                        | Listed                          | Deferred from core index pending Nikki (question 7); QA accessibility flags | Y                | Y                | Y                 | Partial                       |
| Dog waste bag dispenser locations | Dog Dispenser Bags (T1EAM)                                                          | Listed                          | Workshop/resident POI overlay; not proposed for core vulnerability scoring | Y                | Y                | Y                 | N                             |
| Antisocial behaviour reports      | Casey / Victoria Police TBC                                                         | Missing                         | Likely excluded                                                   | N                | N                | N                 | N                             |
| Perceived safety after dark       | YourGround / WalkSpot                                                               | Listed                          | Separate layer / future extension unless Nikki confirms otherwise | N                | N                | N                 | N                             |


Datasets currently requiring a Casey Council request or explicit exclusion decision:

1. Kerb ramp presence and tactile indicators, if held by Council.
2. General pedestrian crossing locations beyond school crossings.
3. Gradient / steepness data, if held by Council.
4. Footpath condition, if separate from the portal footpath geometry and material fields.
5. Confirmation of whether the portal streetlight datasets are sufficient for pedestrian lighting coverage, noting no lux measurements were found.
6. Confirmation of whether seating quantity/capacity fields are reliable enough for scoring.

---

## 2. Data Set Register

### 2.1 Lighting and Night-Time Safety


| Dataset                         | Source                     | Link                                                                                                                                | Layer                  | Geographic Scope       | Vintage / Update                  | Access / License                               | Pedestrian Relevance                                                        | Notes                                                                                  |
| ------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------- | --------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **AusNet Services and United Energy Street Lights** | City of Casey Open Data / electricity distributors | [View dataset](https://data.casey.vic.gov.au/explore/dataset/ausnet_unitedenergy_mvp4_streetlights) | LGA-specific essential | City of Casey | Extracted 2024-06-07 | Open Data (CC-BY-4.0) | High – provides streetlight locations, globe type, wattage rating, provider, light ID, suburb, ward, and address | Primary street lighting dataset identified during Prompt A review. 42,258 records. No lux measurements found. |
| **Casey Asset Lights (Parks / Reserves)** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/parkreserve_light_pt_t1eam) | LGA-specific enriching | City of Casey | Current asset layer | Open Data (CC-BY-4.0) | Medium – provides park/reserve light locations, luminaire type, wattage, pole height, lamp count, and location type | Useful for off-road paths, parks, and reserves. Should not be treated as complete road/street lighting coverage. |
| **Graffiti Locations** | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/graffiti-locations) | LGA-specific enriching | City of Casey | 2016–2026 records; latest reviewed April 2026 | Open Data (CC-BY-4.0) | Medium – possible after-dark maintenance / perceived-safety proxy | 34,879 records. Fields include location, created/completed dates, removal time, area removed, suburb, ward, month/day, and graffiti type (`Offensive` / `Non-Offensive`). Candidate Night Index proxy only after evidence review; avoid treating as direct crime data. |
| **OpenStreetMap Lighting Tags** | OpenStreetMap              | [Overpass query](https://overpass-turbo.eu/) / [Wiki](https://wiki.openstreetmap.org/wiki/Key:lit)                                  | Base                   | Global                 | Continuous (community-maintained) | ODbL                                           | Medium – lit=yes/no tags on streets and paths                               | Coverage varies; useful fallback where council data unavailable. Quality inconsistent. |
| **YourGround**                  | Monash XYX Lab / CrowdSpot | [YourGround VIC](https://www.yourground.org/yourground-vic) / [Research page](https://research.monash.edu/en/projects/your-ground/) | LGA-specific enriching | Victoria-wide          | 2021 (April–July)                 | Research data; access TBC with XYX Lab         | High – perceived safety after dark is core to dataset                       | ~6,000 submissions across Victoria. Focus on women and gender-diverse people.          |
| **WalkSpot**                    | Victoria Walks / CrowdSpot | [WalkSpot site](https://www.walkspot.org.au/) / [Victoria Walks page](https://www.victoriawalks.org.au/WalkSpot/)                   | LGA-specific enriching | Metropolitan Melbourne | 2017 (March–April)                | Research data; VicRoads/councils received data | High – includes "poor street lighting" as category                          | ~2,350 safe/unsafe spots. Now 8+ years old; limited currency.                          |


### 2.2 Footpath and Crossing Accessibility


| Dataset                              | Source                     | Link                                                                                                                                                                                                                                     | Layer                  | Geographic Scope                                | Vintage / Update           | Access / License                                         | Pedestrian Relevance                                                        | Notes                                                                                   |
| ------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------- | -------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Footpaths in City of Casey**       | City of Casey Open Data    | [View dataset](https://data.casey.vic.gov.au/explore/dataset/footpaths)                                                                                                                                                                  | LGA-specific essential | City of Casey                                   | Current; last updated 2025 | Open Data (CC-BY-4.0)                                    | High – location and width of footpaths                                      | Essential for Accessibility theme. Extracted from Asset Management System.              |
| **Footpaths (T1EAM)**                | City of Casey Open Data    | [View dataset](https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/)                                                                                                                                                       | LGA-specific essential | City of Casey                                   | Current; records include GIS modified date | Open Data (CC-BY-4.0)                                    | High – segment geometry, feature type, surface material, width, length, ownership, function/use, and location fields | Best candidate segment source for ADR-008. Prompt A review found 27,458 records; surface and width are mostly populated. Missing gradient, kerb ramp, crossing, and explicit condition fields. Width outliers require QA. |
| **School Crossing Locations**        | City of Casey Open Data    | [View dataset](https://data.casey.vic.gov.au/explore/dataset/school-crossings)                                                                                                                                                           | LGA-specific enriching | City of Casey                                   | Current                    | Open Data (CC-BY-4.0)                                    | High – school crossing locations with supervision times, speed zones        | Useful for safe routes to school; does not cover all pedestrian crossings.              |
| **School Crossings (T1EAM)**         | City of Casey Open Data    | [View dataset](https://data.casey.vic.gov.au/explore/dataset/school_crossings_pt_t1eam)                                                                                                                                                  | LGA-specific enriching | City of Casey                                   | Current asset layer        | Open Data (CC-BY-4.0)                                    | High – point locations with school name, street, suburb, ward, postcode      | 142 records. Overlaps theme with school crossings dataset; compare attributes when ingesting. Still only school crossings, not general crossings. |
| **OpenStreetMap Footways/Crossings** | OpenStreetMap              | [Overpass query](https://overpass-turbo.eu/) / [AU Tagging Guide](https://wiki.openstreetmap.org/wiki/Australian_Tagging_Guidelines/Cycling_and_Foot_Paths)                                                                              | Base                   | Global                                          | Continuous                 | ODbL                                                     | High – footpath geometry, surface tags, crossing tags                       | Quality varies. Australian tagging guidelines exist. May have gaps in crossing data.    |
| **Vicmap Elevation REST API**        | DEECA / DataVic            | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-elevation-rest-api)                                                                                                                                                       | Base                   | Victoria, with metro 1-5m layers relevant to Casey | Current REST service metadata reviewed 2025 | CC-BY-4.0 | High – candidate source for deriving slope/gradient along footpath segments | Provides Metro Ground Surface Point 1-5m and Metro Contour 1-5m layers with `altitude`. Useful for gradient derivation, pending sampling method and QA. |
| **Vicmap Elevation 1m DEM**          | DEECA / DataVic            | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-elevation-1m-digital-elevation-model-dem-footprints) / [Product info](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-elevation/1m-dem) | Base                   | Victoria (60% coverage; 99% in populated areas) | 2009–present (LiDAR)       | Government users free; others via Data Service Providers | Medium – alternative slope/gradient source for accessibility | High accuracy (+/- 10cm vertical). May be cleaner for raster-based gradient derivation if accessible. |
| **MOVE Accessibility Data**          | MOVE                       | [MOVE website](https://movethemap.com.au/)                                                                                                                                                                                               | LGA-specific enriching | Australian cities                               | Ongoing crowdsourced       | Open contributions                                       | High – crowdsourced accessibility barriers (broken footpaths, ramps, steps) | Australian equivalent of Project Sidewalk. Coverage in Casey unknown.                   |
| **WalkSpot**                         | Victoria Walks / CrowdSpot | [WalkSpot site](https://www.walkspot.org.au/)                                                                                                                                                                                            | LGA-specific enriching | Metropolitan Melbourne                          | 2017                       | Research data                                            | High – includes footpath condition and crossing concerns                    | Same dataset as lighting; relevant to accessibility. Dated.                             |


### 2.3 Urban Heat and Shade


| Dataset                                                           | Source                  | Link                                                                                                                                                                                                       | Layer                  | Geographic Scope                              | Vintage / Update         | Access / License                            | Pedestrian Relevance                                                     | Notes                                                                       |
| ----------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------- | ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Metropolitan Melbourne Urban Heat Islands and Vegetation 2018** | DEECA / DataVic         | [DataVic page](https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018) / [Interactive map](https://mapshare.vic.gov.au/coolinggreening/)             | Base                   | Greater Melbourne (incl. Casey)               | 2018 satellite imagery   | CC-BY-4.0                                   | High – land surface temperature and vegetation at mesh block level       | Best available state-level heat data. 2018 vintage is a limitation.         |
| **Vicmap Vegetation Tree Urban REST API**                         | DEECA / DataVic         | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-rest-api)                                                                                                      | Base                   | Metropolitan Melbourne + regional urban areas | 2019/2020 aerial + LiDAR; REST metadata reviewed 2025 | CC-BY-4.0 | High – individual tree points with canopy and height attributes | Primary canopy/shade candidate. Fields include `canopy_x_m`, `canopy_y_m`, `canopy_radius_m`, `height_m`, `dense_canopy`, and source/height date fields. |
| **Vicmap Vegetation Tree Urban (Points)**                         | DEECA / DataVic         | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-point) / [Product info](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-vegetation) | Base                   | Metropolitan Melbourne + regional urban areas | 2019/2020 aerial + LiDAR | CC-BY-4.0                                   | High – downloadable individual tree locations with heights               | Downloadable equivalent/source product for the REST layer. Derived from ML on aerial imagery. |
| **Vicmap Vegetation Tree Density (Polygons)**                     | DEECA / DataVic         | [DataVic page](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon)                                                                                                            | Base                   | Metropolitan Melbourne + regional             | 2019/2020                | CC-BY-4.0                                   | High – canopy density polygons                                           | Alternative to point data; may be easier for coverage analysis.             |
| **Casey Council Trees (T1EAM)**                                    | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/council_trees_pt_t1eam)                                                                                                                        | LGA-specific enriching | City of Casey                                 | Current asset layer      | Open Data (CC-BY-4.0)                       | Medium – local tree inventory with tree height, age, type, health, and location | Useful as local tree inventory and tree maturity proxy. Not suitable as primary canopy-cover source because canopy width fields are overwhelmingly zero. |
| **Heat Vulnerability Index 2018**                                 | DEECA / DataVic         | [Planning Vic info](https://www.planning.vic.gov.au/guides-and-resources/data-and-insights/melbournes-vegetation-heat-and-land-use-data)                                                                   | Base                   | Greater Melbourne                             | 2018                     | CC-BY-4.0                                   | High – combines heat exposure, population sensitivity, adaptive capacity | Could inform weighting of heat theme by vulnerable populations.             |
| **MODIS Land Surface Temperature**                                | NASA Earthdata          | [Earthdata catalogue](https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod11a1-061) / [NASA LST info](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php)                                              | Base                   | Global                                        | Daily; ongoing           | Free                                        | Medium – 1km resolution; continental-scale                               | Too coarse for street-level but could supplement/validate.                  |
| **Casey Parks and Reserves**                                      | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/parks-and-reserves1)                                                                                                                          | LGA-specific enriching | City of Casey                                 | Current                  | Open Data (CC-BY-4.0)                       | Medium – park locations often correlate with shade/greenery              | Indirect indicator of shade availability.                                   |
| **Drinking Fountains (T1EAM)**                                    | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/drinkingfountains_pt_t1eam)                                                                                                                    | LGA-specific enriching | City of Casey                                 | Current asset layer      | Open Data (CC-BY-4.0)                       | Medium – heat resilience amenity and comfort support                     | 199 records. Includes location, fountain type, material, condition, facility type, ownership, ward, suburb, and address. Aisey preference is to include as index input pending Nikki confirmation. |
| **Benches and Seats (T1EAM)**                                     | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/benches_seats_pt_t1eam)                                                                                                                        | LGA-specific enriching | City of Casey                                 | Current asset layer      | Open Data (CC-BY-4.0)                       | Medium – age-friendly mobility and rest opportunity                     | 3,411 records. Includes location, facility type, material, dimensions, quantity, ownership, ward, suburb, and address. Quantity/capacity fields appear unreliable and should not be used without QA. |
| **Bureau of Meteorology Temperature**                             | BoM                     | [Data services](https://www.bom.gov.au/resources/data-services) / [Vic observations](https://www.bom.gov.au/vic/observations/)                                                                             | Base                   | Australia                                     | Real-time and historical | Free for historical; paid for real-time API | Medium – weather station temperature data                                | Limited spatial coverage within LGA; supports temporal context (hot days).  |
| **Google Environmental Insights Explorer**                        | Google                  | [EIE platform](https://insights.sustainability.google/) / [Tree Canopy Lab](https://sustainability.google/operating-sustainably/stories/tree-canopy-lab/)                                                  | Base                   | Cities (coverage varies)                      | Seasonal updates         | Free web access; no API confirmed           | High – tree canopy and heat vulnerability data                           | Coverage for Casey/Melbourne unknown. Worth investigating.                  |


### 2.4 Safety Perceptions


| Dataset        | Source                     | Link                                                                                                                                                                                                | Layer                  | Geographic Scope       | Vintage / Update | Access / License                       | Pedestrian Relevance                                                     | Notes                                                                         |
| -------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------- | ---------------- | -------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **YourGround** | Monash XYX Lab / CrowdSpot | [YourGround VIC](https://www.yourground.org/yourground-vic) / [Research publication](https://research.monash.edu/en/publications/yourground-mapping-a-safer-victoria-for-women-and-gender-diverse-) | LGA-specific enriching | Victoria-wide          | 2021             | Research data; access TBC with XYX Lab | High – perceived safety in outdoor spaces, focus on women/gender-diverse | ~6,000 submissions. Supported by 23 local governments.                        |
| **WalkSpot**   | Victoria Walks / CrowdSpot | [WalkSpot site](https://www.walkspot.org.au/) / [Victoria Walks page](https://www.victoriawalks.org.au/WalkSpot/)                                                                                   | LGA-specific enriching | Metropolitan Melbourne | 2017             | Research data; Victoria Walks project  | High – safe/unsafe walking spots with categories                         | Dated but provides baseline perception data.                                  |
| **BikeSpot**   | Victoria Walks / CrowdSpot | [BikeSpot site](https://bikespot.org/)                                                                                                                                                              | LGA-specific enriching | Metropolitan Melbourne | Various          | Research data                          | Low – cycling-focused but may include shared path data                   | Could inform shared path conditions; less relevant to pedestrian-only routes. |


### 2.5 Crash / Incident Data


| Dataset                               | Source                        | Link                                                                                                                                                                     | Layer | Geographic Scope | Vintage / Update                                 | Access / License | Pedestrian Relevance                                            | Notes                                                                                                  |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------------- | ------------------------------------------------ | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Victoria Road Crash Data**          | Transport Victoria / VicRoads | [Open Data portal](https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data) / [Dashboard](https://vic.gov.au/road-crash-statistics)                       | Base  | Victoria-wide    | 2012–present; monthly updates (7-month lag)      | CC-BY-4.0        | High – includes pedestrian crashes via "person" table filtering | Comprehensive dataset with location (lat/long), crash type, road user type. Essential for crash theme. |
| **Speed Zones**                      | Transport Victoria / DTP      | [DataVic page](https://discover.data.vic.gov.au/dataset/speed-zones)                                                                                                      | Base  | Victoria-wide    | Monthly; latest reviewed February 2026           | CC-BY-4.0        | Medium – road speed can affect comfort walking beside traffic   | Candidate road exposure / traffic stress modifier. Contains road segment geometry, speed limit, zone length, conditions, and direction. Needs scope decision before inclusion in index. |
| **TAC Road Trauma Statistics**        | TAC via DataVic               | [DataVic page](https://discover.data.vic.gov.au/dataset/victorian-road-toll-tac) / [TAC search](https://www.tac.vic.gov.au/road-safety/statistics/online-crash-database) | Base  | Victoria-wide    | 1987–present (fatalities); 2000–present (claims) | CC-BY-4.0        | High – fatalities and hospitalisations including pedestrians    | Complements VicRoads crash data with severity/injury detail.                                           |
| **Victorian Serious Road Casualties** | TAC via DataVic               | [DataVic page](https://discover.data.vic.gov.au/dataset/victorian-serious-road-casualties-tac)                                                                           | Base  | Victoria-wide    | Ongoing                                          | CC-BY-4.0        | High – hospital admissions within 7 days of crash               | Captures serious injuries not just fatalities.                                                         |


### 2.6 Other / Contextual


| Dataset                                 | Source                  | Link                                                                                                                                                                                                                                      | Layer                  | Geographic Scope             | Vintage / Update    | Access / License      | Pedestrian Relevance                                               | Notes                                                              |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------- | ------------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **SEIFA 2021 (Socio-Economic Indexes)** | ABS / City of Casey     | [ABS SEIFA](https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021) / [Casey SEIFA](https://data.casey.vic.gov.au/explore/dataset/seifa21_coc_sa2_relativesocioeconomic_index) | Base                   | Australia (available at SA2) | 2021 Census         | Open                  | Medium – could weight vulnerability by socio-economic disadvantage | Available on Casey Open Data at SA2 level.                         |
| **ABS Census Demographics**             | ABS                     | [Census 2021](https://www.abs.gov.au/census/find-census-data) / [TableBuilder](https://www.abs.gov.au/statistics/microdata-tablebuilder/tablebuilder)                                                                                     | Base                   | Australia                    | 2021 (next 2026)    | Open                  | Medium – age, disability, population density for weighting         | Supports identification of vulnerable populations.                 |
| **Pedestrian Count (Hourly)**           | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/pedestrian) / [IoT Sensors](https://data.casey.vic.gov.au/explore/dataset/iot-sensors-insights)                                                                              | LGA-specific enriching | Casey (select locations)     | August 2021–present | Open Data (CC-BY-4.0) | High – pedestrian volumes at sensor locations                      | Useful for understanding usage patterns; limited spatial coverage. |
| **Cellular Mapping Data**               | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/cellular-mapping-data)                                                                                                                                                       | LGA-specific enriching | City of Casey (sampled points) | September–October 2025 | Open Data (CC-BY-4.0) | Low–medium – possible reassurance / emergency communication context | 3,882 records. Fields include date/time, network, signal strength/quality, RSRP, RSRQ, band, and point location. Most records have poor simplified signal strength but good/fair signal quality. Methodology and representativeness require review before any scoring use. |
| **Public Toilet Blocks (T1EAM)**       | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/public_toilet_block_pt_t1eam)                                                                                                                                               | LGA-specific enriching | City of Casey                  | Current asset layer | Open Data (CC-BY-4.0) | Medium – amenity coverage for inclusion / accessibility workshops | ~67 records. Fields include suburb, ward, accessibility notes and toilet facility availability flags; validate semantics before scoring. **Recommend treating as dashboard/workshop context or future overlay**, not core v1.0 index unless Nikki scopes amenity breadth explicitly. |
| **Dog Dispenser Bags (T1EAM)**         | City of Casey Open Data | [View dataset](https://data.casey.vic.gov.au/explore/dataset/dog-dispenser-bags-pt-t1eam)                                                                                                                                                  | LGA-specific enriching | City of Casey                  | Current asset layer | Open Data (CC-BY-4.0) | Low–medium – supports dog walking route comfort                  | ~164 records. Useful for dog-walking workshops and resident-facing POI overlays; **not** proposed as a core vulnerability stream input unless product scope expands beyond walking-as-transport. |
| **OpenStreetMap Street Network**        | OpenStreetMap           | [OpenStreetMap](https://www.openstreetmap.org/) / [Geofabrik downloads](https://download.geofabrik.de/australia-oceania/australia.html)                                                                                                   | Base                   | Global                       | Continuous          | ODbL                  | High – base routing network                                        | Essential for routing engine.                                      |
| **OpenStreetMap POIs**                  | OpenStreetMap           | [Overpass Turbo](https://overpass-turbo.eu/) / [TagInfo](https://taginfo.openstreetmap.org/)                                                                                                                                              | Base                   | Global                       | Continuous          | ODbL                  | Medium – destinations (schools, shops, transit)                    | Supports origin/destination context.                               |


### 2.7 Methodology-Lock Register Gaps

These inputs are referenced by the current Vulnerability Index methodology draft but do not yet have a confirmed dataset entry. They must be resolved before `docs/VULNERABILITY_INDEX.md` can move to v1.0.


| Needed input                     | Candidate source                                                            | Theme                               | Status                   | Gap plan                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kerb ramp presence               | Casey footpath, road asset, crossing, or accessibility audit data           | Footpath and crossing accessibility | Missing / uncertain      | Ask Casey whether kerb ramps are held as an attribute or separate asset layer. If unavailable, Nikki/Aisey must decide whether to exclude from pilot scoring. |
| General pedestrian crossings     | Casey transport / road asset data; OpenStreetMap fallback                   | Footpath and crossing accessibility | Missing                  | Request all pedestrian crossing types from Casey. Use OSM only if quality and licensing are acceptable.                                                       |
| Sealed / impervious surface area | Vicmap, aerial-derived surface classification, or other state/Monash source | Urban heat and shade                | Missing                  | Identify a defensible source or exclude from pilot scoring.                                                                                                   |
| Drinking fountain scoring role   | Drinking Fountains (T1EAM)                                                  | Urban heat and shade                | Dataset found; scoring role pending | Aisey preference is to include fountains as index inputs; Nikki to confirm methodology fit.                                                        |
| Seating / rest point scoring role | Benches and Seats (T1EAM)                                                   | Urban heat and shade                | Dataset found; scoring role pending | Aisey preference is to include seating as an index input; Nikki to confirm methodology fit. Capacity and quantity fields require QA before scoring. |
| Road speed exposure              | Speed Zones                                                                 | Lighting and night-time safety / accessibility | Dataset found; scope pending | Decide whether road speed belongs in the index as a traffic stress modifier or remains a separate contextual layer.                              |
| Antisocial behaviour reports     | Casey / Victoria Police, if available and shareable                         | Lighting and night-time safety      | Missing; likely excluded | Recommend exclusion from the index unless Nikki/Aisey explicitly decide otherwise due to privacy, access, and interpretation risk.                            |


---

## 3. Themes Map

### Theme 1: Lighting and Night-Time Safety


| Dataset                     | Layer                  | Coverage          | Priority          |
| --------------------------- | ---------------------- | ----------------- | ----------------- |
| AusNet Services and United Energy Street Lights | LGA-specific essential | Casey | **Must have** |
| Casey Asset Lights (parks / reserves) | LGA-specific enriching | Casey | Enriching |
| OpenStreetMap Lighting Tags | Base                   | Global (variable) | Fallback          |
| Speed Zones | Base | Victoria | Candidate traffic stress modifier |
| Graffiti Locations | LGA-specific enriching | Casey | Candidate after-dark proxy, research pending |
| YourGround                  | LGA-specific enriching | Victoria          | Enriching         |
| WalkSpot (2017)             | LGA-specific enriching | Metro Melbourne   | Enriching (dated) |
| VIIRS Night-Time Lights     | Base                   | Global            | Optional (coarse) |


**Essential dependency**: Lighting theme requires streetlight asset data. Casey has a strong candidate streetlight layer with globe type and wattage, but no lux measurements were found. Graffiti is not a direct safety measure; it is only a candidate maintenance/perceived-safety proxy for the Night Index after research review.

### Theme 2: Footpath and Crossing Accessibility


| Dataset                          | Layer                  | Coverage                 | Priority          |
| -------------------------------- | ---------------------- | ------------------------ | ----------------- |
| Footpaths in City of Casey       | LGA-specific essential | Casey                    | **Must have**     |
| Footpaths (T1EAM)                | LGA-specific essential | Casey                    | **Preferred segment source** |
| OpenStreetMap Footways/Crossings | Base                   | Global (variable)        | Base network      |
| Vicmap Elevation REST API        | Base                   | Victoria / metro 1-5m | **Gradient/slope candidate** |
| Vicmap Elevation 1m DEM          | Base                   | Victoria (99% populated) | Alternative gradient/slope source |
| School Crossing Locations        | LGA-specific enriching | Casey                    | Enriching         |
| School Crossings (T1EAM)        | LGA-specific enriching | Casey                    | Enriching (overlap with School Crossing Locations; reconcile attributes) |
| MOVE Accessibility Data          | LGA-specific enriching | Aust cities (variable)   | Enriching         |
| WalkSpot (2017)                  | LGA-specific enriching | Metro Melbourne          | Enriching (dated) |


**Essential dependency**: Footpath asset data is essential. Footpaths (T1EAM) is the preferred segment source because it includes geometry, surface material, width, length, function/use, ownership, and modified date. Gradient has a candidate source via Vicmap Elevation REST / DEM, but the derivation method still needs QA. Kerb ramps and general crossing data remain gaps.

### Theme 3: Urban Heat and Shade


| Dataset                         | Layer                  | Coverage             | Priority        |
| ------------------------------- | ---------------------- | -------------------- | --------------- |
| Vicmap Vegetation Tree Urban REST API | Base              | Metro Melbourne      | **Primary canopy candidate** |
| Vicmap Vegetation Tree Urban    | Base                   | Metro Melbourne      | Downloadable source product |
| Vicmap Vegetation Tree Density  | Base                   | Metro Melbourne      | **Key dataset** |
| Metro Melbourne Urban Heat 2018 | Base                   | Greater Melbourne    | **Key dataset** |
| Heat Vulnerability Index 2018   | Base                   | Greater Melbourne    | Weighting       |
| Casey Council Trees (T1EAM)     | LGA-specific enriching | Casey                | Local inventory / maturity proxy |
| Drinking Fountains (T1EAM)      | LGA-specific enriching | Casey                | Comfort amenity, pending Nikki |
| Benches and Seats (T1EAM)       | LGA-specific enriching | Casey                | Rest opportunity, pending Nikki |
| Casey Parks and Reserves        | LGA-specific enriching | Casey                | Proxy           |
| BoM Temperature                 | Base                   | Australia (stations) | Context         |
| MODIS LST                       | Base                   | Global               | Validation      |


**Essential dependency**: Tree canopy/vegetation data is essential for shade. Vicmap Vegetation Tree Urban REST API is the preferred canopy candidate because it exposes canopy radius, canopy dimensions, height, and dense canopy fields. Casey tree inventory is useful locally, but not enough for canopy cover because canopy-width fields appear unreliable. Heat data from 2018 is available but dated; Nikki needs to confirm whether this is defensible for the pilot.

### Theme 4: Safety Perceptions


| Dataset           | Layer                  | Coverage        | Priority                   |
| ----------------- | ---------------------- | --------------- | -------------------------- |
| YourGround (2021) | LGA-specific enriching | Victoria        | Primary                    |
| WalkSpot (2017)   | LGA-specific enriching | Metro Melbourne | Secondary (dated)          |
| BikeSpot          | LGA-specific enriching | Metro Melbourne | Optional (cycling-focused) |


**Note**: All perception datasets are enriching, not essential. The index can run without them but loses the participatory/community voice.

### Theme 5: Crash / Incident Data


| Dataset                           | Layer | Coverage | Priority        |
| --------------------------------- | ----- | -------- | --------------- |
| Victoria Road Crash Data          | Base  | Victoria | **Key dataset** |
| Speed Zones                       | Base  | Victoria | Candidate context / modifier |
| TAC Road Trauma Statistics        | Base  | Victoria | Supplementary   |
| Victorian Serious Road Casualties | Base  | Victoria | Supplementary   |


**Essential dependency**: None—crash data is base-layer and available statewide.

### Theme 6: Other / Contextual


| Dataset                   | Layer                  | Coverage       | Priority                  |
| ------------------------- | ---------------------- | -------------- | ------------------------- |
| OSM Street Network        | Base                   | Global         | **Essential for routing** |
| SEIFA 2021                | Base                   | Australia      | Weighting                 |
| ABS Census                | Base                   | Australia      | Context                   |
| Pedestrian Count (Hourly) | LGA-specific enriching | Casey (select) | Usage patterns            |
| Cellular Mapping Data     | LGA-specific enriching | Casey (sampled points) | Context / confidence overlay, methodology pending |
| Public Toilet Blocks (T1EAM) | LGA-specific enriching | Casey | Amenity overlay |
| Dog Dispenser Bags (T1EAM) | LGA-specific enriching | Casey | Dog-friendly route overlay |


---

## 4. Essential Data Checklist (for LGA Onboarding)

When onboarding a new LGA to YourWalk, request the following **essential** data:

### Must Request from Council


| Data                                                                    | Theme         | Format          | Notes                                                                             |
| ----------------------------------------------------------------------- | ------------- | --------------- | --------------------------------------------------------------------------------- |
| **Lighting assets** (location, type, wattage if available)              | Lighting      | GeoJSON/SHP/CSV | Location and type are minimum. Wattage/lumen output valuable if available.        |
| **Footpath assets** (location, width, surface, condition)               | Accessibility | GeoJSON/SHP/CSV | Width is important for accessibility scoring. Condition if available.             |
| **Pedestrian crossings** (all types: signalised, zebra, refuge, school) | Accessibility | GeoJSON/SHP/CSV | May not be on open data; request specifically. Include crossing type and signals. |


### Confirm Base Data Coverage


| Data                            | Source             | Check                                                   |
| ------------------------------- | ------------------ | ------------------------------------------------------- |
| Vicmap Vegetation Tree Urban REST API | DataVic      | Confirm Casey is within service coverage and query limits are workable |
| Vicmap Vegetation Tree Urban    | DataVic            | Confirm downloadable product coverage if REST service is not used |
| Metro Melbourne Urban Heat 2018 | DataVic            | Confirm LGA is within Greater Melbourne boundary        |
| Victoria Road Crash Data        | Transport Victoria | Filter to LGA and verify pedestrian crash records exist |
| OSM Street Network              | OpenStreetMap      | Verify footway/path coverage in LGA                     |


### Optional Enriching Data (Nice to Have)


| Data                                          | Theme         | Notes                                           |
| --------------------------------------------- | ------------- | ----------------------------------------------- |
| Tree inventory (if more detailed than Vicmap) | Heat/Shade    | Some councils maintain their own tree registers |
| Community perception data                     | Safety        | YourGround, WalkSpot, local surveys             |
| Pedestrian counts                             | Context       | Sensor or survey data                           |
| Local accessibility audits                    | Accessibility | MOVE, Project Sidewalk-style, council audits    |


---

## 5. Gaps and Recommendations

### Data Gaps Identified


| Gap                                      | Theme         | Impact                                                      | Mitigation                                                                   |
| ---------------------------------------- | ------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **General pedestrian crossings (Casey)** | Accessibility | Cannot score crossing accessibility beyond school crossings | Request from Casey Council; supplement with OSM                              |
| **Urban heat data vintage (2018)**       | Heat/Shade    | Data is 6+ years old; urban development may have changed    | Use tree canopy (2019/2020) as more current proxy; investigate Google EIE    |
| **Casey tree canopy width fields**       | Heat/Shade    | Council tree inventory does not reliably provide canopy coverage because canopy width fields are overwhelmingly zero | Use Vicmap Vegetation Tree Urban REST API / Tree Density as canopy source; use Casey trees for local maturity/context only |
| **WalkSpot vintage (2017)**              | Perceptions   | Perception data is 8+ years old                             | Rely on YourGround (2021) as primary; consider new community data collection |
| **Kerb ramps and general crossing attributes** | Accessibility | Casey footpath data supports surface and width but not these accessibility factors | Confirm whether separate Council layers exist; otherwise exclude or defer with rationale |
| **Gradient derivation method** | Accessibility | Vicmap Elevation REST / DEM can likely support slope, but scoring depends on sampling method and QA | Use Metro 1-5m elevation REST layers or DEM after method confirmation |
| **LUX measurements**                     | Lighting      | No systematic LUX data identified                           | Could be community-contributed; lower priority than asset locations          |
| **Road speed exposure scope**            | Lighting / Accessibility | Speed Zones dataset is available, but its role in the index is not yet agreed | Ask Nikki whether road speed should be an index input, modifier, or context layer |
| **Graffiti proxy evidence**              | Lighting / After Dark | Casey has granular graffiti data, but proxy meaning is not yet evidenced | University partner / RA to review graffiti and perceived safety literature before weighting |
| **Cellular mapping methodology**         | Context / After Dark | Dataset is recent and granular but collection method and representativeness are unclear | Anthony to review methodology; default to context/confidence overlay, not core v1 score |


### Recommendations

1. **Compute Day and Night scores separately** – Day should combine Accessibility and Heat/Shade. Night should combine Accessibility and Lighting/After Dark. Accessibility is the shared foundation.
2. **Use Footpaths (T1EAM) as the primary segment source** – It has strong geometry, surface, width, length, ownership, function/use, and modified-date coverage. Add QA for width outliers before scoring.
3. **Use AusNet / United Energy Street Lights as the primary lighting source** – It provides broad Casey streetlight coverage with globe type and wattage. Use Casey Asset Lights as an enriching layer for parks and reserves. Seek expert interpretation before ranking illumination type / wattage.
4. **Confirm crossing and kerb ramp sources** – These are the main remaining dataset gaps for Footpath Accessibility.
5. **Confirm gradient derivation method** – Vicmap Elevation REST API is a strong candidate using metro 1-5m ground points or contours with altitude, but sampling and scoring rules need QA.
6. **Adopt Vicmap Vegetation Tree Urban REST API / Tree Density as the primary canopy source** – Casey Council Trees is useful as a local tree inventory and maturity/species proxy, but not as a canopy-cover layer.
7. **Use 2018 Urban Heat data with caveats** – It's the most complete heat dataset for Greater Melbourne and belongs in the Day Index only.
8. **Include drinking fountains and seating as proposed Day Index comfort inputs if scoring remains explainable** – The datasets exist, but seating capacity/quantity fields need QA.
9. **Integrate Victoria Road Crash Data filtered to pedestrians and night-time conditions** – The consolidated dataset includes pedestrian flags, light condition, severity, coordinates, LGA, and speed zone.
10. **Consider Speed Zones as a shared traffic stress modifier** – Dataset is current and spatially suitable. It may sit inside the shared Accessibility layer rather than only the Night Index.
11. **Investigate Graffiti Locations as an after-dark proxy, not as crime data** – Use offensive/non-offensive classification and recent density only if research supports a careful safety/maintenance interpretation.
12. **Keep cellular mapping out of the core score for now** – Treat as route context or confidence overlay until collection methodology and representativeness are understood.
13. **Keep perception data separate for the initial pilot** – YourGround and WalkSpot remain valuable layers or future extensions, but are not part of the infrastructure/environment-only working position.
14. **Treat Public Toilet Blocks and Dog Dispenser Bags as contextual/community-workshop layers by default** – Both datasets exist on the Casey portal with usable metadata counts; public toilets may warrant a Council dashboard overlay after accessibility field QA. Dog bag dispensers align with dog-walking workshops and route preference overlays rather than core vulnerability scoring.

---

## 6. References

### Casey Open Data


| Resource                  | URL                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / Portal             | [https://data.casey.vic.gov.au/pages/home/](https://data.casey.vic.gov.au/pages/home/)                                                                                                 |
| All datasets              | [https://data.casey.vic.gov.au/explore/](https://data.casey.vic.gov.au/explore/)                                                                                                       |
| AusNet / United Energy Street Lights | [https://data.casey.vic.gov.au/explore/dataset/ausnet_unitedenergy_mvp4_streetlights](https://data.casey.vic.gov.au/explore/dataset/ausnet_unitedenergy_mvp4_streetlights) |
| Casey Asset Lights | [https://data.casey.vic.gov.au/explore/dataset/parkreserve_light_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/parkreserve_light_pt_t1eam) |
| Graffiti Locations | [https://data.casey.vic.gov.au/explore/dataset/graffiti-locations](https://data.casey.vic.gov.au/explore/dataset/graffiti-locations) |
| Footpaths                 | [https://data.casey.vic.gov.au/explore/dataset/footpaths](https://data.casey.vic.gov.au/explore/dataset/footpaths)                                                                     |
| Footpaths (T1EAM)         | [https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/](https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/)                                               |
| Council Trees (T1EAM) | [https://data.casey.vic.gov.au/explore/dataset/council_trees_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/council_trees_pt_t1eam) |
| Drinking Fountains (T1EAM) | [https://data.casey.vic.gov.au/explore/dataset/drinkingfountains_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/drinkingfountains_pt_t1eam) |
| Benches and Seats (T1EAM) | [https://data.casey.vic.gov.au/explore/dataset/benches_seats_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/benches_seats_pt_t1eam) |
| School Crossings          | [https://data.casey.vic.gov.au/explore/dataset/school-crossings](https://data.casey.vic.gov.au/explore/dataset/school-crossings)                                                       |
| School Crossings (T1EAM) | [https://data.casey.vic.gov.au/explore/dataset/school_crossings_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/school_crossings_pt_t1eam) |
| Public Toilet Blocks (T1EAM) | [https://data.casey.vic.gov.au/explore/dataset/public_toilet_block_pt_t1eam](https://data.casey.vic.gov.au/explore/dataset/public_toilet_block_pt_t1eam) |
| Dog Dispenser Bags (T1EAM) | [https://data.casey.vic.gov.au/explore/dataset/dog-dispenser-bags-pt-t1eam](https://data.casey.vic.gov.au/explore/dataset/dog-dispenser-bags-pt-t1eam) |
| Parks and Reserves        | [https://data.casey.vic.gov.au/explore/dataset/parks-and-reserves1](https://data.casey.vic.gov.au/explore/dataset/parks-and-reserves1)                                                 |
| Pedestrian Count (Hourly) | [https://data.casey.vic.gov.au/explore/dataset/pedestrian](https://data.casey.vic.gov.au/explore/dataset/pedestrian)                                                                   |
| Cellular Mapping Data | [https://data.casey.vic.gov.au/explore/dataset/cellular-mapping-data](https://data.casey.vic.gov.au/explore/dataset/cellular-mapping-data) |
| IoT Sensors               | [https://data.casey.vic.gov.au/explore/dataset/iot-sensors-insights](https://data.casey.vic.gov.au/explore/dataset/iot-sensors-insights)                                               |
| SEIFA 2021                | [https://data.casey.vic.gov.au/explore/dataset/seifa21_coc_sa2_relativesocioeconomic_index](https://data.casey.vic.gov.au/explore/dataset/seifa21_coc_sa2_relativesocioeconomic_index) |
| WFS Service               | [https://data.casey.vic.gov.au/api/wfs?service=wfs&request=getcapabilities](https://data.casey.vic.gov.au/api/wfs?service=wfs&request=getcapabilities)                                 |


### Victorian Government Data (DataVic)


| Resource                                  | URL                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DataVic Portal                            | [https://discover.data.vic.gov.au/](https://discover.data.vic.gov.au/)                                                                                                                                                                     |
| Vicmap Vegetation Tree Urban (Points)     | [https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-point](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-point)                                                                                 |
| Vicmap Vegetation Tree Urban REST API     | [https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-rest-api](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-rest-api)                                                                             |
| Vicmap Vegetation Tree Density (Polygons) | [https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon)                                                                         |
| Vicmap Vegetation REST API                | [https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-rest-api](https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-urban-rest-api)                                                                           |
| Vicmap Vegetation Product Info            | [https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-vegetation](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-vegetation)                                               |
| Metro Melbourne Urban Heat 2018           | [https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018](https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018)               |
| Cooling & Greening Interactive Map        | [https://mapshare.vic.gov.au/coolinggreening/](https://mapshare.vic.gov.au/coolinggreening/)                                                                                                                                               |
| Cooling & Greening Info (Planning Vic)    | [https://www.planning.vic.gov.au/guides-and-resources/data-and-insights/melbournes-vegetation-heat-and-land-use-data](https://www.planning.vic.gov.au/guides-and-resources/data-and-insights/melbournes-vegetation-heat-and-land-use-data) |
| Vicmap Elevation REST API                 | [https://discover.data.vic.gov.au/dataset/vicmap-elevation-rest-api](https://discover.data.vic.gov.au/dataset/vicmap-elevation-rest-api)                                                                                                   |
| Vicmap Elevation 1m DEM Info              | [https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-elevation/1m-dem](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-elevation/1m-dem)                                   |


### Transport Victoria / VicRoads


| Resource                        | URL                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport Victoria Open Data    | [https://opendata.transport.vic.gov.au/](https://opendata.transport.vic.gov.au/)                                                                 |
| Victoria Road Crash Data        | [https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data](https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data) |
| Speed Zones                     | [https://discover.data.vic.gov.au/dataset/speed-zones](https://discover.data.vic.gov.au/dataset/speed-zones)                                     |
| Road Crash Statistics Dashboard | [https://vic.gov.au/road-crash-statistics](https://vic.gov.au/road-crash-statistics)                                                             |


### TAC (Transport Accident Commission)


| Resource                                    | URL                                                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TAC Road Trauma Statistics (DataVic)        | [https://discover.data.vic.gov.au/dataset/victorian-road-toll-tac](https://discover.data.vic.gov.au/dataset/victorian-road-toll-tac)                             |
| Victorian Serious Road Casualties (DataVic) | [https://discover.data.vic.gov.au/dataset/victorian-serious-road-casualties-tac](https://discover.data.vic.gov.au/dataset/victorian-serious-road-casualties-tac) |
| TAC Online Crash Database Search            | [https://www.tac.vic.gov.au/road-safety/statistics/online-crash-database](https://www.tac.vic.gov.au/road-safety/statistics/online-crash-database)               |


### Perception / Participatory Data (Monash XYX Lab / Partners)


| Resource                         | URL                                                                                                                                                                                                                            | Notes                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| YourGround VIC                   | [https://www.yourground.org/yourground-vic](https://www.yourground.org/yourground-vic)                                                                                                                                         | Main project site (XYX Lab)      |
| YourGround Research Publication  | [https://research.monash.edu/en/publications/yourground-mapping-a-safer-victoria-for-women-and-gender-diverse-](https://research.monash.edu/en/publications/yourground-mapping-a-safer-victoria-for-women-and-gender-diverse-) | Academic publication             |
| YourGround Project Page (Monash) | [https://research.monash.edu/en/projects/your-ground/](https://research.monash.edu/en/projects/your-ground/)                                                                                                                   | Research project details         |
| XYX Lab                          | [https://www.monash.edu/mada/research/xyx-lab](https://www.monash.edu/mada/research/xyx-lab)                                                                                                                                   | Monash XYX Lab homepage          |
| WalkSpot                         | [https://www.walkspot.org.au/](https://www.walkspot.org.au/)                                                                                                                                                                   | Project site (2017)              |
| WalkSpot (Victoria Walks)        | [https://www.victoriawalks.org.au/WalkSpot/](https://www.victoriawalks.org.au/WalkSpot/)                                                                                                                                       | Victoria Walks summary           |
| BikeSpot                         | [https://bikespot.org/](https://bikespot.org/)                                                                                                                                                                                 | Victoria Walks cycling project   |
| MOVE Accessibility               | [https://movethemap.com.au/](https://movethemap.com.au/)                                                                                                                                                                       | Australian accessibility mapping |


### OpenStreetMap


| Resource                              | URL                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenStreetMap                         | [https://www.openstreetmap.org/](https://www.openstreetmap.org/)                                                                                                                     |
| Geofabrik Australia Downloads         | [https://download.geofabrik.de/australia-oceania/australia.html](https://download.geofabrik.de/australia-oceania/australia.html)                                                     |
| Overpass Turbo (query tool)           | [https://overpass-turbo.eu/](https://overpass-turbo.eu/)                                                                                                                             |
| Australian Tagging Guidelines (Paths) | [https://wiki.openstreetmap.org/wiki/Australian_Tagging_Guidelines/Cycling_and_Foot_Paths](https://wiki.openstreetmap.org/wiki/Australian_Tagging_Guidelines/Cycling_and_Foot_Paths) |
| Lighting Tags Wiki                    | [https://wiki.openstreetmap.org/wiki/Key:lit](https://wiki.openstreetmap.org/wiki/Key:lit)                                                                                           |


### ABS (Australian Bureau of Statistics)


| Resource         | URL                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEIFA 2021       | [https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021](https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021) |
| Census 2021 Data | [https://www.abs.gov.au/census/find-census-data](https://www.abs.gov.au/census/find-census-data)                                                                                                                                       |
| TableBuilder     | [https://www.abs.gov.au/statistics/microdata-tablebuilder/tablebuilder](https://www.abs.gov.au/statistics/microdata-tablebuilder/tablebuilder)                                                                                         |


### Other Data Sources


| Resource                                  | URL                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google Environmental Insights Explorer    | [https://insights.sustainability.google/](https://insights.sustainability.google/)                                                                           |
| Google Tree Canopy Lab                    | [https://sustainability.google/operating-sustainably/stories/tree-canopy-lab/](https://sustainability.google/operating-sustainably/stories/tree-canopy-lab/) |
| NASA Earthdata                            | [https://earthdata.nasa.gov/](https://earthdata.nasa.gov/)                                                                                                   |
| MODIS Land Surface Temperature            | [https://modis.gsfc.nasa.gov/data/dataprod/mod11.php](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php)                                                   |
| VIIRS Night-Time Lights                   | [https://www.ncei.noaa.gov/maps/VIIRS_DNB_nighttime_imagery/](https://www.ncei.noaa.gov/maps/VIIRS_DNB_nighttime_imagery/)                                   |
| Earth Observation Group (Payne Institute) | [https://payne.mines.edu/eog/](https://payne.mines.edu/eog/)                                                                                                 |
| Bureau of Meteorology Data Services       | [https://www.bom.gov.au/resources/data-services](https://www.bom.gov.au/resources/data-services)                                                             |
| BoM Victorian Observations                | [https://www.bom.gov.au/vic/observations/](https://www.bom.gov.au/vic/observations/)                                                                         |


### Project Documentation


| Document                            | Description                           |
| ----------------------------------- | ------------------------------------- |
| `docs/DATA_SOURCES.md`              | Current data sources documentation    |
| `docs/PRD.md`                       | Product requirements document         |
| `docs/CONTEXT.md`                   | Project context and three streams     |
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