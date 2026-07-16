import { fetchWalkingRouteCandidates } from "./directions";
import { pointInCaseyBbox } from "./geo";
import { scoreRouteAgainstSegments } from "./scoreRoute";
import type { LngLat, RankMode, ScoredRoute } from "./types";

export type { RoutePreferences } from "./preferences";
export { sortRoutesByPreferences } from "./preferences";

export async function planScoredRoutes(
  origin: LngLat,
  destination: LngLat,
  segments: GeoJSON.Feature[],
  token: string,
  maxRoutes = 3,
): Promise<ScoredRoute[]> {
  if (!pointInCaseyBbox(origin) || !pointInCaseyBbox(destination)) {
    throw new Error("Origin and destination must be inside the Casey pilot area.");
  }

  const routes = await fetchWalkingRouteCandidates(
    origin,
    destination,
    token,
    maxRoutes,
  );

  return routes.map((r, index) => ({
    id: `route-${index}`,
    index,
    distance_m: r.distance,
    duration_s: r.duration,
    geometry: r.geometry,
    strategy: r.strategy,
    score: scoreRouteAgainstSegments(r.geometry, segments, r.distance),
  }));
}

export function sortRoutes(
  routes: ScoredRoute[],
  mode: RankMode,
): ScoredRoute[] {
  const key =
    mode === "day"
      ? "day_index_score"
      : mode === "night"
        ? "night_index_score"
        : "accessibility_score";

  return [...routes].sort((a, b) => {
    const av = a.score[key];
    const bv = b.score[key];
    if (av == null && bv == null) return a.distance_m - b.distance_m;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
}
