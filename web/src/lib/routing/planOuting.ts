import { fetchWalkingRouteCandidates } from "./directions";
import { pointInCaseyBbox } from "./geo";
import { sortRoutesByPreferences, type RoutePreferences } from "./preferences";
import { scoreRouteAgainstSegments } from "./scoreRoute";
import type { LngLat, ScoredRoute } from "./types";

/** Rough walk speed for outing radius (m/min). */
const WALK_M_PER_MIN = 75;

const BEARINGS_DEG = [30, 90, 150, 210, 270, 330];

function destinationAt(
  start: LngLat,
  distanceM: number,
  bearingDeg: number,
): LngLat {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lng1 = (start.lng * Math.PI) / 180;
  const ang = distanceM / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) +
      Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * Around-here outing (testing slice): one-way walks of about `durationMin`
 * in several directions, scored and ranked like trip mode.
 * Not a true loop yet — see FLOWS/02 OQ-1.
 */
export async function planOutingRoutes(
  start: LngLat,
  durationMin: number,
  segments: GeoJSON.Feature[],
  token: string,
  mode: "day" | "night",
  prefs: RoutePreferences,
  maxRoutes = 3,
): Promise<ScoredRoute[]> {
  if (!pointInCaseyBbox(start)) {
    throw new Error("Start must be inside the Casey pilot area.");
  }
  const targetM = Math.max(400, durationMin * WALK_M_PER_MIN);
  const targetDurationS = durationMin * 60;
  const collected: ScoredRoute[] = [];

  for (const bearing of BEARINGS_DEG) {
    const dest = destinationAt(start, targetM, bearing);
    if (!pointInCaseyBbox(dest)) continue;
    try {
      const routes = await fetchWalkingRouteCandidates(
        start,
        dest,
        token,
        1,
      );
      for (const r of routes) {
        const ratio = r.duration / targetDurationS;
        if (ratio < 0.55 || ratio > 1.45) continue;
        const scored: ScoredRoute = {
          id: `outing-${bearing}-${collected.length}`,
          index: collected.length,
          distance_m: r.distance,
          duration_s: r.duration,
          geometry: r.geometry,
          strategy: `outing_${bearing}`,
          score: scoreRouteAgainstSegments(
            r.geometry,
            segments,
            r.distance,
          ),
        };
        const dup = collected.some(
          (c) =>
            Math.abs(c.distance_m - scored.distance_m) /
              Math.max(c.distance_m, 1) <
              0.12 &&
            Math.abs(c.duration_s - scored.duration_s) < 120,
        );
        if (!dup) collected.push(scored);
      }
    } catch {
      // skip failed bearing
    }
    await yieldToUi();
    if (collected.length >= maxRoutes + 2) break;
  }

  // Also try score-aware toward the best Mapbox outing end if we have one
  if (collected[0]) {
    try {
      const { fetchChallengerRoute } = await import("./challenger");
      const end = collected[0].geometry.coordinates.at(-1);
      if (end) {
        const ch = await fetchChallengerRoute(
          start,
          { lng: end[0], lat: end[1] },
          mode,
        );
        if (ch) {
          const ratio = ch.duration_s / targetDurationS;
          if (ratio >= 0.55 && ratio <= 1.45) {
            collected.push({
              id: "outing-score-aware",
              index: collected.length,
              distance_m: ch.distance_m,
              duration_s: ch.duration_s,
              geometry: ch.geometry,
              strategy: ch.strategy,
              score: scoreRouteAgainstSegments(
                ch.geometry,
                segments,
                ch.distance_m,
              ),
            });
          }
        }
      }
    } catch {
      // challenger optional
    }
  }

  if (!collected.length) {
    throw new Error(
      "Couldn’t find walks of about that length from this start. Try another spot or duration.",
    );
  }

  return sortRoutesByPreferences(collected, prefs, mode)
    .slice(0, maxRoutes)
    .map((r, i) => ({ ...r, index: i, id: r.id }));
}

export const OUTING_DURATIONS_MIN = [15, 25, 40] as const;
export type OutingDurationMin = (typeof OUTING_DURATIONS_MIN)[number];
