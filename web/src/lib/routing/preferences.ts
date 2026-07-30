import type { ScoredRoute } from "./types";

export type WalkMode = "day" | "night";

/**
 * Resident preference **importance** weights (not Casey scores).
 *
 * Scale: 0–100 = relative importance when ranking trip options.
 * - Day uses Accessibility + Shade/heat (Day Index)
 * - Night uses Accessibility + After dark (Night Index)
 * Card scores (/10) stay Casey corridor scores; prefs only re-order options.
 *
 * Prefs do not generate new geometries (except via hybrid challenger pathfinding
 * later). Guardrail: active-mode weights are floored so ranking never collapses.
 */
export type RoutePreferences = {
  /** Safety after dark → Night Index (night mode only) */
  afterDark: number;
  /** Accessible footpaths → Accessibility (both modes) */
  accessibility: number;
  /** Shade & heat comfort → Day Index (day mode only) */
  shadeHeat: number;
};

/** Slider floor — “not important” is low, never a silent zero that drops ranking. */
export const PREF_IMPORTANCE_MIN = 10;
export const PREF_IMPORTANCE_MAX = 100;

/** Methodology fallback when active prefs somehow sum to zero (60/40 v1.1). */
export const METHODOLOGY_FALLBACK_PREFS_DAY: RoutePreferences = {
  afterDark: 0,
  accessibility: 60,
  shadeHeat: 40,
};

export const METHODOLOGY_FALLBACK_PREFS_NIGHT: RoutePreferences = {
  afterDark: 40,
  accessibility: 60,
  shadeHeat: 0,
};

export const DEFAULT_PREFS_DAY: RoutePreferences = {
  afterDark: 0,
  accessibility: 60,
  shadeHeat: 85,
};

export const DEFAULT_PREFS_NIGHT: RoutePreferences = {
  afterDark: 92,
  accessibility: 55,
  shadeHeat: 0,
};

/**
 * Efficiency (time/distance) share of the match score, keyed off how important
 * the resident marked the active preference sliders:
 * - Sliders at floor (“less important”) → efficiency dominates (~78%)
 * - Sliders at max (“more important”) → prefs dominate; soft time (~15%)
 *
 * No separate time slider: low importance *is* the cue to favour a quicker walk.
 */
export const EFFICIENCY_WEIGHT_AT_LOW_IMPORTANCE = 0.78;
export const EFFICIENCY_WEIGHT_AT_HIGH_IMPORTANCE = 0.15;

/** @deprecated Use efficiencyWeightForPrefs — kept for call sites / docs. */
export const TRIP_EFFICIENCY_WEIGHT = EFFICIENCY_WEIGHT_AT_HIGH_IMPORTANCE;

export function clampImportance(v: number): number {
  if (!Number.isFinite(v)) return PREF_IMPORTANCE_MIN;
  return Math.min(
    PREF_IMPORTANCE_MAX,
    Math.max(PREF_IMPORTANCE_MIN, Math.round(v)),
  );
}

/**
 * Active-mode importance only. Floors each active slider and, if the sum is
 * still zero, restores methodology 60/40 so cards always rank.
 */
export function effectivePrefsForMode(
  prefs: RoutePreferences,
  mode: WalkMode,
): RoutePreferences {
  if (mode === "day") {
    const accessibility = clampImportance(prefs.accessibility);
    const shadeHeat = clampImportance(prefs.shadeHeat);
    if (accessibility + shadeHeat <= 0) {
      return { ...METHODOLOGY_FALLBACK_PREFS_DAY };
    }
    return { afterDark: 0, accessibility, shadeHeat };
  }
  const accessibility = clampImportance(prefs.accessibility);
  const afterDark = clampImportance(prefs.afterDark);
  if (accessibility + afterDark <= 0) {
    return { ...METHODOLOGY_FALLBACK_PREFS_NIGHT };
  }
  return { afterDark, accessibility, shadeHeat: 0 };
}

/** Mean importance of sliders active in this walk mode (10–100). */
export function meanActiveImportance(
  prefs: RoutePreferences,
  mode: WalkMode,
): number {
  const w = effectivePrefsForMode(prefs, mode);
  if (mode === "day") {
    return (w.accessibility + w.shadeHeat) / 2;
  }
  return (w.accessibility + w.afterDark) / 2;
}

/**
 * Map mean preference importance → efficiency weight.
 * Low importance ⇒ quicker walks win; high importance ⇒ better corridors win.
 */
export function efficiencyWeightForPrefs(
  prefs: RoutePreferences,
  mode: WalkMode,
): number {
  const mean = meanActiveImportance(prefs, mode);
  const t =
    (mean - PREF_IMPORTANCE_MIN) /
    Math.max(1, PREF_IMPORTANCE_MAX - PREF_IMPORTANCE_MIN);
  const clamped = Math.min(1, Math.max(0, t));
  return (
    EFFICIENCY_WEIGHT_AT_LOW_IMPORTANCE * (1 - clamped) +
    EFFICIENCY_WEIGHT_AT_HIGH_IMPORTANCE * clamped
  );
}

/** Preference-weighted quality 0–100 (higher = better for this user). */
export function preferenceScore(
  route: ScoredRoute,
  prefs: RoutePreferences,
  mode: WalkMode = "day",
): number | null {
  const wprefs = effectivePrefsForMode(prefs, mode);
  const parts: { score: number; w: number }[] = [];

  if (route.score.accessibility_score != null && wprefs.accessibility > 0) {
    parts.push({
      score: route.score.accessibility_score,
      w: wprefs.accessibility,
    });
  }

  if (mode === "day") {
    if (route.score.day_index_score != null && wprefs.shadeHeat > 0) {
      parts.push({ score: route.score.day_index_score, w: wprefs.shadeHeat });
    }
  } else if (route.score.night_index_score != null && wprefs.afterDark > 0) {
    parts.push({ score: route.score.night_index_score, w: wprefs.afterDark });
  }

  if (!parts.length) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  if (wSum <= 0) return null;
  return parts.reduce((s, p) => s + p.score * p.w, 0) / wSum;
}

/**
 * Trip-mode ranking score: preference quality blended with duration efficiency
 * (0–100). Efficiency weight rises when preference importance is low.
 */
export function tripRankScore(
  route: ScoredRoute,
  prefs: RoutePreferences,
  shortestDurationS: number,
  mode: WalkMode = "day",
  efficiencyWeight?: number,
): number | null {
  const pref = preferenceScore(route, prefs, mode);
  if (pref == null) return null;
  if (!Number.isFinite(shortestDurationS) || shortestDurationS <= 0) {
    return pref;
  }
  // Soft efficiency: shortest → 100; 1.15× → ~92.5; 1.3× → 85
  const ratio = Math.min(1.5, route.duration_s / shortestDurationS);
  const efficiency = Math.max(0, 100 * (1 - 0.5 * (ratio - 1)));
  const w = Math.min(
    1,
    Math.max(0, efficiencyWeight ?? efficiencyWeightForPrefs(prefs, mode)),
  );
  return (1 - w) * pref + w * efficiency;
}

/** Dominant corridor stream for tiebreaks (highest importance slider in mode). */
function primaryStreamScore(
  route: ScoredRoute,
  prefs: RoutePreferences,
  mode: WalkMode,
): number | null {
  const w = effectivePrefsForMode(prefs, mode);
  if (mode === "night") {
    if (w.afterDark >= w.accessibility) {
      return route.score.night_index_score;
    }
    return route.score.accessibility_score;
  }
  if (w.shadeHeat >= w.accessibility) {
    return route.score.day_index_score;
  }
  return route.score.accessibility_score;
}

function cmpNullableDesc(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

/**
 * Rank trip cards for the resident.
 *
 * 1. Match score (importance-weighted quality + dynamic efficiency)
 * 2. Preference-only quality (tiebreak — respects After dark / shade / footpaths)
 * 3. Dominant preference stream (e.g. After dark when that slider is highest)
 * 4. Shorter duration, then distance
 *
 * Do **not** fuzzy-tie match scores: a 0.25 band on the 0–100 scale made
 * display 7.8 vs 7.9 look inverted while Recommended followed the quicker walk.
 */
export function sortRoutesByPreferences(
  routes: ScoredRoute[],
  prefs: RoutePreferences,
  mode: WalkMode = "day",
): ScoredRoute[] {
  if (!routes.length) return [];
  const shortestDuration = Math.min(...routes.map((r) => r.duration_s));
  const effW = efficiencyWeightForPrefs(prefs, mode);

  return [...routes].sort((a, b) => {
    const av = tripRankScore(a, prefs, shortestDuration, mode, effW);
    const bv = tripRankScore(b, prefs, shortestDuration, mode, effW);
    const byMatch = cmpNullableDesc(av, bv);
    if (byMatch !== 0) return byMatch;

    const byPref = cmpNullableDesc(
      preferenceScore(a, prefs, mode),
      preferenceScore(b, prefs, mode),
    );
    if (byPref !== 0) return byPref;

    const byStream = cmpNullableDesc(
      primaryStreamScore(a, prefs, mode),
      primaryStreamScore(b, prefs, mode),
    );
    if (byStream !== 0) return byStream;

    if (a.duration_s !== b.duration_s) return a.duration_s - b.duration_s;
    return a.distance_m - b.distance_m;
  });
}

export function isScoreAwareStrategy(strategy?: string): boolean {
  return Boolean(strategy?.startsWith("score_aware") || strategy?.startsWith("distance_"));
}

export function routeCardLabel(
  route: ScoredRoute,
  ranked: ScoredRoute[],
): string {
  if (ranked[0]?.id === route.id) return "Best for you";
  if (isScoreAwareStrategy(route.strategy)) return "Neighbourhood links";
  const shortest = [...ranked].sort((a, b) => a.distance_m - b.distance_m)[0];
  if (shortest?.id === route.id) return "Shortest";
  return "Another option";
}

/** Short supporting line under the card title. */
export function routeCardBlurb(
  route: ScoredRoute,
  ranked: ScoredRoute[],
): string {
  if (ranked[0]?.id === route.id) {
    return "Best match for your importance ratings and how quick the walk is";
  }
  if (isScoreAwareStrategy(route.strategy)) {
    return "Uses local paths and cut-throughs scored from Casey footpaths";
  }
  if (ranked.length === 1) {
    return "Only one sensible trip found for these points";
  }
  return "Another walking option between your places";
}
