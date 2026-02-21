# Prompt: Data Sets and Themes Investigation for YourWalk Vulnerability Index

Use the prompt below with a new agent (AI or human) to map and document datasets for the YourWalk vulnerability index. Copy everything under "Prompt (copy from here)" into your agent.

---

## Prompt (copy from here)

### Project introduction

**YourWalk** is a data-driven framework for improving pedestrian mobility, funded by the City of Casey Connecting Grant (Victoria, Australia). The project is a collaboration between **Monash University XYX Lab** (research, co-design, evaluation) and **CrowdLab** (technical build, spatial analysis).

**What YourWalk does**:
- Creates a **vulnerability index** that scores locations on three integrated themes: **(1) lighting and night-time safety**, **(2) footpath and crossing accessibility**, and **(3) urban heat and shade**.
- Powers a **public route-planning app** that recommends safe, accessible, climate-comfortable walking routes for residents.
- Powers a **council dashboard** that visualises hotspots, corridors, and prioritisation evidence to support infrastructure planning.

**Pilot**: City of Casey (Victoria, Australia) is the pilot LGA.  
**Longer term**: The framework is designed to be replicable across other LGAs. Base data sets should be broadly available (state, national, global) so the index can run in any LGA; LGA-specific data then enriches the picture where available.

**Grant scope** (from application):
- Q2 deliverable: Harmonise and analyse datasets to create a vulnerability index scoring locations on lighting, accessibility, and heat stress.
- Inclusions: Development, pilot, evaluation, engagement, analysis, dissemination.
- Exclusions: Commercialisation, long-term management, prescriptive infrastructure advice.

**Existing repo documentation** (reference as needed):
- `docs/PRD.md` – Product requirements document (problem, users, goals, requirements).
- `docs/DATA_SOURCES.md` – Current high-level data sources documentation.
- `docs/CONTEXT.md` – Project context and the three integrated streams.

---

### Your objective

Conduct an investigation to:

1. **Identify and list data sets** that could feed into the YourWalk vulnerability index (which scores locations on lighting, accessibility, and heat stress, plus related themes such as safety perceptions and crash risk).
2. **Assign each data set to one or more themes** used in the index.
3. **Classify each data set by layer** using the refined model below (base, LGA-specific essential, LGA-specific enriching).
4. **Document** your findings so the team can decide which base data sets to adopt first, which LGA-specific data is essential for the index to function, and which LGA-specific data provides optional enrichment.

---

### Layering model (refined)

Use three layers when classifying each data set:

| Layer | Definition | Examples |
|-------|------------|----------|
| **Base** | Data available at state, national, or global scale. Can underpin the index in any LGA without council-specific supply. | Crash data (e.g. TAC/Crash Stats), OpenStreetMap (footpaths, crossings), satellite-derived heat/canopy, national census. |
| **LGA-specific essential** | Data that is sourced per-LGA (from council or local sources) but is **essential** to compute the index for a given theme. Without it, the theme cannot be reliably scored. Most councils would have this data; it should be requested as a minimum when onboarding a new LGA. | Council lighting assets (location, type, wattage), council footpath assets (width, condition, surface), council crossing assets (type, signals). |
| **LGA-specific enriching** | Data that is sourced per-LGA and **enriches** the index or adds optional depth, but is not essential for the theme to function. If missing, the index can still run (using base + essential). | Local participatory data (e.g. YourGround, Park Spot, Walk Spot), council tree inventory (if satellite canopy is base), local surveys. |

**Key insight**: Some LGA-specific data is essential. For example, **lighting asset data** (location and type of lights) is LGA-specific (sourced from each council) but essential to the Lighting theme. Every council is likely to have this data. When onboarding a new LGA, essential data should be requested upfront; enriching data is optional and can be layered on later.

**Document for each data set**:
- Layer (Base / LGA-specific essential / LGA-specific enriching)
- Theme(s)
- Source and access method
- Geographic scope (global, national, state, LGA, partial)
- Vintage and update frequency
- Licensing / access notes
- Pedestrian relevance
- Notes (e.g. limitations, alternatives if unavailable)

---

### Themes to use when classifying data sets

1. **Lighting and night-time safety** – Street lighting assets (location, type, wattage), LUX measurements, night-time visibility, perceived safety after dark.
2. **Footpath and crossing accessibility** – Footpath location, condition, width, surface, obstacles, gradients; crossing location, type, signals, tactile indicators.
3. **Urban heat and shade** – Land surface temperature, air temperature, tree canopy, shade, exposure, thermal comfort.
4. **Safety perceptions** – Participatory or survey data on perceived safety, comfort, or fear (e.g. YourGround, Walk Spot, Park Spot).
5. **Crash / incident data** – Pedestrian-involved crashes or incidents. Walking-focused where possible.
6. **Other / contextual** – Demographics, land use, points of interest, or other data that supports the index or routing.

---

### Data sources and links to start with

#### Casey Open Data (pilot LGA)

| Resource | URL |
|----------|-----|
| Casey Open Data Platform (home) | https://data.casey.vic.gov.au/pages/home/ |
| Casey WFS (for GIS software) | https://data.casey.vic.gov.au/api/wfs?service=wfs&request=getcapabilities |
| Data Vic (Casey datasets) | https://discover.data.vic.gov.au/dataset/?q=City%20of%20casey |

**Note**: Casey's Open Data is ingested into Data Vic. Search "City of Casey" on Data Vic to see available datasets (lighting, footpaths, trees, etc.). The Casey lighting dataset includes **location and type** of lights.

#### Other sources to investigate

- **Crash data** – TAC, Victoria Police, Crash Stats (state or national). Clarify pedestrian filtering and LGA coverage.
- **YourGround** – Participatory perception-of-safety data (Monash XYX Lab). Note coverage (Victoria-wide or national?), theme(s), vintage, layer.
- **Park Spot** – As above.
- **Walk Spot (2017)** – Older participatory dataset. Note theme(s), coverage, limitations due to 2017 vintage.
- **OpenStreetMap** – Footpaths, crossings, lighting (where tagged), land use. Typically base (global).
- **Satellite / environmental data** – Urban heat (land surface temperature), tree canopy (e.g. DELWP canopy data, satellite-derived). Typically base.
- **Census / demographics** – ABS Census. Typically base. Note if used for weighting or context.
- **Any other relevant datasets** – Include them with the same structure.

---

### Constraints and considerations

- **Whole-of-LGA**: Data design should support application across a whole LGA (e.g. all of Casey), not only selected suburbs. Document any datasets that are partial and how they could be used or extended.
- **Walking / pedestrian focus**: Prefer data explicitly about pedestrians, footpaths, and walking environment. If a dataset is road or vehicle-centric, note how it is filtered for pedestrian relevance (e.g. pedestrian-involved crashes only).
- **Replicability**: Base data sets should be chosen so another LGA could run the same index with the same base. LGA-specific essential data should be clearly documented so a new LGA knows what to provide.
- **Essential data gaps**: If a theme's essential data is not available for a given LGA, flag this as a gap. Note alternatives (e.g. OpenStreetMap lighting tags as fallback, though less reliable than council assets).

---

### Output format

Produce a structured document that includes:

1. **Summary** – Overview of the layering model (base, LGA-specific essential, LGA-specific enriching), main themes, and key findings.
2. **Data set register** – Table of each dataset with columns: Name, Source, Theme(s), Layer, Geographic scope, Vintage/update frequency, Access/licensing, Pedestrian relevance, Notes.
3. **Themes map** – For each theme, list which datasets cover it and their layer. Highlight which themes depend on LGA-specific essential data.
4. **Essential data checklist** – List of LGA-specific essential data that should be requested when onboarding a new LGA (e.g. lighting assets, footpath assets).
5. **Gaps and recommendations** – Gaps in base data, limitations (e.g. Walk Spot 2017), recommended priorities for base and essential data.
6. **References** – Links to data sources, metadata, existing repo docs (DATA_SOURCES.md, PRD.md).

Do not invent data sets or access details. If something is uncertain, state it as an open question. Use Australian spelling.

---

## End of prompt

---

## How to use this prompt

1. Copy the text under **"Prompt (copy from here)"** (from "### Project introduction" through "Use Australian spelling.").
2. Paste it into a new agent (e.g. new AI chat, or brief for a researcher).
3. Optionally attach or link to:
   - `docs/DATA_SOURCES.md` (current high-level data sources doc)
   - `docs/PRD.md` (product requirements)
   - Any existing list of datasets (e.g. Crash Stats, YourGround, Park Spot, Walk Spot) or links to their metadata.
4. Ask the agent to output the document in a format that can be dropped into the repo (e.g. a new `docs/DATA_SET_REGISTER.md` or an update to `DATA_SOURCES.md`).
5. Review the output and move open questions into `docs/DECISIONS.md` or `docs/REQS/data_ingestion_versioning.md` as needed.

## Where the output could live

- **New file**: `docs/DATA_SET_REGISTER.md` – dataset register, themes map, essential checklist, and layer classification.
- **Update**: `docs/DATA_SOURCES.md` – expand with the same structure.
- **Backlog**: Add a backlog item in `docs/BACKLOG.md` to "Finalise base data set list and LGA-specific layer for Casey" once the investigation is done.
