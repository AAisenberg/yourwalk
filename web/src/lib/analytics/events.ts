/** First-party resident analytics (ADR-013). Allowlisted names and keys only. */

export const ANALYTICS_EVENT_NAMES = [
  "session_started",
  "find_started",
  "find_completed",
  "find_failed",
  "route_selected",
  "use_this_route",
  "layer_toggled",
  "area_context",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_PROP_KEYS = [
  "intent",
  "when",
  "when_auto",
  "duration_band",
  "overlays",
  "option_count",
  "duration_ms",
  "engines",
  "reason",
  "card_type",
  "distance_band",
  "layer",
  "layer_on",
  "suburb",
  "device",
] as const;

export type AnalyticsPropKey = (typeof ANALYTICS_PROP_KEYS)[number];

export type AnalyticsProperties = Partial<{
  intent: "trip" | "outing";
  when: "day" | "night";
  when_auto: boolean;
  duration_band: string;
  overlays: string[];
  option_count: number;
  duration_ms: number;
  engines: string[];
  reason: string;
  card_type: string;
  distance_band: string;
  layer: string;
  layer_on: boolean;
  suburb: string;
  device: "phone" | "desktop";
}>;

const FORBIDDEN_KEY =
  /^(lat|lon|lng|latitude|longitude|address|email|ip|geometry|coordinates|center|origin|destination|place_name|full_address|query|label|origin_label|dest_label)$/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EVENT_SET = new Set<string>(ANALYTICS_EVENT_NAMES);
const PROP_SET = new Set<string>(ANALYTICS_PROP_KEYS);

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return EVENT_SET.has(value);
}

export function isAnalyticsSessionId(value: string): boolean {
  return UUID_RE.test(value);
}

export function outingDurationBand(minutes: number): string {
  if (minutes <= 20) return "10-20";
  if (minutes <= 35) return "25-35";
  if (minutes <= 50) return "40-50";
  return "55-60";
}

export function distanceBand(metres: number): string {
  if (metres < 1000) return "0-1km";
  if (metres < 2000) return "1-2km";
  if (metres < 5000) return "2-5km";
  return "5km+";
}

export function cardTypeFromLabel(label: string): string {
  if (label === "Best for you") return "best_for_you";
  if (label === "Away from roads") return "away_from_roads";
  if (label === "There and back") return "there_and_back";
  if (label === "Another loop") return "another_loop";
  if (label === "Neighbourhood links") return "neighbourhood_links";
  if (label === "Shortest") return "shortest";
  if (label === "More shade" || label === "Better lighting" || label === "Smoother footpaths") {
    return "complement";
  }
  return "other";
}

export function findFailReason(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("still loading") || m.includes("footpath network")) {
    return "network_loading";
  }
  if (m.includes("outside") && m.includes("casey")) return "outside_casey";
  if (
    m.includes("geocod") ||
    m.includes("label this location") ||
    m.includes("couldn’t get your location") ||
    m.includes("couldn't get your location")
  ) {
    return "geocode";
  }
  if (m.includes("circuit") || m.includes("loop")) return "no_loop";
  if (m.includes("route") || m.includes("walk") || m.includes("direction")) {
    return "no_route";
  }
  return "unknown";
}

/**
 * Last comma-separated locality from a shortened place label
 * ("Wilson Botanic Park, Berwick" → "Berwick"). Never returns a street.
 */
export function suburbFromPlaceLabel(label: string): string | null {
  const parts = label
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      if (/^(Australia|Victoria|VIC)$/i.test(p)) return false;
      if (/^(Victoria|VIC)\s+\d{4}$/i.test(p)) return false;
      if (/^\d{4}$/.test(p)) return false;
      return true;
    });
  if (parts.length < 2) return null;
  const suburb = (parts[parts.length - 1] ?? "")
    .replace(/\s*(Victoria|VIC)(\s+\d{4})?\s*$/i, "")
    .trim();
  if (suburb.length < 2 || suburb.length > 40) return null;
  if (/\d/.test(suburb)) return null;
  if (/^melbourne$/i.test(suburb)) return null;
  if (
    /^(street|road|court|drive|avenue|crescent|place|lane|way|parade|boulevard|close|grove|rise|circuit|highway|freeway)$/i.test(
      suburb,
    )
  ) {
    return null;
  }
  return suburb;
}

export function sanitizeProperties(
  raw: Record<string, unknown> | AnalyticsProperties,
): AnalyticsProperties {
  const out: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(raw)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (!PROP_SET.has(key)) continue;
    if (value == null) continue;

    if (key === "overlays" || key === "engines") {
      if (!Array.isArray(value)) continue;
      const items = value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= 40 && !/\d{3,}/.test(v))
        .slice(0, 6);
      if (items.length) {
        if (key === "overlays") out.overlays = items;
        else out.engines = items;
      }
      continue;
    }

    if (key === "when_auto" || key === "layer_on") {
      if (typeof value === "boolean") {
        if (key === "when_auto") out.when_auto = value;
        else out.layer_on = value;
      }
      continue;
    }

    if (key === "option_count" || key === "duration_ms") {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const n = Math.max(0, Math.round(value));
      if (key === "option_count") out.option_count = Math.min(n, 10);
      else out.duration_ms = Math.min(n, 180_000);
      continue;
    }

    if (typeof value !== "string") continue;
    const text = value.trim().slice(0, 40);
    if (!text) continue;

    switch (key) {
      case "intent":
        if (text === "trip" || text === "outing") out.intent = text;
        break;
      case "when":
        if (text === "day" || text === "night") out.when = text;
        break;
      case "device":
        if (text === "phone" || text === "desktop") out.device = text;
        break;
      case "duration_band":
        out.duration_band = text;
        break;
      case "reason":
        out.reason = text;
        break;
      case "card_type":
        out.card_type = text;
        break;
      case "distance_band":
        out.distance_band = text;
        break;
      case "layer":
        out.layer = text;
        break;
      case "suburb":
        if (!/\d/.test(text)) out.suburb = text;
        break;
      default:
        break;
    }
  }
  return out;
}
