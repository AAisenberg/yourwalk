import {
  isMostlyOffCarriageway,
  roadCarriagewayShare,
} from "./carriageway";
import type { LngLat } from "./types";

export type MapboxRoute = {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  /** How this candidate was requested (for QA / labels). */
  strategy: string;
  /** Optional: share of samples on road carriageway (0–1). */
  carriageway_share?: number;
};

type MapboxDirectionsResponse = {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: GeoJSON.LineString;
  }>;
};

type QueryOpts = {
  alternatives?: boolean;
  walkwayBias?: number;
  strategy: string;
};

/** Reject trip candidates longer than this × shortest (ADR-001 trip mode). */
export const MAX_DETOUR_RATIO = 1.3;
/** When Prefer away from roads is on — admits park/trail options (~1.4× OD-12). */
export const MAX_DETOUR_RATIO_AWAY = 1.6;

/**
 * Trip mode: generate up to `maxRoutes` sensible walking geometries.
 *
 * Prefers walkways / paths (high walkway_bias). Does **not** request
 * walkway_bias &lt; 0 — that produced carriageway centreline options.
 * Overlong and on-road candidates are filtered after collection.
 */
export async function fetchWalkingRouteCandidates(
  origin: LngLat,
  destination: LngLat,
  token: string,
  maxRoutes = 3,
  opts?: { maxDetourRatio?: number },
): Promise<MapboxRoute[]> {
  const collected: MapboxRoute[] = [];
  const detourRatio = opts?.maxDetourRatio ?? MAX_DETOUR_RATIO;

  // Path-safe diversity:
  // - alternatives (no bias) often returns a distinct footpath geometry
  // - walkway_prefer nudges another path-aligned option
  // Never use walkway_bias < 0 — that favoured road carriageways (Epsom→Arubi).
  // Carriageway tilequery filter below rejects any residual on-road geometry.
  const queries: QueryOpts[] = [
    { alternatives: true, strategy: "alternatives" },
    { walkwayBias: 0.8, strategy: "walkway_prefer" },
  ];

  await runQueries(origin, destination, token, queries, collected, maxRoutes + 3);

  if (!collected.length) {
    throw new Error("No walking routes found between these points.");
  }

  const filtered = filterDetours(collected, detourRatio);
  const offRoad = await filterCarriageways(filtered, token);
  const pool = offRoad.length ? offRoad : await keepLeastCarriageway(filtered, token);

  const distinct: MapboxRoute[] = [];
  for (const route of pool) {
    if (distinct.length >= maxRoutes) break;
    if (!isDistinct(route, distinct)) continue;
    distinct.push(route);
  }

  return distinct.length ? distinct : [pool[0]!];
}

/** @deprecated Use fetchWalkingRouteCandidates */
export async function fetchWalkingRoutes(
  origin: LngLat,
  destination: LngLat,
  token: string,
): Promise<MapboxRoute[]> {
  return fetchWalkingRouteCandidates(origin, destination, token, 3);
}

function filterDetours(
  routes: MapboxRoute[],
  maxRatio: number,
): MapboxRoute[] {
  const shortest = Math.min(...routes.map((r) => r.distance));
  if (!Number.isFinite(shortest) || shortest <= 0) return routes;
  const kept = routes.filter((r) => r.distance <= shortest * maxRatio);
  return kept.length
    ? kept
    : [routes.reduce((a, b) => (a.distance <= b.distance ? a : b))];
}

async function filterCarriageways(
  routes: MapboxRoute[],
  token: string,
): Promise<MapboxRoute[]> {
  const kept: MapboxRoute[] = [];
  for (const route of routes) {
    const share = await roadCarriagewayShare(route.geometry, token);
    // null = Streets tilequery unavailable — keep candidate (walkway_bias already high)
    if (share != null && share > 0.28) continue;
    kept.push({
      ...route,
      carriageway_share: share ?? undefined,
    });
  }
  return kept;
}

/** Last resort: keep the candidate with the lowest carriageway share. */
async function keepLeastCarriageway(
  routes: MapboxRoute[],
  token: string,
): Promise<MapboxRoute[]> {
  const scored: MapboxRoute[] = [];
  for (const route of routes) {
    const share = await roadCarriagewayShare(route.geometry, token);
    scored.push({ ...route, carriageway_share: share ?? 1 });
  }
  scored.sort(
    (a, b) => (a.carriageway_share ?? 1) - (b.carriageway_share ?? 1),
  );
  const best = scored[0];
  return best ? [best] : routes.slice(0, 1);
}

async function runQueries(
  origin: LngLat,
  destination: LngLat,
  token: string,
  queries: QueryOpts[],
  collected: MapboxRoute[],
  maxCollect: number,
): Promise<void> {
  const results = await Promise.all(
    queries.map((q) => requestWalking(origin, destination, token, q)),
  );

  for (const batch of results) {
    for (const route of batch) {
      if (collected.length >= maxCollect) return;
      if (!isDistinct(route, collected)) continue;
      collected.push(route);
    }
  }
}

async function requestWalking(
  origin: LngLat,
  destination: LngLat,
  token: string,
  opts: QueryOpts,
): Promise<MapboxRoute[]> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  return requestWalkingCoords(coords, token, opts);
}

export type WaypointRouteOpts = {
  /**
   * Hard-reject geometries that sit on road carriageways (trip A→B gate).
   * Default **false** for outings: suburban loops must use street-adjacent
   * footpaths; the 0.28 carriageway share test wiped almost all Loop options
   * in places like Montpelier / Berwick (diagnosed 10 Aug 2026).
   */
  carriagewayGate?: boolean;
};

/**
 * Walking route through an ordered waypoint list (e.g. start → A → B → start).
 * Used by Around-here outings — not the trip A→B candidate pool.
 */
export async function fetchWalkingWaypointRoute(
  waypoints: LngLat[],
  token: string,
  strategy: string,
  opts: WaypointRouteOpts = {},
): Promise<MapboxRoute | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const routes = await requestWalkingCoords(coords, token, {
    alternatives: false,
    walkwayBias: 1,
    strategy,
  });
  const route = routes[0];
  if (!route) return null;
  if (opts.carriagewayGate) {
    const ok = await isMostlyOffCarriageway(route.geometry, token);
    if (!ok) return null;
  }
  return route;
}

async function requestWalkingCoords(
  coords: string,
  token: string,
  opts: QueryOpts,
): Promise<MapboxRoute[]> {
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}`,
  );
  url.searchParams.set("alternatives", opts.alternatives ? "true" : "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "false");
  if (opts.walkwayBias != null) {
    url.searchParams.set("walkway_bias", String(opts.walkwayBias));
  }
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(`Directions ${opts.strategy} HTTP ${res.status}`);
    return [];
  }

  const body = (await res.json()) as MapboxDirectionsResponse;
  if (body.code !== "Ok" || !body.routes?.length) return [];

  const limit = opts.alternatives ? 3 : 1;
  return body.routes.slice(0, limit).map((r) => ({
    distance: r.distance,
    duration: r.duration,
    geometry: r.geometry,
    strategy: opts.strategy,
  }));
}

function isDistinct(candidate: MapboxRoute, existing: MapboxRoute[]): boolean {
  for (const other of existing) {
    const distRatio =
      Math.abs(candidate.distance - other.distance) /
      Math.max(candidate.distance, other.distance, 1);

    if (distRatio > 0.22) continue;

    const a = samplePoints(candidate.geometry, 7);
    const b = samplePoints(other.geometry, 7);
    let close = 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.hypot(a[i]![0] - b[i]![0], a[i]![1] - b[i]![1]);
      sum += d;
      if (d < 0.0011) close += 1;
    }
    const avg = sum / a.length;
    if (close >= 5 || avg < 0.0007) return false;
  }
  return true;
}

function samplePoints(
  line: GeoJSON.LineString,
  n: number,
): [number, number][] {
  const coords = line.coordinates;
  if (coords.length === 0) return [];
  if (coords.length === 1) {
    return Array(n).fill(coords[0]) as [number, number][];
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idx = t * (coords.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(coords.length - 1, lo + 1);
    const f = idx - lo;
    const a = coords[lo]!;
    const b = coords[hi]!;
    out.push([a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f]);
  }
  return out;
}
