# Casey Council data request — pedestrian crossings and kerb ramps

**Status:** Draft — not yet sent  
**Project:** YourWalk — City of Casey Connecting Grant pilot  
**From:** Anthony Aisenberg, CrowdLab  
**Context:** April 2026 Casey Leaders co-design workshop; methodology v1.1 (29 May 2026)

---

**Subject:** YourWalk pilot — request for pedestrian crossing and kerb ramp data

Dear [Casey Open Data / Transport & Infrastructure contact],

I'm writing on behalf of the YourWalk project, developed by CrowdLab in partnership with Monash University's XYX Lab under the City of Casey Connecting Grant.

YourWalk helps residents compare walking routes by day and night conditions, and gives Council an evidence base for prioritising footpath investment. We are now building the data pipeline for the Casey pilot, using your open data portal as the primary source for the footpath segment network (Footpaths T1EAM).

Following the April 2026 Casey Leaders co-design workshop, participants highlighted **pedestrian crossings** and **kerb ramps** as key pain points for footpath accessibility. Our methodology (documented in the project repo) includes these inputs in the shared Accessibility stream, but they are not available on the open data portal beyond school crossings.

We would appreciate your help with the following:

### 1. General pedestrian crossing locations

All pedestrian crossing types within the City of Casey LGA, including but not limited to:

- Signalised crossings  
- Zebra / marked crossings  
- Pedestrian refuges and median crossings  

**Preferred format:** GeoJSON, Shapefile, or CSV with coordinates (WGS84 or GDA2020)  
**Useful attributes:** crossing type, signalisation, associated road name, asset ID if available

### 2. Kerb ramp presence

Whether kerb ramps are recorded as:

- An attribute on the footpath network (T1EAM or equivalent asset layer), or  
- A separate point/line asset layer  

**Preferred format:** Same as above  
**Useful attributes:** ramp location, associated footpath segment ID, tactile indicators if held

### 3. Optional — gradient / slope data

If Council holds footpath gradient or slope data separately from the portal footpath geometry, we would welcome access for accessibility scoring. If not held, we will derive slope from Vicmap Elevation.

### 4. Confirmation — street lighting coverage

Could you confirm whether the portal datasets (AusNet/United Energy Street Lights and Casey Asset Lights for parks/reserves) represent the complete set Council uses for pedestrian lighting assessment? We note there are no lux measurements in the open data — asset location and wattage/globe type will be used as proxies.

---

**Licence and use:** Data will be used for the YourWalk Casey pilot and grant reporting. We will attribute City of Casey as the source in the resident app and Council dashboard. If any datasets require a separate data-sharing agreement, please let us know.

**Timeline:** We are beginning pipeline ingestion in June 2026. Crossings and kerb ramps are not blocking initial footpath network work, but receiving this data within the next few weeks would allow us to include them in the first scoring run rather than publishing with reduced confidence on crossing coverage.

Happy to discuss format, scope, or a short briefing with your team. Thank you for the strong open data foundation — the Footpaths T1EAM layer is our primary segment network for the pilot.

Kind regards,

Anthony Aisenberg  
CrowdLab  
[email]  
[phone]

---

**Internal notes (remove before sending):**

- Replace bracketed contact details  
- Confirm recipient — Casey Open Data team, Transport & Infrastructure, or grant liaison  
- Link to methodology if requested: `https://github.com/AAisenberg/yourwalk/blob/main/docs/VULNERABILITY_INDEX.md`  
- Do not send until Nikki sign-off on v1.1 is confirmed if required for Council comms
