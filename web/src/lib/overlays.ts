/** Along-the-way amenity overlays — map visibility only (not index maths). */

export type OverlayId = "fountains" | "benches" | "toilets" | "dog_bags";

export type OverlayDef = {
  id: OverlayId;
  label: string;
  /** Public URL under /overlays/ when file exists */
  url: string | null;
  color: string;
  /** false = checkbox shown but layer not available yet */
  available: boolean;
  hint?: string;
};

export const OVERLAY_DEFS: OverlayDef[] = [
  {
    id: "fountains",
    label: "Drinking fountains",
    url: "/overlays/fountains.geojson",
    color: "#27AAE1",
    available: true,
  },
  {
    id: "benches",
    label: "Benches",
    url: "/overlays/benches.geojson",
    color: "#8DC63F",
    available: true,
  },
  {
    id: "toilets",
    label: "Toilets",
    url: null,
    color: "#7C3AED",
    available: false,
    hint: "Council layer not on the map yet",
  },
  {
    id: "dog_bags",
    label: "Dog bags",
    url: null,
    color: "#F6871F",
    available: false,
    hint: "Council layer not on the map yet",
  },
];

export type OverlayState = Record<OverlayId, boolean>;

export const DEFAULT_OVERLAYS: OverlayState = {
  fountains: false,
  benches: false,
  toilets: false,
  dog_bags: false,
};
