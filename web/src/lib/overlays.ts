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
  /** false = row shown but layer not available yet */
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
    label: "Drinking fountains",
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

/** Shared Layers helper under place fields (A to B and Loop). */
export const LAYERS_ALONG_WAY_HINT =
  "Want a fountain or bench on the way? Use Layers.";

/** Extra honesty on A to B: layers paint, they do not reroute the trip. */
export const LAYERS_TRIP_HINT_DETAIL =
  "These show on the map. They do not change the walk we search.";

function firstText(
  props: GeoJSON.GeoJsonProperties | null | undefined,
  keys: string[],
): string | null {
  if (!props) return null;
  for (const key of keys) {
    const raw = props[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (
        trimmed &&
        trimmed.toLowerCase() !== "null" &&
        trimmed.toLowerCase() !== "none"
      ) {
        return trimmed;
      }
    }
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function uniqueLines(title: string, parts: Array<string | null>): string[] {
  const seen = new Set<string>([title.toLowerCase()]);
  const lines: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(part);
  }
  return lines;
}

/** Resident-facing amenity card from Casey overlay properties. No invented fields. */
export function overlayPopupCopy(
  id: OverlayId,
  props: GeoJSON.GeoJsonProperties | null | undefined,
): { title: string; lines: string[] } {
  const kind = OVERLAY_DEFS.find((d) => d.id === id)?.label ?? "Amenity";
  const suburb = firstText(props, ["suburb"]);
  const reserve = firstText(props, [
    "park_reserve_name",
    "reserve_name",
    "parkreservename",
    "parkresname",
  ]);
  const name = firstText(props, ["name", "description"]);
  const address = firstText(props, ["address", "property_address"]);

  if (id === "fountains") {
    const title = reserve ?? name ?? kind;
    const type = firstText(props, ["fountain_type", "dftype", "feature_type"]);
    return {
      title,
      lines: uniqueLines(title, [
        type,
        suburb,
        address,
        "City of Casey · drinking fountain",
      ]),
    };
  }
  if (id === "benches") {
    const type = firstText(props, ["amenity_type", "facility"]);
    const title = reserve ?? type ?? kind;
    return {
      title,
      lines: uniqueLines(title, [
        type,
        suburb,
        "City of Casey · bench or seat",
      ]),
    };
  }
  if (id === "toilets") {
    const title = name ?? reserve ?? kind;
    const feature = firstText(props, ["facility_feature", "function_use"]);
    return {
      title,
      lines: uniqueLines(title, [
        feature,
        suburb,
        address,
        "City of Casey · public toilet",
      ]),
    };
  }
  const title = reserve ?? name ?? kind;
  const type = firstText(props, ["wcp_type", "facility_feature"]);
  return {
    title,
    lines: uniqueLines(title, [
      type,
      suburb,
      address,
      "City of Casey · dog bag dispenser",
    ]),
  };
}

export function escapeOverlayHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function overlayPopupHtml(
  id: OverlayId,
  props: GeoJSON.GeoJsonProperties | null | undefined,
): string {
  const { title, lines } = overlayPopupCopy(id, props);
  const body = lines
    .map(
      (line) =>
        `<p class="yw-amenity-popup-line">${escapeOverlayHtml(line)}</p>`,
    )
    .join("");
  return `<div class="yw-amenity-popup-body"><p class="yw-amenity-popup-title">${escapeOverlayHtml(title)}</p>${body}</div>`;
}
