/**
 * Council insights map layers (docs/DASHBOARD.md § Layers). Default off.
 * Toggling a layer never changes a Day or Night number.
 */

import { EVIDENCE_LAYER_DEFS, resolveEvidenceUrl } from "@/lib/evidenceLayers";
import { OVERLAY_DEFS, type OverlayId } from "@/lib/overlays";

export type DashboardLayerId =
  | "street_lights"
  | "park_lights"
  | OverlayId;

export type DashboardLayerDef = {
  id: DashboardLayerId;
  label: string;
  /** Plain-language role next to the toggle. */
  note: string;
  color: string;
  kind: "evidence" | "amenity";
  /** Circle radius at zoom 11 and 16. */
  radius: [number, number];
  url: () => string;
};

const AMENITY_FILES: Record<OverlayId, string> = {
  fountains: "fountains.geojson",
  benches: "benches.geojson",
  toilets: "toilets.geojson",
  dog_bags: "dog_bags.geojson",
};

const AMENITY_NOTES: Record<OverlayId, string> = {
  fountains: "In the Day Index (heat and shade). Shown as points.",
  benches: "In the Day Index (heat and shade). Shown as points.",
  toilets: "Overlay only. Not in either index.",
  dog_bags: "Overlay only. Not in either index.",
};

/** Dev reads the pipeline symlinks; deployed builds use the map-data proxy. */
function amenityUrl(id: OverlayId): string {
  if (process.env.NODE_ENV === "development") {
    return `/overlays/${AMENITY_FILES[id]}`;
  }
  return OVERLAY_DEFS.find((d) => d.id === id)?.url ?? `/api/map-data/${AMENITY_FILES[id]}`;
}

export const DASHBOARD_LAYERS: DashboardLayerDef[] = [
  ...EVIDENCE_LAYER_DEFS.map(
    (def): DashboardLayerDef => ({
      id: def.id,
      label: def.label,
      note: "Night Index evidence. The toggle does not change the score.",
      color: def.color,
      kind: "evidence",
      radius: def.id === "street_lights" ? [1.6, 3.5] : [2.2, 4.5],
      url: () => resolveEvidenceUrl(def),
    }),
  ),
  ...OVERLAY_DEFS.map(
    (def): DashboardLayerDef => ({
      id: def.id,
      label: def.label,
      note: AMENITY_NOTES[def.id],
      color: def.color,
      kind: "amenity",
      radius: [3.5, 6],
      url: () => amenityUrl(def.id),
    }),
  ),
];

export type DashboardLayerState = Record<DashboardLayerId, boolean>;

export const DEFAULT_DASHBOARD_LAYERS: DashboardLayerState = {
  street_lights: false,
  park_lights: false,
  fountains: false,
  benches: false,
  toilets: false,
  dog_bags: false,
};

export const YOURWALK_STANDARD_STYLE =
  "mapbox://styles/crowdspot1/cmsve8sql00ak01rgb6vn39pt";
/**
 * Satellite is a raster inside the YourWalk style (above roads, below
 * labels), not a style swap: both Standard styles share one "basemap"
 * import, so setStyle diffs them as identical and keeps the old look.
 */
export const SATELLITE_TILES = "mapbox://mapbox.satellite";

export type Basemap = "standard" | "satellite";
