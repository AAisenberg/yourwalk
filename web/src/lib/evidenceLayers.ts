/**
 * Lab evidence layers — raw Night Index inputs under the score.
 * Not resident amenity overlays; not index maths.
 */

import type { FilterSpecification } from "mapbox-gl";

export type EvidenceLayerId = "street_lights" | "park_lights";

export type EvidenceLayerDef = {
  id: EvidenceLayerId;
  label: string;
  /** Path under web/public when symlinked from pipeline/data/viewer */
  localUrl: string;
  /** Supabase Storage object name under map-data/ */
  storageObject: string;
  envKey: "NEXT_PUBLIC_STREETLIGHTS_GEOJSON_URL" | "NEXT_PUBLIC_PARK_LIGHTS_GEOJSON_URL";
  color: string;
  /** Circle radius at zoom 11 / 15 */
  radius: [number, number];
  hint: string;
};

export const EVIDENCE_LAYER_DEFS: EvidenceLayerDef[] = [
  {
    id: "street_lights",
    label: "Street lights",
    localUrl: "/overlays/streetlights.geojson",
    storageObject: "streetlights.geojson",
    envKey: "NEXT_PUBLIC_STREETLIGHTS_GEOJSON_URL",
    color: "#facc15",
    radius: [2, 3.5],
    hint: "AusNet / United Energy (~42k) — Night Index evidence",
  },
  {
    id: "park_lights",
    label: "Park / reserve lights",
    localUrl: "/overlays/park_lights.geojson",
    storageObject: "park_lights.geojson",
    envKey: "NEXT_PUBLIC_PARK_LIGHTS_GEOJSON_URL",
    color: "#fde047",
    radius: [3, 5],
    hint: "Council park/reserve lights (~3k)",
  },
];

export type EvidenceState = Record<EvidenceLayerId, boolean>;

export const DEFAULT_EVIDENCE: EvidenceState = {
  street_lights: false,
  park_lights: false,
};

export function defaultEvidenceGeoJsonUrl(
  supabaseUrl: string,
  storageObject: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/map-data/${storageObject}`;
}

/**
 * Explicit env → local /overlays in development → Supabase Storage → local.
 * Dev prefers symlinks so lab works before evidence files are uploaded.
 */
export function resolveEvidenceUrl(def: EvidenceLayerDef): string {
  const explicit = process.env[def.envKey]?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "development") {
    return def.localUrl;
  }
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultEvidenceGeoJsonUrl(supabase, def.storageObject);
  return def.localUrl;
}

/**
 * Case-insensitive suburb filter (park lights are UPPERCASE; street lights title case).
 */
export function evidenceSuburbFilter(
  suburb: string,
): FilterSpecification | null {
  if (!suburb || suburb === "all") return null;
  return [
    "==",
    ["downcase", ["coalesce", ["get", "suburb"], ""]],
    suburb.toLowerCase(),
  ];
}

export function evidencePopupHtml(
  id: EvidenceLayerId,
  p: GeoJSON.GeoJsonProperties,
): string {
  if (!p) return "";
  if (id === "street_lights") {
    return `<strong>Street light</strong><br/>
      ${escapeHtml(String(p.provider ?? "—"))} · ${escapeHtml(String(p.suburb ?? ""))}<br/>
      ${escapeHtml(String(p.street_name ?? "—"))}<br/>
      ${p.wattage_w != null ? `${p.wattage_w} W` : "wattage —"} · ${escapeHtml(String(p.globe_type ?? "—"))}<br/>
      qa_flag: ${escapeHtml(String(p.qa_flag ?? "—"))}`;
  }
  return `<strong>Park / reserve light</strong><br/>
    ${escapeHtml(String(p.suburb ?? ""))} · ${escapeHtml(String(p.location_type ?? "—"))}<br/>
    ${p.wattage_w != null ? `${p.wattage_w} W` : "wattage —"} · ${escapeHtml(String(p.luminaire_type ?? "—"))}<br/>
    qa_flag: ${escapeHtml(String(p.qa_flag ?? "—"))}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
