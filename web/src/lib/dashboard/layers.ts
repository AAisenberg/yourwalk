/**
 * Council insights map layers (docs/DASHBOARD.md § Layers). Default off.
 * Toggling a layer never changes a Day or Night number.
 *
 * "score" layers are inputs to the index; "context" layers are shown for
 * reference only. Graffiti and night crashes are inputs too, but stay off the
 * dashboard until the XYX language pass.
 */

import type { ExpressionSpecification } from "mapbox-gl";

import { EVIDENCE_LAYER_DEFS, resolveEvidenceUrl } from "@/lib/evidenceLayers";
import { OVERLAY_DEFS, type OverlayId } from "@/lib/overlays";

export type DashboardLayerId =
  | "street_lights"
  | "park_lights"
  | "tree_canopy"
  | "urban_heat"
  | "speed_zones"
  | "school_crossings"
  | OverlayId;

export type LayerGroup = "score" | "context";

type Draw =
  | { type: "circle"; color: string; radius: [number, number]; stroke: "dark" | "light" }
  | { type: "fill"; color: ExpressionSpecification | string; opacity: number }
  | { type: "line"; color: ExpressionSpecification | string; width: [number, number] };

export type LegendKey =
  | { kind: "swatches"; items: { color: string; label: string }[] }
  | { kind: "gradient"; colors: string[]; low: string; high: string }
  | { kind: "dot"; color: string };

export type DashboardLayerDef = {
  id: DashboardLayerId;
  label: string;
  group: LayerGroup;
  /** Which part of the score it feeds, or why it is shown. */
  note: string;
  /** Swatch colour in the Layers menu. */
  swatch: string;
  draw: Draw;
  /** Draw under the score paint (area layers) or above it (points). */
  under: boolean;
  /**
   * Covers the same ground as the score paint, so scored paths fade while it
   * is on. Area layers of the same `exclusive` group cannot both be on.
   */
  fadesPaths: boolean;
  exclusive?: "area";
  legend: LegendKey;
  url: () => string;
  /** Title and lines for the click popup (plain text, escaped by caller). */
  popup: (p: GeoJSON.GeoJsonProperties) => { title: string; lines: string[] };
};

function localOrProxy(file: string): () => string {
  return () =>
    process.env.NODE_ENV === "development" ? `/overlays/${file}` : `/api/map-data/${file}`;
}

const AMENITY_FILES: Record<OverlayId, string> = {
  fountains: "fountains.geojson",
  benches: "benches.geojson",
  toilets: "toilets.geojson",
  dog_bags: "dog_bags.geojson",
};

function text(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== "none" && t.toLowerCase() !== "null" ? t : null;
}

// Kept off the orange/teal score scale so a colour means one thing
const SPEED_STEPS: { min: number; color: string; label: string }[] = [
  { min: 0, color: "#CBD5E1", label: "40 or less" },
  { min: 45, color: "#94A3B8", label: "50" },
  { min: 55, color: "#8B5CF6", label: "60" },
  { min: 65, color: "#6D28D9", label: "70" },
  { min: 75, color: "#3B0764", label: "80+" },
];

const SPEED_COLOR: ExpressionSpecification = [
  "step",
  ["coalesce", ["get", "speed_limit_kmh"], 50],
  SPEED_STEPS[0].color,
  ...SPEED_STEPS.slice(1).flatMap((s) => [s.min, s.color]),
] as ExpressionSpecification;

const CANOPY_CLASSES = [
  { value: "dense", color: "#0B6E3A", label: "Dense" },
  { value: "medium", color: "#3F9D5A", label: "Medium" },
  { value: "sparse", color: "#A6D3A0", label: "Sparse" },
];

const CANOPY_COLOR: ExpressionSpecification = [
  "match",
  ["get", "tree_density"],
  "dense",
  CANOPY_CLASSES[0].color,
  "medium",
  CANOPY_CLASSES[1].color,
  CANOPY_CLASSES[2].color,
];

// uhi18_m: degrees warmer than a non-urban baseline; Casey p5≈7, p95≈14
const HEAT_STOPS: [number, string][] = [
  [7, "#FCE7F3"],
  [10, "#F9A8D4"],
  [12, "#DB2777"],
  [14.5, "#831843"],
];

const HEAT_COLOR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "uhi18_m"], 10],
  ...HEAT_STOPS.flat(),
] as ExpressionSpecification;

export const DASHBOARD_LAYERS: DashboardLayerDef[] = [
  {
    id: "tree_canopy",
    label: "Tree canopy",
    group: "score",
    note: "Feeds heat and shade (Day only). Vicmap 2019/20.",
    swatch: "#3F9D5A",
    draw: { type: "fill", color: CANOPY_COLOR, opacity: 0.55 },
    under: true,
    fadesPaths: true,
    exclusive: "area",
    legend: { kind: "swatches", items: CANOPY_CLASSES.map(({ color, label }) => ({ color, label })) },
    url: localOrProxy("tree_density.geojson"),
    popup: (p) => ({
      title: "Tree canopy",
      lines: [`${text(p?.tree_density) ?? "Unknown"} canopy`, "Vicmap Tree Density 2019/20"],
    }),
  },
  {
    id: "urban_heat",
    label: "Urban heat (2018)",
    group: "score",
    note: "Feeds heat and shade (Day only). Hotter areas darker.",
    swatch: "#DB2777",
    draw: { type: "fill", color: HEAT_COLOR, opacity: 0.55 },
    under: true,
    fadesPaths: true,
    exclusive: "area",
    legend: { kind: "gradient", colors: HEAT_STOPS.map(([, c]) => c), low: "Cooler", high: "Hotter (2018)" },
    url: localOrProxy("urban_heat.geojson"),
    popup: (p) => {
      const uhi = typeof p?.uhi18_m === "number" ? p.uhi18_m.toFixed(1) : null;
      return {
        title: "Urban heat (2018)",
        lines: [uhi ? `${uhi}°C warmer than a non-urban baseline` : "No reading", "DEECA 2018, mesh block"],
      };
    },
  },
  {
    id: "speed_zones",
    label: "Speed zones",
    group: "score",
    note: "Feeds footpaths: faster traffic alongside lowers the score.",
    swatch: "#8B5CF6",
    draw: { type: "line", color: SPEED_COLOR, width: [1.2, 3.5] },
    under: true,
    fadesPaths: true,
    legend: { kind: "swatches", items: SPEED_STEPS.map(({ color, label }) => ({ color, label: `${label}` })) },
    url: localOrProxy("speed_zones.geojson"),
    popup: (p) => ({
      title: `${text(p?.speed_limit_kmh) ?? "–"} km/h`,
      lines: [text(p?.road_name) ?? "Road name not recorded", "DataVic speed zones, Feb 2026"],
    }),
  },
  {
    id: "school_crossings",
    label: "School crossings",
    group: "score",
    note: "Feeds footpaths: a small lift for paths near one.",
    swatch: "#4F46E5",
    draw: { type: "circle", color: "#4F46E5", radius: [4, 7], stroke: "light" },
    under: false,
    fadesPaths: false,
    legend: { kind: "dot", color: "#4F46E5" },
    url: localOrProxy("school_crossings.geojson"),
    popup: (p) => ({
      title: text(p?.school_name) ?? "School crossing",
      lines: [text(p?.street_name), text(p?.suburb), "City of Casey"].filter((x): x is string => Boolean(x)),
    }),
  },
  ...EVIDENCE_LAYER_DEFS.map(
    (def): DashboardLayerDef => ({
      id: def.id,
      label: def.label,
      group: "score",
      note: "Feeds night lighting (Night only).",
      swatch: def.color,
      draw: {
        type: "circle",
        color: def.color,
        radius: def.id === "street_lights" ? [1.6, 3.5] : [2.2, 4.5],
        stroke: "dark",
      },
      under: false,
      fadesPaths: false,
      legend: { kind: "dot", color: def.color },
      url: () => resolveEvidenceUrl(def),
      popup: (p) => ({
        title: def.label.replace(/s$/, ""),
        lines: [
          text(p?.street_name),
          text(p?.suburb),
          p?.wattage_w != null ? `${p.wattage_w} W` : null,
        ].filter((x): x is string => Boolean(x)),
      }),
    }),
  ),
  ...OVERLAY_DEFS.map((def): DashboardLayerDef => {
    const inScore = def.id === "fountains" || def.id === "benches";
    return {
      id: def.id,
      label: def.label,
      group: inScore ? "score" : "context",
      // Comfort is 15% of heat and shade, about 6% of the Day score
      note: inScore ? "Feeds heat and shade (small share, Day only)." : "Not in either score.",
      swatch: def.color,
      draw: { type: "circle", color: def.color, radius: [3.5, 6], stroke: "light" },
      under: false,
      fadesPaths: false,
      legend: { kind: "dot", color: def.color },
      url:
        process.env.NODE_ENV === "development"
          ? localOrProxy(AMENITY_FILES[def.id])
          : () => def.url ?? `/api/map-data/${AMENITY_FILES[def.id]}`,
      popup: () => ({ title: def.label, lines: [] }),
    };
  }),
];

export const LAYER_GROUPS: { id: LayerGroup; label: string; hint: string }[] = [
  { id: "score", label: "In the score", hint: "Inputs behind the Day and Night scores" },
  { id: "context", label: "Context only", hint: "Shown for reference. Not in either score" },
];

export type DashboardLayerState = Record<DashboardLayerId, boolean>;

export const DEFAULT_DASHBOARD_LAYERS: DashboardLayerState = {
  tree_canopy: false,
  urban_heat: false,
  speed_zones: false,
  school_crossings: false,
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

/** How strongly the scored paths are drawn. Separate from which score is shown. */
export type PathMode = "full" | "faint" | "off";
