import {
  OVERLAY_DEFS,
  type OverlayId,
} from "@/lib/overlays";
import {
  fetchWalkingRouteCandidates,
  fetchWalkingWaypointRoute,
} from "./directions";
import { pointInCaseyBbox } from "./geo";
import {
  efficiencyWeightForPrefs,
  preferenceScore,
  type RoutePreferences,
} from "./preferences";
import { scoreRouteAgainstSegments } from "./scoreRoute";
import type { LngLat, ScoredRoute } from "./types";

/** Rough walk speed for outing radius (m/min). */
const WALK_M_PER_MIN = 75;

const BEARINGS_DEG = [30, 90, 150, 210, 270, 330];

/** Soft amenity proximity used only for Around-here ranking (not index pills). */
const AMENITY_NEAR_M = 90;
const AMENITY_BONUS_PER_TYPE = 8;

export type OutingShape = "loop" | "out_and_back" | "one_way";

export const OUTING_SHAPES: {
  id: OutingShape;
  label: string;
  hint: string;
}[] = [
  {
    id: "loop",
    label: "Loop",
    hint: "A circuit of about this long — different streets home, not the same path reverse",
  },
  {
    id: "out_and_back",
    label: "There and back",
    hint: "Out for half the time, then the same way home",
  },
  {
    id: "one_way",
    label: "One way",
    hint: "Finish somewhere else after about this long",
  },
];

/**
 * Loop filters — kept loose enough to accept real suburban circuits.
 * (Too-strict revisit + oversized vias made every loop fail duration checks,
 * then there-and-back fallback looked like “lines going out”.)
 */
const MAX_LOOP_REVISIT = 0.28;
const SOFT_LOOP_REVISIT = 0.48;
const MAX_LOOP_REVERSE_OVERLAP = 0.72;
const SAME_PATH_NEAR_M = 45;
const REVISIT_NEAR_M = 36;
const REVISIT_SAMPLE_STEP_M = 28;
const REVISIT_MIN_ALONG_SEP_M = 95;
const START_STUB_IGNORE_M = 80;
/**
 * Crow-fly distance from start to each via, sized so start→A→B→start walking
 * time ≈ asked duration. Road networks are longer than crow-fly, so use a
 * shrink factor (not duration/3 raw metres).
 */
const LOOP_VIA_STRAIGHT_FACTOR = 0.52;

export type OutingPlanOpts = {
  shape: OutingShape;
  /** Checked overlay ids that have live map data — soft circuit bias only. */
  amenityGoals?: OverlayId[];
};

type AmenitySet = {
  id: OverlayId;
  label: string;
  points: LngLat[];
};

const amenityCache = new Map<OverlayId, LngLat[] | null>();

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

function haversineM(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function outAndBackGeometry(
  outbound: GeoJSON.LineString,
): GeoJSON.LineString {
  const out = outbound.coordinates;
  if (out.length < 2) return outbound;
  const back = [...out].reverse().slice(1);
  return { type: "LineString", coordinates: [...out, ...back] };
}

function isDup(a: ScoredRoute, b: ScoredRoute): boolean {
  return (
    Math.abs(a.distance_m - b.distance_m) / Math.max(a.distance_m, 1) < 0.12 &&
    Math.abs(a.duration_s - b.duration_s) < 120
  );
}

/** Share of A’s samples that sit near B’s path (0–1). */
function pathPairOverlap(
  a: GeoJSON.LineString,
  b: GeoJSON.LineString,
  nearM = 55,
): number {
  const sa = densifyPathSamples(a);
  const sb = densifyPathSamples(b);
  if (sa.length < 4 || sb.length < 4) return 1;
  const step = Math.max(1, Math.floor(sa.length / 16));
  let near = 0;
  let n = 0;
  for (let i = 0; i < sa.length; i += step) {
    n++;
    const p = sa[i].p;
    let minD = Infinity;
    const bStep = Math.max(1, Math.floor(sb.length / 20));
    for (let j = 0; j < sb.length; j += bStep) {
      minD = Math.min(minD, haversineM(p, sb[j].p));
    }
    if (minD <= nearM) near++;
  }
  return n ? near / n : 1;
}

function loopsTooSimilar(a: ScoredRoute, b: ScoredRoute): boolean {
  if (isDup(a, b) && pathPairOverlap(a.geometry, b.geometry) > 0.45) {
    return true;
  }
  // Same neighbourhood circuit even if length differs a bit
  return pathPairOverlap(a.geometry, b.geometry) > 0.62;
}

function pushUnique(collected: ScoredRoute[], scored: ScoredRoute): void {
  if (collected.some((c) => isDup(c, scored))) return;
  collected.push(scored);
}

function pushDistinctLoop(
  collected: ScoredRoute[],
  scored: ScoredRoute,
): boolean {
  if (collected.some((c) => loopsTooSimilar(c, scored))) return false;
  collected.push(scored);
  return true;
}

async function loadAmenitySets(goals: OverlayId[]): Promise<AmenitySet[]> {
  const sets: AmenitySet[] = [];
  for (const id of goals) {
    const def = OVERLAY_DEFS.find((d) => d.id === id);
    if (!def?.available || !def.url) continue;

    let points = amenityCache.get(id);
    if (points === undefined) {
      try {
        const res = await fetch(def.url);
        if (!res.ok) {
          amenityCache.set(id, null);
          points = null;
        } else {
          const fc = (await res.json()) as GeoJSON.FeatureCollection;
          points = fc.features
            .map((f) => {
              const g = f.geometry;
              if (!g || g.type !== "Point") return null;
              const [lng, lat] = g.coordinates;
              return { lng, lat };
            })
            .filter((p): p is LngLat => p != null && pointInCaseyBbox(p));
          amenityCache.set(id, points);
        }
      } catch {
        amenityCache.set(id, null);
        points = null;
      }
    }
    if (points?.length) {
      sets.push({ id, label: def.label, points });
    }
  }
  return sets;
}

/** Soft rank bonus + card note when route passes near checked amenities. */
function amenitySoftScore(
  geometry: GeoJSON.LineString,
  sets: AmenitySet[],
): { bonus: number; note?: string } {
  if (!sets.length) return { bonus: 0 };
  const coords = geometry.coordinates;
  if (coords.length < 2) return { bonus: 0 };

  const step = Math.max(1, Math.floor(coords.length / 24));
  const samples: LngLat[] = [];
  for (let i = 0; i < coords.length; i += step) {
    samples.push({ lng: coords[i][0], lat: coords[i][1] });
  }
  const last = coords[coords.length - 1];
  samples.push({ lng: last[0], lat: last[1] });

  const hits: string[] = [];
  let bonus = 0;
  for (const set of sets) {
    let near = false;
    for (const s of samples) {
      for (const p of set.points) {
        if (haversineM(s, p) <= AMENITY_NEAR_M) {
          near = true;
          break;
        }
      }
      if (near) break;
    }
    if (near) {
      hits.push(set.label);
      bonus += AMENITY_BONUS_PER_TYPE;
    }
  }
  return {
    bonus,
    note: hits.length
      ? `Near ${hits.join(" · ").toLowerCase()} on this walk`
      : undefined,
  };
}

/** Amenity points at a useful loop/out distance from start. */
function amenityVias(
  start: LngLat,
  sets: AmenitySet[],
  targetM: number,
  limit: number,
): LngLat[] {
  const lo = targetM * 0.55;
  const hi = targetM * 1.25;
  const scored: { p: LngLat; err: number }[] = [];
  for (const set of sets) {
    for (const p of set.points) {
      const d = haversineM(start, p);
      if (d < lo || d > hi) continue;
      if (!pointInCaseyBbox(p)) continue;
      scored.push({ p, err: Math.abs(d - targetM) });
    }
  }
  scored.sort((a, b) => a.err - b.err);
  const out: LngLat[] = [];
  for (const { p } of scored) {
    if (out.some((q) => haversineM(q, p) < 120)) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * How close duration is to the asked outing length (100 = exact).
 * Prefer this over “shortest in the set wins” — that made 14 min there-and-backs
 * beat a ~15–20 min loop on match while Loop was selected.
 */
function outingDurationFit(durationS: number, targetS: number): number {
  if (!Number.isFinite(targetS) || targetS <= 0) return 50;
  const err = Math.abs(durationS / targetS - 1);
  return Math.max(0, 100 * (1 - err / 0.55));
}

function outingMatchScore(
  route: ScoredRoute,
  prefs: RoutePreferences,
  mode: "day" | "night",
  targetDurationS: number,
  amenityBonus: number,
): number {
  const pref = preferenceScore(route, prefs, mode);
  if (pref == null) return amenityBonus;
  const w = efficiencyWeightForPrefs(prefs, mode);
  const fit = outingDurationFit(route.duration_s, targetDurationS);
  return (1 - w) * pref + w * fit + amenityBonus;
}

/**
 * Rank outing cards. Match score = prefs + fit-to-asked-duration + amenity soft
 * bonus. Circuit quality (low revisit) is a tiebreak only — never a hidden
 * bump that makes Recommended show a lower match ring than Shortest.
 */
function rankOuting(
  routes: ScoredRoute[],
  prefs: RoutePreferences,
  mode: "day" | "night",
  targetDurationS: number,
  amenityBonus: Map<string, number>,
  circuitQuality: Map<string, number>,
): ScoredRoute[] {
  const scored = routes.map((r) => {
    const match = outingMatchScore(
      r,
      prefs,
      mode,
      targetDurationS,
      amenityBonus.get(r.id) ?? 0,
    );
    return { ...r, match_score: match };
  });

  return scored.sort((a, b) => {
    const byMatch = (b.match_score ?? 0) - (a.match_score ?? 0);
    if (Math.abs(byMatch) > 0.05) return byMatch;

    const cq =
      (circuitQuality.get(b.id) ?? 0) - (circuitQuality.get(a.id) ?? 0);
    if (cq !== 0) return cq;

    const durErr =
      Math.abs(a.duration_s - targetDurationS) -
      Math.abs(b.duration_s - targetDurationS);
    if (durErr !== 0) return durErr;
    return a.distance_m - b.distance_m;
  });
}

async function collectOneWay(
  start: LngLat,
  targetM: number,
  targetDurationS: number,
  segments: GeoJSON.Feature[],
  token: string,
  mode: "day" | "night",
  amenitySets: AmenitySet[],
  collected: ScoredRoute[],
  maxRoutes: number,
): Promise<void> {
  for (const bearing of BEARINGS_DEG) {
    const dest = destinationAt(start, targetM, bearing);
    if (!pointInCaseyBbox(dest)) continue;
    try {
      const routes = await fetchWalkingRouteCandidates(start, dest, token, 1);
      for (const r of routes) {
        const ratio = r.duration / targetDurationS;
        if (ratio < 0.55 || ratio > 1.45) continue;
        const soft = amenitySoftScore(r.geometry, amenitySets);
        pushUnique(collected, {
          id: `outing-oneway-${bearing}-${collected.length}`,
          index: collected.length,
          distance_m: r.distance,
          duration_s: r.duration,
          geometry: r.geometry,
          strategy: `one_way_${bearing}`,
          amenity_note: soft.note,
          score: scoreRouteAgainstSegments(r.geometry, segments, r.distance),
        });
      }
    } catch {
      // skip
    }
    await yieldToUi();
    if (collected.length >= maxRoutes + 2) break;
  }

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
            const soft = amenitySoftScore(ch.geometry, amenitySets);
            pushUnique(collected, {
              id: "outing-oneway-score-aware",
              index: collected.length,
              distance_m: ch.distance_m,
              duration_s: ch.duration_s,
              geometry: ch.geometry,
              strategy: ch.strategy,
              amenity_note: soft.note,
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
      // optional
    }
  }
}

async function collectOutAndBack(
  start: LngLat,
  halfM: number,
  targetDurationS: number,
  segments: GeoJSON.Feature[],
  token: string,
  amenitySets: AmenitySet[],
  collected: ScoredRoute[],
  maxRoutes: number,
): Promise<void> {
  const vias = [
    ...amenityVias(start, amenitySets, halfM, 4),
    ...BEARINGS_DEG.map((b) => destinationAt(start, halfM, b)),
  ];

  for (let i = 0; i < vias.length; i++) {
    const turn = vias[i];
    if (!pointInCaseyBbox(turn)) continue;
    try {
      const routes = await fetchWalkingRouteCandidates(start, turn, token, 1);
      const r = routes[0];
      if (!r) continue;
      const geom = outAndBackGeometry(r.geometry);
      const distance_m = r.distance * 2;
      const duration_s = r.duration * 2;
      const ratio = duration_s / targetDurationS;
      if (ratio < 0.55 || ratio > 1.5) continue;
      const soft = amenitySoftScore(geom, amenitySets);
      pushUnique(collected, {
        id: `outing-oab-${i}`,
        index: collected.length,
        distance_m,
        duration_s,
        geometry: geom,
        strategy: `out_and_back_${i}`,
        amenity_note: soft.note,
        score: scoreRouteAgainstSegments(geom, segments, distance_m),
      });
    } catch {
      // skip
    }
    await yieldToUi();
    if (collected.length >= maxRoutes + 2) break;
  }
}

type PathSample = { p: LngLat; along: number };

function densifyPathSamples(geometry: GeoJSON.LineString): PathSample[] {
  const coords = geometry.coordinates;
  if (coords.length < 2) return [];
  const samples: PathSample[] = [
    { p: { lng: coords[0][0], lat: coords[0][1] }, along: 0 },
  ];
  let along = 0;
  let sinceSample = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = { lng: coords[i - 1][0], lat: coords[i - 1][1] };
    const b = { lng: coords[i][0], lat: coords[i][1] };
    const seg = haversineM(a, b);
    if (seg < 0.5) continue;
    let remaining = seg;
    let t0 = 0;
    while (sinceSample + remaining >= REVISIT_SAMPLE_STEP_M) {
      const need = REVISIT_SAMPLE_STEP_M - sinceSample;
      const t = t0 + need / seg;
      samples.push({
        p: {
          lng: a.lng + (b.lng - a.lng) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        },
        along: along + need,
      });
      along += need;
      remaining -= need;
      t0 += need / seg;
      sinceSample = 0;
    }
    along += remaining;
    sinceSample += remaining;
  }
  const last = coords[coords.length - 1];
  samples.push({
    p: { lng: last[0], lat: last[1] },
    along,
  });
  return samples;
}

/**
 * Share of the return half that hugs the outbound half (fast there-and-back detector).
 */
function reverseOverlapRatio(geometry: GeoJSON.LineString): number {
  const coords = geometry.coordinates;
  if (coords.length < 10) return 1;

  let total = 0;
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    total += haversineM(
      { lng: coords[i - 1][0], lat: coords[i - 1][1] },
      { lng: coords[i][0], lat: coords[i][1] },
    );
    cum.push(total);
  }
  if (total < 80) return 1;

  const midLen = total / 2;
  let midIdx = 1;
  while (midIdx < cum.length - 1 && cum[midIdx] < midLen) midIdx++;

  const outbound = coords.slice(0, midIdx + 1);
  const ret = coords.slice(midIdx);
  if (outbound.length < 4 || ret.length < 4) return 1;

  const rStep = Math.max(1, Math.floor(ret.length / 18));
  const oStep = Math.max(1, Math.floor(outbound.length / 22));
  let near = 0;
  let n = 0;
  for (let i = 0; i < ret.length; i += rStep) {
    n++;
    const p = { lng: ret[i][0], lat: ret[i][1] };
    let minD = Infinity;
    for (let j = 0; j < outbound.length; j += oStep) {
      minD = Math.min(
        minD,
        haversineM(p, { lng: outbound[j][0], lat: outbound[j][1] }),
      );
    }
    if (minD <= SAME_PATH_NEAR_M) near++;
  }
  return n ? near / n : 1;
}

/**
 * Fraction of path samples that re-cover corridor already walked earlier.
 * Catches mid-loop cul-de-sac spurs that half-vs-half misses. Start-pin stubs
 * (leave and return on the same mid-block footpath) are ignored.
 */
function pathRevisitRatio(
  geometry: GeoJSON.LineString,
  start: LngLat,
): { ratio: number; totalM: number } {
  const samples = densifyPathSamples(geometry);
  if (samples.length < 8) return { ratio: 1, totalM: 0 };
  const totalM = samples[samples.length - 1].along;
  if (totalM < 120) return { ratio: 1, totalM };

  let revisit = 0;
  let scored = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const nearStart = haversineM(s.p, start) <= START_STUB_IGNORE_M;
    // Only score the latter ~80% of the walk (early outbound can't "revisit")
    if (s.along < totalM * 0.18) continue;
    scored++;
    let hit = false;
    for (let j = 0; j < i; j++) {
      const earlier = samples[j];
      if (s.along - earlier.along < REVISIT_MIN_ALONG_SEP_M) continue;
      if (
        nearStart &&
        haversineM(earlier.p, start) <= START_STUB_IGNORE_M
      ) {
        continue; // shared leave/return stub at the pin
      }
      if (haversineM(s.p, earlier.p) <= REVISIT_NEAR_M) {
        hit = true;
        break;
      }
    }
    if (hit) revisit++;
  }
  return { ratio: scored ? revisit / scored : 1, totalM };
}

type LoopCandidate = {
  a: LngLat;
  b: LngLat;
  strategy: string;
};

/** Ensure the drawn line closes at the start pin (Mapbox usually does; belt-and-braces). */
function closeLoopGeometry(
  geometry: GeoJSON.LineString,
  start: LngLat,
): GeoJSON.LineString {
  const coords = [...geometry.coordinates];
  if (!coords.length) return geometry;
  const last = coords[coords.length - 1];
  if (haversineM(start, { lng: last[0], lat: last[1] }) > 25) {
    coords.push([start.lng, start.lat]);
  } else {
    coords[coords.length - 1] = [start.lng, start.lat];
  }
  return { type: "LineString", coordinates: coords };
}

/**
 * Simpler triangle set: a few bearings × CW/CCW × 2 radii.
 * Sized vias so walking time can hit the asked duration.
 */
function loopWaypointPairs(
  start: LngLat,
  viaM: number,
  amenitySets: AmenitySet[],
): LoopCandidate[] {
  const pairs: LoopCandidate[] = [];
  const radii = [viaM * 0.75, viaM, viaM * 1.2];

  for (const radius of radii) {
    const amenityPts = amenityVias(start, amenitySets, radius, 3);
    for (let i = 0; i < amenityPts.length; i++) {
      const a = amenityPts[i];
      const br =
        (Math.atan2(a.lng - start.lng, a.lat - start.lat) * 180) / Math.PI;
      for (const spread of [120, -120]) {
        const b = destinationAt(start, radius * 0.95, br + spread);
        if (pointInCaseyBbox(b) && haversineM(a, b) > radius * 0.35) {
          pairs.push({
            a,
            b,
            strategy: `loop_amenity_${i}_${Math.round(radius)}_${spread}`,
          });
        }
      }
    }

    for (const bearing of BEARINGS_DEG) {
      for (const spread of [115, -115]) {
        const a = destinationAt(start, radius, bearing);
        const b = destinationAt(start, radius * 0.95, bearing + spread);
        if (!pointInCaseyBbox(a) || !pointInCaseyBbox(b)) continue;
        if (haversineM(a, b) < radius * 0.35) continue;
        pairs.push({
          a,
          b,
          strategy: `loop_tri_${bearing}_${spread}_${Math.round(radius)}`,
        });
      }
    }
  }

  // Cap calls: one pair per bearing sector first, then fill
  const picked: LoopCandidate[] = [];
  const seen = new Set<string>();
  for (const bearing of BEARINGS_DEG) {
    const hit = pairs.find(
      (p) =>
        p.strategy.includes(`loop_tri_${bearing}_`) &&
        p.strategy.includes(`_${Math.round(viaM)}`),
    );
    if (hit) {
      picked.push(hit);
      seen.add(hit.strategy);
    }
  }
  for (const p of pairs) {
    if (seen.has(p.strategy)) continue;
    picked.push(p);
    seen.add(p.strategy);
    if (picked.length >= 14) break;
  }
  return picked;
}

type LoopPoolItem = {
  scored: ScoredRoute;
  revisit: number;
  hard: boolean;
  durErr: number;
};

function selectDiverseLoops(
  pool: LoopPoolItem[],
  maxRoutes: number,
): ScoredRoute[] {
  const ranked = [...pool].sort((a, b) => {
    if (a.hard !== b.hard) return a.hard ? -1 : 1;
    if (a.durErr !== b.durErr) return a.durErr - b.durErr;
    return a.revisit - b.revisit;
  });

  const out: ScoredRoute[] = [];
  for (const item of ranked) {
    if (out.some((c) => loopsTooSimilar(c, item.scored))) continue;
    out.push(item.scored);
    if (out.length >= maxRoutes) break;
  }
  return out;
}

/**
 * Circuit walks: Mapbox start→A→B→start. Returns several distinct loops when possible.
 * Does not add there-and-backs.
 */
async function collectLoop(
  start: LngLat,
  viaM: number,
  targetDurationS: number,
  segments: GeoJSON.Feature[],
  token: string,
  amenitySets: AmenitySet[],
  collected: ScoredRoute[],
  maxRoutes: number,
): Promise<void> {
  const pairs = loopWaypointPairs(start, viaM, amenitySets);
  const pool: LoopPoolItem[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const { a, b, strategy } = pairs[i];
    try {
      const r = await fetchWalkingWaypointRoute(
        [start, a, b, start],
        token,
        strategy,
      );
      if (!r) continue;

      const geometry = closeLoopGeometry(r.geometry, start);
      const end = geometry.coordinates.at(-1);
      if (!end) continue;
      if (haversineM(start, { lng: end[0], lat: end[1] }) > 40) continue;

      const durRatio = r.duration / targetDurationS;
      // Wide window; we rank by closeness to target afterward
      if (durRatio < 0.45 || durRatio > 1.65) continue;

      const overlap = reverseOverlapRatio(geometry);
      // Reject pure there-and-back disguised as a waypoint route
      if (overlap > MAX_LOOP_REVERSE_OVERLAP) continue;

      const { ratio: revisit } = pathRevisitRatio(geometry, start);
      if (revisit > SOFT_LOOP_REVISIT) continue;

      // Must leave the pin — far point of the circuit
      let maxAway = 0;
      for (let k = 0; k < geometry.coordinates.length; k += Math.max(1, Math.floor(geometry.coordinates.length / 20))) {
        const c = geometry.coordinates[k];
        maxAway = Math.max(
          maxAway,
          haversineM(start, { lng: c[0], lat: c[1] }),
        );
      }
      if (maxAway < viaM * 0.35) continue;

      const soft = amenitySoftScore(geometry, amenitySets);
      const hard = revisit <= MAX_LOOP_REVISIT && overlap <= 0.55;
      const scored: ScoredRoute = {
        id: `outing-loop-${i}`,
        index: pool.length,
        distance_m: r.distance,
        duration_s: r.duration,
        geometry,
        strategy: `${r.strategy}_rev${revisit.toFixed(2)}_ov${overlap.toFixed(2)}`,
        amenity_note: soft.note,
        outing_note: hard
          ? undefined
          : "A little shared path on this circuit — still mostly new streets.",
        score: scoreRouteAgainstSegments(geometry, segments, r.distance),
      };
      pool.push({
        scored,
        revisit,
        hard,
        durErr: Math.abs(r.duration - targetDurationS),
      });
    } catch {
      // skip
    }
    await yieldToUi();
    if (selectDiverseLoops(pool.filter((p) => p.hard), maxRoutes).length >= maxRoutes) {
      break;
    }
  }

  for (const r of selectDiverseLoops(pool, maxRoutes)) {
    pushDistinctLoop(collected, r);
  }
}

/**
 * Around-here outing: Loop (default), there-and-back, or one-way.
 * Soft amenity bias when goals are set — never imputed into index scores.
 */
export async function planOutingRoutes(
  start: LngLat,
  durationMin: number,
  segments: GeoJSON.Feature[],
  token: string,
  mode: "day" | "night",
  prefs: RoutePreferences,
  opts: OutingPlanOpts = { shape: "loop" },
  maxRoutes = 3,
): Promise<ScoredRoute[]> {
  if (!pointInCaseyBbox(start)) {
    throw new Error("Start must be inside the Casey pilot area.");
  }

  const shape = opts.shape ?? "loop";
  const targetDurationS = durationMin * 60;
  const amenitySets = await loadAmenitySets(opts.amenityGoals ?? []);
  const collected: ScoredRoute[] = [];

  if (shape === "one_way") {
    const targetM = Math.max(400, durationMin * WALK_M_PER_MIN);
    await collectOneWay(
      start,
      targetM,
      targetDurationS,
      segments,
      token,
      mode,
      amenitySets,
      collected,
      maxRoutes,
    );
  } else if (shape === "out_and_back") {
    const halfM = Math.max(250, (durationMin / 2) * WALK_M_PER_MIN);
    await collectOutAndBack(
      start,
      halfM,
      targetDurationS,
      segments,
      token,
      amenitySets,
      collected,
      maxRoutes,
    );
  } else {
    // Crow-fly via radius shrunk so walking triangle ≈ asked duration
    const viaM = Math.max(
      160,
      (durationMin / 3) * WALK_M_PER_MIN * LOOP_VIA_STRAIGHT_FACTOR,
    );
    await collectLoop(
      start,
      viaM,
      targetDurationS,
      segments,
      token,
      amenitySets,
      collected,
      maxRoutes,
    );
    // Retry smaller vias if nothing fitted (common when first pass overshoots time)
    if (collected.length === 0) {
      await collectLoop(
        start,
        viaM * 0.65,
        targetDurationS,
        segments,
        token,
        amenitySets,
        collected,
        maxRoutes,
      );
    }
    // No there-and-back padding under Loop — keep shape honest
  }

  if (!collected.length) {
    throw new Error(
      "Couldn’t find walks of about that length from this start. Try another spot, shape, or duration.",
    );
  }

  const amenityBonus = new Map<string, number>();
  const circuitQuality = new Map<string, number>();
  for (const r of collected) {
    const soft = amenitySoftScore(r.geometry, amenitySets);
    amenityBonus.set(r.id, soft.bonus);
    if (soft.note && !r.amenity_note) r.amenity_note = soft.note;

    if (shape === "loop" && r.strategy && !r.strategy.startsWith("out_and_back")) {
      const { ratio } = pathRevisitRatio(r.geometry, start);
      // Higher = cleaner circuit (tiebreak only; not added into match ring)
      circuitQuality.set(r.id, Math.round((1 - Math.min(1, ratio)) * 100));
    }
  }

  return rankOuting(
    collected,
    prefs,
    mode,
    targetDurationS,
    amenityBonus,
    circuitQuality,
  )
    .slice(0, maxRoutes)
    .map((r, i) => ({ ...r, index: i, id: r.id }));
}

export const OUTING_DURATIONS_MIN = [15, 25, 40] as const;
export type OutingDurationMin = (typeof OUTING_DURATIONS_MIN)[number];
