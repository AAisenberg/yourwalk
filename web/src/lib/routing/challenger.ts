import type { LngLat } from "./types";

export type ChallengerPrefs = {
  accessibility?: number;
  shadeHeat?: number;
  afterDark?: number;
  /** Generation-time off-road bias + 1.6× detour (not ranking-only). */
  preferSharedPaths?: boolean;
  /**
   * Second Casey card: invert the dominant stream (other pathish corridor).
   * Challenger computes the invert; do not send inverted sliders.
   */
  complement?: boolean;
};

export type ChallengerRoute = {
  engine: string;
  strategy: string;
  distance_m: number;
  duration_s: number;
  geometry: GeoJSON.LineString;
  detour_vs_graph_shortest?: number | null;
  capped_from_detour?: number | null;
  /** Length-weighted OSM highway metres along the graph path (no pin stubs). */
  osm_highway_m?: Record<string, number>;
  /** Share of graph length on pathish OSM classes (footway, cycleway, service, …). */
  osm_pathish_share?: number | null;
  prefs?: ChallengerPrefs | null;
  /** Away search exceeded 1.6×; geometry is the default footpath route. */
  away_capped_to_default?: boolean;
  /** Stream the complement card maximises (invert-dominant). */
  complement_stream?: "accessibility" | "shadeHeat" | "afterDark";
};

type ChallengerResponse = {
  route?: ChallengerRoute;
  error?: string;
};

export type ChallengerLoop = ChallengerRoute & {
  /** Server-side same-path revisit ratio (same metric family as planOuting). */
  revisit?: number;
  /** Turning points [lng, lat] the circuit was drawn through. */
  vias?: [number, number][];
};

type ChallengerLoopsResponse = {
  loops?: ChallengerLoop[];
  error?: string;
};

/**
 * Fetch OSM+Casey score-aware path via Next proxy → local serve_challenger.py.
 * Returns null if the service is down (Mapbox-only fallback).
 *
 * `apiBase` is for Node diagnostics (e.g. http://localhost:3000). In the
 * browser, omit it so the relative `/api/challenger-route` path is used.
 */
export async function fetchChallengerRoute(
  origin: LngLat,
  destination: LngLat,
  mode: "day" | "night" = "day",
  opts?: { apiBase?: string; prefs?: ChallengerPrefs },
): Promise<ChallengerRoute | null> {
  const path = "/api/challenger-route";
  const url = opts?.apiBase
    ? `${opts.apiBase.replace(/\/$/, "")}${path}`
    : path;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lng: origin.lng, lat: origin.lat },
        destination: { lng: destination.lng, lat: destination.lat },
        mode,
        ...(opts?.prefs ? { prefs: opts.prefs } : {}),
      }),
    });
    if (!res.ok) {
      if (res.status !== 503 && res.status !== 404) {
        console.warn(`Challenger HTTP ${res.status}`);
      }
      return null;
    }
    const body = (await res.json()) as ChallengerResponse;
    if (!body.route?.geometry?.coordinates?.length) return null;
    return body.route;
  } catch (err) {
    console.warn("Challenger unavailable", err);
    return null;
  }
}

/**
 * Fetch up to three Around-here circuits from the challenger's /loop planner
 * (through-junction turning points, cross-leg reuse penalty, adaptive sizing).
 * Returns [] when the service is down so Mapbox waypoint drawing takes over.
 */
export async function fetchChallengerLoops(
  start: LngLat,
  minutes: number,
  mode: "day" | "night" = "day",
  opts?: { apiBase?: string; prefs?: ChallengerPrefs; maxOptions?: number },
): Promise<ChallengerLoop[]> {
  const path = "/api/challenger-loop";
  const url = opts?.apiBase
    ? `${opts.apiBase.replace(/\/$/, "")}${path}`
    : path;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { lng: start.lng, lat: start.lat },
        minutes,
        mode,
        ...(opts?.prefs ? { prefs: opts.prefs } : {}),
        ...(opts?.maxOptions ? { max_options: opts.maxOptions } : {}),
      }),
    });
    if (!res.ok) {
      if (res.status !== 503 && res.status !== 404) {
        console.warn(`Challenger loop HTTP ${res.status}`);
      }
      return [];
    }
    const body = (await res.json()) as ChallengerLoopsResponse;
    return (body.loops ?? []).filter(
      (l) => l?.geometry?.coordinates?.length,
    );
  } catch (err) {
    console.warn("Challenger loops unavailable", err);
    return [];
  }
}
