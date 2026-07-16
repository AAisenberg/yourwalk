import type { ScoredRoute } from "./types";

/**
 * Resident preference weights (0–100), matching mobile-mockup themes.
 * These rank existing trip geometries — they do not generate new paths.
 */
export type RoutePreferences = {
  /** Safety after dark → Night Index */
  afterDark: number;
  /** Accessible footpaths → Accessibility */
  accessibility: number;
  /** Shade & heat comfort → Day Index (includes heat/shade stream) */
  shadeHeat: number;
};

export const DEFAULT_PREFS_DAY: RoutePreferences = {
  afterDark: 35,
  accessibility: 60,
  shadeHeat: 85,
};

export const DEFAULT_PREFS_NIGHT: RoutePreferences = {
  afterDark: 92,
  accessibility: 55,
  shadeHeat: 25,
};

/**
 * How strongly trip time/distance pulls against preference score.
 * 0 = prefs only; 1 = equal weight to a normalised duration penalty.
 */
export const TRIP_EFFICIENCY_WEIGHT = 0.35;

/** Preference-weighted score 0–100 (higher = better for this user). */
export function preferenceScore(
  route: ScoredRoute,
  prefs: RoutePreferences,
): number | null {
  const parts: { score: number; w: number }[] = [];
  if (route.score.night_index_score != null) {
    parts.push({ score: route.score.night_index_score, w: prefs.afterDark });
  }
  if (route.score.accessibility_score != null) {
    parts.push({
      score: route.score.accessibility_score,
      w: prefs.accessibility,
    });
  }
  if (route.score.day_index_score != null) {
    parts.push({ score: route.score.day_index_score, w: prefs.shadeHeat });
  }
  if (!parts.length) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  if (wSum <= 0) return null;
  return parts.reduce((s, p) => s + p.score * p.w, 0) / wSum;
}

/**
 * Trip-mode ranking score: preference quality minus a duration penalty
 * relative to the shortest candidate (0–100 scale).
 */
export function tripRankScore(
  route: ScoredRoute,
  prefs: RoutePreferences,
  shortestDurationS: number,
  efficiencyWeight = TRIP_EFFICIENCY_WEIGHT,
): number | null {
  const pref = preferenceScore(route, prefs);
  if (pref == null) return null;
  if (!Number.isFinite(shortestDurationS) || shortestDurationS <= 0) {
    return pref;
  }
  // 1.0 = shortest; >1 = longer. Cap at detour filter (~1.3).
  const ratio = Math.min(1.5, route.duration_s / shortestDurationS);
  const efficiency = Math.max(0, 100 * (2 - ratio)); // shortest → 100; 1.3× → 70
  const w = Math.min(1, Math.max(0, efficiencyWeight));
  return (1 - w) * pref + w * efficiency;
}

export function sortRoutesByPreferences(
  routes: ScoredRoute[],
  prefs: RoutePreferences,
): ScoredRoute[] {
  if (!routes.length) return [];
  const shortestDuration = Math.min(...routes.map((r) => r.duration_s));
  const shortestDistance = Math.min(...routes.map((r) => r.distance_m));

  return [...routes].sort((a, b) => {
    const av = tripRankScore(a, prefs, shortestDuration);
    const bv = tripRankScore(b, prefs, shortestDuration);
    if (av == null && bv == null) {
      return a.distance_m - b.distance_m;
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (Math.abs(bv - av) > 0.25) return bv - av;
    // Tie-break: closer to shortest distance, then duration
    const da = Math.abs(a.distance_m - shortestDistance);
    const db = Math.abs(b.distance_m - shortestDistance);
    if (Math.abs(da - db) > 1) return da - db;
    return a.duration_s - b.duration_s;
  });
}

export function routeCardLabel(
  route: ScoredRoute,
  ranked: ScoredRoute[],
): string {
  if (ranked[0]?.id === route.id) return "Best for you";
  const shortest = [...ranked].sort((a, b) => a.distance_m - b.distance_m)[0];
  if (shortest?.id === route.id) return "Shortest";
  return "Another option";
}
