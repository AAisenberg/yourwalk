import { isChallengerPathSafe } from "./carriageway";
import { fetchChallengerRoute } from "./challenger";
import {
  fetchWalkingRouteCandidates,
  type MapboxRoute,
} from "./directions";
import { pointInCaseyBbox } from "./geo";
import { scoreRouteAgainstSegments } from "./scoreRoute";
import type { LngLat, RankMode, ScoredRoute } from "./types";

export type { RoutePreferences } from "./preferences";
export { sortRoutesByPreferences } from "./preferences";

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
    const a = coords[lo];
    const b = coords[hi];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

/** Yield so the browser can paint “Calculating…” and avoid kill-page dialogs. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Geometry distinctness — same heuristic as Mapbox candidate dedupe. */
export function isGeometryDistinct(
  candidate: GeoJSON.LineString,
  candidateDistanceM: number,
  existing: { geometry: GeoJSON.LineString; distance_m: number }[],
): boolean {
  for (const other of existing) {
    const distRatio =
      Math.abs(candidateDistanceM - other.distance_m) /
      Math.max(candidateDistanceM, other.distance_m, 1);

    if (distRatio > 0.22) continue;

    const a = samplePoints(candidate, 7);
    const b = samplePoints(other.geometry, 7);
    let close = 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
      sum += d;
      if (d < 0.0011) close += 1;
    }
    const avg = sum / a.length;
    if (close >= 5 || avg < 0.0007) return false;
  }
  return true;
}

function toScored(
  r: {
    distance_m: number;
    duration_s: number;
    geometry: GeoJSON.LineString;
    strategy?: string;
  },
  index: number,
  segments: GeoJSON.Feature[],
  idPrefix = "route",
): ScoredRoute {
  return {
    id: `${idPrefix}-${index}`,
    index,
    distance_m: r.distance_m,
    duration_s: r.duration_s,
    geometry: r.geometry,
    strategy: r.strategy,
    score: scoreRouteAgainstSegments(r.geometry, segments, r.distance_m),
  };
}

/**
 * Hybrid trip mode: Mapbox walking candidates + distinct score-aware path.
 * Challenger is retained when distinct even if that means dropping a Mapbox alt.
 */
export async function planScoredRoutes(
  origin: LngLat,
  destination: LngLat,
  segments: GeoJSON.Feature[],
  token: string,
  maxRoutes = 3,
  mode: "day" | "night" = "day",
): Promise<ScoredRoute[]> {
  if (!pointInCaseyBbox(origin) || !pointInCaseyBbox(destination)) {
    throw new Error("Origin and destination must be inside the Casey pilot area.");
  }

  const [mapboxRaw, challenger] = await Promise.all([
    fetchWalkingRouteCandidates(origin, destination, token, maxRoutes),
    fetchChallengerRoute(origin, destination, mode),
  ]);

  await yieldToUi();

  const mapbox: MapboxRoute[] = mapboxRaw;
  const scored: ScoredRoute[] = [];
  for (let i = 0; i < mapbox.length; i++) {
    const r = mapbox[i];
    scored.push(
      toScored(
        {
          distance_m: r.distance,
          duration_s: r.duration,
          geometry: r.geometry,
          strategy: r.strategy,
        },
        i,
        segments,
        "mapbox",
      ),
    );
    await yieldToUi();
  }

  if (
    challenger &&
    isGeometryDistinct(
      challenger.geometry,
      challenger.distance_m,
      scored.map((r) => ({
        geometry: r.geometry,
        distance_m: r.distance_m,
      })),
    ) &&
    (await isChallengerPathSafe(challenger, token))
  ) {
    const sa = toScored(
      {
        distance_m: challenger.distance_m,
        duration_s: challenger.duration_s,
        geometry: challenger.geometry,
        strategy: challenger.strategy,
      },
      scored.length,
      segments,
      "score-aware",
    );
    await yieldToUi();
    const mapboxKeep = Math.max(0, maxRoutes - 1);
    const merged = [...scored.slice(0, mapboxKeep), sa];
    return merged.map((r, i) => ({ ...r, index: i, id: r.id }));
  }

  return scored.slice(0, maxRoutes).map((r, i) => ({ ...r, index: i }));
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
