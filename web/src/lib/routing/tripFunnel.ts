/**
 * A→B candidate funnel diagnostics — where options die before the UI.
 * Does not change resident ranking; investigation only.
 */
import { fetchChallengerRoute } from "./challenger";
import {
  challengerOsmPathishOk,
  isChallengerPathSafe,
  mapboxLooksCentreline,
  nudgeGeometryTowardSidewalk,
  roadCarriagewayShare,
} from "./carriageway";
import {
  MAX_DETOUR_RATIO,
  MAX_DETOUR_RATIO_AWAY,
  type MapboxRoute,
} from "./directions";
import { isGeometryDistinct } from "./planRoute";
import type { LngLat } from "./types";

export type FunnelCandidate = {
  strategy: string;
  distance_m: number;
  duration_s: number;
  carriageway_share?: number | null;
};

export type TripFunnelReport = {
  id: string;
  label: string;
  origin: LngLat;
  destination: LngLat;
  mode: "day" | "night";
  stages: {
    mapbox_raw: number;
    after_detour: number;
    after_carriageway: number;
    after_mapbox_distinct: number;
    challenger_available: boolean;
    challenger_kept: boolean;
    final_cards: number;
  };
  dropped_detour: FunnelCandidate[];
  dropped_carriageway: FunnelCandidate[];
  mapbox_kept: FunnelCandidate[];
  challenger: {
    available: boolean;
    kept: boolean;
    reason?: string;
    distance_m?: number;
    duration_s?: number;
    strategy?: string;
  };
  final: FunnelCandidate[];
};

type QueryOpts = {
  alternatives?: boolean;
  walkwayBias?: number;
  strategy: string;
};

function summarise(r: MapboxRoute): FunnelCandidate {
  return {
    strategy: r.strategy,
    distance_m: Math.round(r.distance),
    duration_s: Math.round(r.duration),
    carriageway_share:
      r.carriageway_share == null
        ? null
        : Math.round(r.carriageway_share * 100) / 100,
  };
}

async function requestWalking(
  origin: LngLat,
  destination: LngLat,
  token: string,
  opts: QueryOpts,
): Promise<MapboxRoute[]> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
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
  if (!res.ok) return [];
  const body = (await res.json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: GeoJSON.LineString;
    }>;
  };
  if (body.code !== "Ok" || !body.routes?.length) return [];
  const limit = opts.alternatives ? 3 : 1;
  return body.routes.slice(0, limit).map((r) => ({
    distance: r.distance,
    duration: r.duration,
    geometry: r.geometry,
    strategy: opts.strategy,
  }));
}

function isDistinctMapbox(
  candidate: MapboxRoute,
  existing: MapboxRoute[],
): boolean {
  return isGeometryDistinct(
    candidate.geometry,
    candidate.distance,
    existing.map((r) => ({
      geometry: r.geometry,
      distance_m: r.distance,
    })),
  );
}

/**
 * Mirror of fetchWalkingRouteCandidates + planScoredRoutes merge, with
 * stage counts and drop reasons for investigation.
 */
export async function diagnoseTripRouteFunnel(opts: {
  id: string;
  label: string;
  origin: LngLat;
  destination: LngLat;
  token: string;
  mode?: "day" | "night";
  maxRoutes?: number;
  /** Absolute app origin for Node scripts (challenger proxy). */
  apiBase?: string;
  /** Preference blend for score-aware pathfinding (P2). */
  prefs?: {
    accessibility?: number;
    shadeHeat?: number;
    afterDark?: number;
    preferSharedPaths?: boolean;
  };
}): Promise<TripFunnelReport> {
  const {
    id,
    label,
    origin,
    destination,
    token,
    mode = "day",
    maxRoutes = 3,
    apiBase,
    prefs,
  } = opts;

  const queries: QueryOpts[] = [
    { alternatives: true, strategy: "alternatives" },
    { walkwayBias: 0.8, strategy: "walkway_prefer" },
  ];

  const collected: MapboxRoute[] = [];
  const batches = await Promise.all(
    queries.map((q) => requestWalking(origin, destination, token, q)),
  );
  for (const batch of batches) {
    for (const route of batch) {
      if (collected.length >= maxRoutes + 3) break;
      if (!isDistinctMapbox(route, collected)) continue;
      collected.push(route);
    }
  }

  if (!collected.length) {
    const challengerEmpty = await fetchChallengerRoute(
      origin,
      destination,
      mode,
      {
        ...(apiBase ? { apiBase } : {}),
        ...(prefs ? { prefs } : {}),
      },
    );
    return {
      id,
      label,
      origin,
      destination,
      mode,
      stages: {
        mapbox_raw: 0,
        after_detour: 0,
        after_carriageway: 0,
        after_mapbox_distinct: 0,
        challenger_available: Boolean(challengerEmpty),
        challenger_kept: false,
        final_cards: 0,
      },
      dropped_detour: [],
      dropped_carriageway: [],
      mapbox_kept: [],
      challenger: {
        available: Boolean(challengerEmpty),
        kept: false,
        reason: challengerEmpty ? "mapbox_empty" : "unavailable_or_empty",
        distance_m: challengerEmpty
          ? Math.round(challengerEmpty.distance_m)
          : undefined,
      },
      final: [],
    };
  }

  const detourRatio = prefs?.preferSharedPaths
    ? MAX_DETOUR_RATIO_AWAY
    : MAX_DETOUR_RATIO;
  const shortest = Math.min(...collected.map((r) => r.distance));
  const afterDetour = collected.filter(
    (r) =>
      !Number.isFinite(shortest) ||
      shortest <= 0 ||
      r.distance <= shortest * detourRatio,
  );
  const droppedDetour = collected
    .filter((r) => !afterDetour.includes(r))
    .map(summarise);

  const afterCarriageway: MapboxRoute[] = [];
  const droppedCarriageway: FunnelCandidate[] = [];
  for (const route of afterDetour) {
    const share = await roadCarriagewayShare(route.geometry, token);
    const withShare = {
      ...route,
      carriageway_share: share ?? undefined,
    };
    if (share != null && share > 0.28) {
      droppedCarriageway.push(summarise(withShare));
      continue;
    }
    afterCarriageway.push(withShare);
  }

  let pool = afterCarriageway;
  if (!pool.length && afterDetour.length) {
    // Same last-resort as production: least carriageway
    const scored: MapboxRoute[] = [];
    for (const route of afterDetour) {
      const share = await roadCarriagewayShare(route.geometry, token);
      scored.push({ ...route, carriageway_share: share ?? 1 });
    }
    scored.sort(
      (a, b) => (a.carriageway_share ?? 1) - (b.carriageway_share ?? 1),
    );
    pool = scored[0] ? [scored[0]] : afterDetour.slice(0, 1);
  }

  const mapboxDistinct: MapboxRoute[] = [];
  for (const route of pool) {
    if (mapboxDistinct.length >= maxRoutes) break;
    if (!isDistinctMapbox(route, mapboxDistinct)) continue;
    mapboxDistinct.push(route);
  }
  if (!mapboxDistinct.length && pool[0]) mapboxDistinct.push(pool[0]);

  const challenger = await fetchChallengerRoute(
    origin,
    destination,
    mode,
    {
      ...(apiBase ? { apiBase } : {}),
      ...(prefs ? { prefs } : {}),
    },
  );
  let challengerKept = false;
  let challengerReason: string | undefined;
  let challengerSummary: TripFunnelReport["challenger"] = {
    available: Boolean(challenger),
    kept: false,
  };

  const finalRoutes: FunnelCandidate[] = mapboxDistinct.map(summarise);

  if (!challenger) {
    challengerReason = "unavailable_or_empty";
    challengerSummary.reason = challengerReason;
  } else {
    const distinct = isGeometryDistinct(
      challenger.geometry,
      challenger.distance_m,
      mapboxDistinct.map((r) => ({
        geometry: r.geometry,
        distance_m: r.distance,
      })),
    );
    if (!distinct) {
      challengerReason = "not_geometrically_distinct";
      challengerSummary = {
        available: true,
        kept: false,
        reason: challengerReason,
        distance_m: Math.round(challenger.distance_m),
        duration_s: Math.round(challenger.duration_s),
        strategy: challenger.strategy,
      };
    } else {
      const osmOk = challengerOsmPathishOk(challenger.osm_pathish_share);
      const offRoad = await isChallengerPathSafe(challenger, token);
      if (!offRoad) {
        challengerReason =
          osmOk === false
            ? "failed_osm_and_streets_gates"
            : "failed_carriageway_gate";
        challengerSummary = {
          available: true,
          kept: false,
          reason: challengerReason,
          distance_m: Math.round(challenger.distance_m),
          duration_s: Math.round(challenger.duration_s),
          strategy: challenger.strategy,
        };
      } else {
        challengerKept = true;
        challengerSummary = {
          available: true,
          kept: true,
          reason: "merged",
          distance_m: Math.round(challenger.distance_m),
          duration_s: Math.round(challenger.duration_s),
          strategy: challenger.strategy,
        };
        // Same as planRoute: drop Mapbox that still looks mid-road once Casey
        // is on the footpath (OD-12 Homestead). Path-safe Mapbox alts stay.
        const mapboxHonest: FunnelCandidate[] = [];
        for (const r of mapboxDistinct) {
          const nudged = await nudgeGeometryTowardSidewalk(r.geometry, token);
          if (mapboxLooksCentreline(nudged)) continue;
          mapboxHonest.push(summarise(r));
        }
        const mapboxKeep = Math.max(0, maxRoutes - 1);
        const merged = [
          ...mapboxHonest.slice(0, mapboxKeep),
          {
            strategy: challenger.strategy,
            distance_m: Math.round(challenger.distance_m),
            duration_s: Math.round(challenger.duration_s),
          },
        ];
        return {
          id,
          label,
          origin,
          destination,
          mode,
          stages: {
            mapbox_raw: collected.length,
            after_detour: afterDetour.length,
            after_carriageway: afterCarriageway.length,
            after_mapbox_distinct: mapboxDistinct.length,
            challenger_available: true,
            challenger_kept: true,
            final_cards: merged.length,
          },
          dropped_detour: droppedDetour,
          dropped_carriageway: droppedCarriageway,
          mapbox_kept: mapboxDistinct.map(summarise),
          challenger: challengerSummary,
          final: merged,
        };
      }
    }
  }

  return {
    id,
    label,
    origin,
    destination,
    mode,
    stages: {
      mapbox_raw: collected.length,
      after_detour: afterDetour.length,
      after_carriageway: afterCarriageway.length,
      after_mapbox_distinct: mapboxDistinct.length,
      challenger_available: challengerSummary.available,
      challenger_kept: challengerKept,
      final_cards: finalRoutes.length,
    },
    dropped_detour: droppedDetour,
    dropped_carriageway: droppedCarriageway,
    mapbox_kept: mapboxDistinct.map(summarise),
    challenger: challengerSummary,
    final: finalRoutes,
  };
}
