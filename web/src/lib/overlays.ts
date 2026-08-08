/** Along-the-way amenity overlays — map visibility only (not index maths). */

export type OverlayId = "fountains" | "benches" | "toilets" | "dog_bags";

export type OverlayDef = {
  id: OverlayId;
  label: string;
  /**
   * Same-origin URL. Preview/Production use `/api/map-data/*` (GitHub release
   * proxy). Local symlink `/overlays/*` is optional via env for offline work.
   */
  url: string | null;
  color: string;
  /** false = checkbox shown but layer not available yet */
  available: boolean;
  hint?: string;
};

function overlayUrl(file: string): string {
  if (process.env.NEXT_PUBLIC_OVERLAYS_USE_LOCAL === "1") {
    return `/overlays/${file}`;
  }
  return `/api/map-data/${file}`;
}

export const OVERLAY_DEFS: OverlayDef[] = [
  {
    id: "fountains",
    label: "Fountains",
    url: overlayUrl("fountains.geojson"),
    color: "#27AAE1",
    available: true,
  },
  {
    id: "benches",
    label: "Benches",
    url: overlayUrl("benches.geojson"),
    color: "#8DC63F",
    available: true,
  },
  {
    id: "toilets",
    label: "Toilets",
    url: overlayUrl("toilets.geojson"),
    color: "#7C3AED",
    available: true,
  },
  {
    id: "dog_bags",
    label: "Dog bags",
    url: overlayUrl("dog_bags.geojson"),
    color: "#F6871F",
    available: true,
  },
];

export type OverlayState = Record<OverlayId, boolean>;

export const DEFAULT_OVERLAYS: OverlayState = {
  fountains: false,
  benches: false,
  toilets: false,
  dog_bags: false,
};
