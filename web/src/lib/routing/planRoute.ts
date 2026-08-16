import {
  isChallengerPathSafe,
  mapboxLooksCentreline,
  nudgeGeometryTowardSidewalk,
} from "./carriageway";
import { fetchChallengerRoute, type ChallengerRoute } from "./challenger";
import {
  fetchWalkingRouteCandidates,
  MAX_DETOUR_RATIO,
  MAX_DETOUR_RATIO_AWAY,
  type MapboxRoute,
} from "./directions";
import { pointInCaseyBbox } from "./geo";
import { isScoreAwareStrategy, type RoutePreferences } from "./preferences";
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
    centreline_look_share?: number;
    paint_nudged?: boolean;
    complement_stream?: ScoredRoute["complement_stream"];
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
    centreline_look_share: r.centreline_look_share,
    paint_nudged: r.paint_nudged,
    complement_stream: r.complement_stream,
    score: scoreRouteAgainstSegments(r.geometry, segments, r.distance_m),
  };
}

/**
 * Hybrid trip mode: Mapbox walking candidates + dual Casey cards
 * (preference-best + other pathish corridor). Challenger is retained
 * when distinct even if that means dropping a Mapbox alt.
 *
 * Track 0: Mapbox polylines are sidewalk-nudged when Streets shows a centreline
 * footway with a mapped sidewalk farther out (OD-12 Liara pattern).
 */
export async function planScoredRoutes(
  origin: LngLat,
  destination: LngLat,
  segments: GeoJSON.Feature[],
  token: string,
  maxRoutes = 3,
  mode: "day" | "night" = "day",
  prefs?: RoutePreferences,
  opts?: { challengerApiBase?: string },
): Promise<ScoredRoute[]> {
  if (!pointInCaseyBbox(origin) || !pointInCaseyBbox(destination)) {
    throw new Error("Origin and destination must be inside the Casey pilot area.");
  }

  const preferAway = Boolean(prefs?.preferSharedPaths);
  const streamPrefs = prefs
    ? {
        accessibility: prefs.accessibility,
        shadeHeat: prefs.shadeHeat,
        afterDark: prefs.afterDark,
      }
    : undefined;
  const fetchOpts = opts?.challengerApiBase
    ? { apiBase: opts.challengerApiBase }
    : {};

  const [mapboxRaw, challenger, complementCh, awayChallenger] = await Promise.all([
    fetchWalkingRouteCandidates(origin, destination, token, maxRoutes, {
      maxDetourRatio: preferAway ? MAX_DETOUR_RATIO_AWAY : MAX_DETOUR_RATIO,
    }),
    fetchChallengerRoute(origin, destination, mode, {
      prefs: streamPrefs,
      ...fetchOpts,
    }),
    streamPrefs
      ? fetchChallengerRoute(origin, destination, mode, {
          prefs: { ...streamPrefs, complement: true },
          ...fetchOpts,
        })
      : Promise.resolve(null),
    preferAway
      ? fetchChallengerRoute(origin, destination, mode, {
          prefs: { ...streamPrefs, preferSharedPaths: true },
          ...fetchOpts,
        })
      : Promise.resolve(null),
  ]);

  await yieldToUi();

  const mapbox: MapboxRoute[] = mapboxRaw;
  const scored: ScoredRoute[] = [];
  let mapboxNeededNudge = false;

  for (let i = 0; i < mapbox.length; i++) {
    const r = mapbox[i]!;
    const nudged = await nudgeGeometryTowardSidewalk(r.geometry, token);
    if (nudged.nudged_share > 0) mapboxNeededNudge = true;
    scored.push(
      toScored(
        {
          distance_m: r.distance,
          duration_s: r.duration,
          geometry: nudged.geometry,
          strategy: r.strategy,
          centreline_look_share: nudged.centreline_look_share,
          paint_nudged: nudged.nudged_share > 0,
        },
        i,
        segments,
        "mapbox",
      ),
    );
    await yieldToUi();
  }

  const caseyExisting = () =>
    scored
      .filter((r) => isScoreAwareStrategy(r.strategy))
      .map((r) => ({
        geometry: r.geometry,
        distance_m: r.distance_m,
      }));

  const tryMergeChallenger = async (
    candidate: ChallengerRoute | null,
    idPrefix: string,
  ): Promise<ScoredRoute | null> => {
    if (!candidate) return null;
    // Dedupe Casey only against other Casey cards. A Mapbox lookalike
    // must not hide Bellevue / Fieldhouse; that Mapbox is dropped below.
    if (
      !isGeometryDistinct(
        candidate.geometry,
        candidate.distance_m,
        caseyExisting(),
      )
    ) {
      return null;
    }
    if (!(await isChallengerPathSafe(candidate, token))) return null;
    // Same Track 0 paint treatment as Mapbox: OSM ways without separate
    // sidewalk geometry draw at the road centreline (OD-12 Homestead Rd).
    const saNudged = await nudgeGeometryTowardSidewalk(
      candidate.geometry,
      token,
    );
    const sa = toScored(
      {
        distance_m: candidate.distance_m,
        duration_s: candidate.duration_s,
        geometry: saNudged.geometry,
        strategy: candidate.strategy,
        centreline_look_share: saNudged.centreline_look_share,
        paint_nudged: saNudged.nudged_share > 0,
        complement_stream: candidate.complement_stream,
      },
      scored.length,
      segments,
      idPrefix,
    );
    await yieldToUi();
    scored.push(sa);
    return sa;
  };

  // Preference-best, then the other pathish corridor, then away-from-roads
  // (only if the resident asked). Cap 3; Mapbox only if room and path-safe.
  const def = await tryMergeChallenger(challenger, "score-aware");
  const complement = await tryMergeChallenger(
    complementCh,
    "score-aware-complement",
  );
  const away = await tryMergeChallenger(awayChallenger, "score-aware-away");
  const extras = [def, complement, away].filter(
    (r): r is ScoredRoute => r != null,
  );
  if (!extras.length) {
    return scored.slice(0, maxRoutes).map((r, i) => ({ ...r, index: i }));
  }

  // Casey is already on the footpath network. Hide Mapbox that still reads
  // as a mid-carriageway walk (OD-12 Homestead). Keep Mapbox when it is a
  // genuinely path-safe different corridor (OD-CARRIAGE-01), or when Casey
  // is absent (last resort above).
  const mapboxCards = scored
    .filter((r) => !extras.includes(r))
    .filter((r) => !mapboxLooksCentreline(r))
    .filter((r) =>
      isGeometryDistinct(
        r.geometry,
        r.distance_m,
        extras.map((e) => ({
          geometry: e.geometry,
          distance_m: e.distance_m,
        })),
      ),
    );
  const mapboxKeep = Math.max(0, maxRoutes - extras.length);
  // When Mapbox paint was centreline-ambiguous, lead with score-aware so
  // Recommended defaults to the path-safer line before preference sort.
  // Prefer-away leads with the off-road variant the resident asked for.
  const lead =
    preferAway && away
      ? [away, ...extras.filter((r) => r !== away)]
      : extras;
  const merged = mapboxNeededNudge || preferAway
    ? [...lead, ...mapboxCards.slice(0, mapboxKeep)]
    : [...mapboxCards.slice(0, mapboxKeep), ...lead];
  return merged.slice(0, maxRoutes).map((r, i) => ({ ...r, index: i, id: r.id }));
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
