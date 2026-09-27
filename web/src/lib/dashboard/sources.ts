/**
 * Provenance shown on the Council insights dashboard (docs/DASHBOARD.md).
 * Vintages mirror DATA_VINTAGE in pipeline/yourwalk_pipeline/scoring.py.
 * Only list what the scoring run actually loaded.
 */

export type DataSource = {
  name: string;
  role: string;
  vintage: string;
  href: string;
};

export const DASHBOARD_SOURCES: DataSource[] = [
  {
    name: "Footpaths (T1EAM)",
    role: "Footpaths stream, segment network",
    vintage: "Casey open data, current asset layer",
    href: "https://data.casey.vic.gov.au/explore/dataset/footpaths_ply_t1eam/",
  },
  {
    name: "Street lights",
    role: "Night lighting",
    vintage: "AusNet / United Energy, extracted Jun 2024",
    href: "https://data.casey.vic.gov.au/explore/dataset/ausnet_unitedenergy_mvp4_streetlights",
  },
  {
    name: "Urban heat",
    role: "Heat and shade (Day only)",
    vintage: "DEECA, 2018",
    href: "https://discover.data.vic.gov.au/dataset/metropolitan-melbourne-urban-heat-islands-and-urban-vegetation-2018",
  },
  {
    name: "Tree canopy",
    role: "Heat and shade (Day only)",
    vintage: "Vicmap Tree Density, 2019/2020",
    href: "https://discover.data.vic.gov.au/dataset/vicmap-vegetation-tree-density-polygon",
  },
  {
    name: "Speed zones",
    role: "Footpaths stream",
    vintage: "DataVic, Feb 2026",
    href: "https://discover.data.vic.gov.au/dataset/speed-zones",
  },
  {
    name: "Pedestrian crashes at night",
    role: "Night only",
    vintage: "Transport Victoria, 5-year window",
    href: "https://opendata.transport.vic.gov.au/dataset/victoria-road-crash-data",
  },
];

export const PENDING_DATA_NOTE =
  "General crossings and kerb ramps are not in yet. Scores carry reduced confidence. Missing data is not treated as zero.";
