import { pointInCaseyBbox, deriveHeatShadeScore } from "./geo";
import {
  effectivePrefsForMode,
  PREF_IMPORTANCE_MAX,
  PREF_IMPORTANCE_MIN,
  type RoutePreferences,
} from "./preferences";
import type { LngLat } from "./types";

/** Snap a compass/amenity turn onto a Casey footpath within this distance. */
export const CASEY_SNAP_M = 90;
/** Blend nearby Casey segments within this distance of a turning point. */
export const CASEY_SAMPLE_NEAR_M = 80;
/** How many Casey-graph loop attempts before Mapbox-only (keeps Find responsive). */
export const CASEY_STITCH_MAX_PAIRS = 6;

export type NearbyCaseySegment = {
  mid: LngLat;
  lengthM: number;
  accessibility: number | null;
  heatShade: number | null;
  lighting: number | null;
  nightIndex: number | null;
};

export type LoopTurnPair = {
  a: LngLat;
  b: LngLat;
  strategy: string;
  /** Bearing of the first turn from start, 0–360. Used to keep direction spread. */
  bearingDeg: number;
};

export type ScoredLoopPair = LoopTurnPair & {
  blend: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function haversineM(a: LngLat, b: LngLat): number {
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

export function bearingDeg(from: LngLat, to: LngLat): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function coordsBBoxCenter(coords: GeoJSON.Position[]): LngLat | null {
  if (!coords.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of coords) {
    if (!c || c.length < 2) continue;
    minX = Math.min(minX, c[0]!);
    minY = Math.min(minY, c[1]!);
    maxX = Math.max(maxX, c[0]!);
    maxY = Math.max(maxY, c[1]!);
  }
  if (!Number.isFinite(minX)) return null;
  return { lng: (minX + maxX) / 2, lat: (minY + maxY) / 2 };
}

/** T1EAM map GeoJSON is polygons; bake-off extras may be lines. */
function geometryMidpoint(geom: GeoJSON.Geometry): LngLat | null {
  if (geom.type === "Point") {
    const c = geom.coordinates;
    return c.length >= 2 ? { lng: c[0]!, lat: c[1]! } : null;
  }
  if (geom.type === "LineString") return coordsBBoxCenter(geom.coordinates);
  if (geom.type === "MultiLineString") {
    return coordsBBoxCenter(geom.coordinates.flat());
  }
  if (geom.type === "Polygon") {
    return coordsBBoxCenter(geom.coordinates[0] ?? []);
  }
  if (geom.type === "MultiPolygon") {
    return coordsBBoxCenter(geom.coordinates[0]?.[0] ?? []);
  }
  return null;
}

/**
 * Casey footpaths within `radiusM` of start. One pass over the loaded
 * GeoJSON so loop Find does not scan 27k features per turning point.
 */
export function caseySegmentsNearStart(
  start: LngLat,
  segments: GeoJSON.Feature[],
  radiusM: number,
): NearbyCaseySegment[] {
  const out: NearbyCaseySegment[] = [];
  for (const seg of segments) {
    if (!seg.geometry) continue;
    const props = seg.properties ?? {};
    if (props.score_eligible === false) continue;
    const mid = geometryMidpoint(seg.geometry);
    if (!mid || !pointInCaseyBbox(mid)) continue;
    if (haversineM(start, mid) > radiusM) continue;

    const day = num(props.day_index_score);
    const acc = num(props.accessibility_score);
    const heat =
      num(props.heat_shade_score) ?? deriveHeatShadeScore(day, acc);
    out.push({
      mid,
      lengthM: num(props.length_m) ?? 20,
      accessibility: acc,
      heatShade: heat,
      lighting:
        num(props.lighting_after_dark_score) ?? num(props.lighting_score),
      nightIndex: num(props.night_index_score),
    });
  }
  return out;
}

export function snapToCaseyFootpath(
  point: LngLat,
  nearby: NearbyCaseySegment[],
  snapM = CASEY_SNAP_M,
): LngLat {
  let best = point;
  let bestD = snapM;
  for (const s of nearby) {
    const d = haversineM(point, s.mid);
    if (d < bestD) {
      bestD = d;
      best = s.mid;
    }
  }
  return best;
}

/** Same blend as trip ranking: never treat a missing stream as zero. */
export function blendNearbyCasey(
  point: LngLat,
  nearby: NearbyCaseySegment[],
  prefs: RoutePreferences,
  mode: "day" | "night",
  nearM = CASEY_SAMPLE_NEAR_M,
): number | null {
  const w = effectivePrefsForMode(prefs, mode);
  let accSum = 0;
  let accW = 0;
  let heatSum = 0;
  let heatW = 0;
  let lightSum = 0;
  let lightW = 0;
  let nightSum = 0;
  let nightW = 0;

  for (const s of nearby) {
    if (haversineM(point, s.mid) > nearM) continue;
    const wt = Math.max(1, s.lengthM);
    if (s.accessibility != null) {
      accSum += s.accessibility * wt;
      accW += wt;
    }
    if (s.heatShade != null) {
      heatSum += s.heatShade * wt;
      heatW += wt;
    }
    if (s.lighting != null) {
      lightSum += s.lighting * wt;
      lightW += wt;
    }
    if (s.nightIndex != null) {
      nightSum += s.nightIndex * wt;
      nightW += wt;
    }
  }

  const parts: { score: number; weight: number }[] = [];
  if (accW > 0 && w.accessibility > 0) {
    parts.push({ score: accSum / accW, weight: w.accessibility });
  }
  if (mode === "day") {
    if (heatW > 0 && w.shadeHeat > 0) {
      parts.push({ score: heatSum / heatW, weight: w.shadeHeat });
    }
  } else {
    const lighting = lightW > 0 ? lightSum / lightW : nightW > 0 ? nightSum / nightW : null;
    if (lighting != null && w.afterDark > 0) {
      parts.push({ score: lighting, weight: w.afterDark });
    }
  }
  if (!parts.length) return null;
  const wSum = parts.reduce((s, p) => s + p.weight, 0);
  if (wSum <= 0) return null;
  return parts.reduce((s, p) => s + p.score * p.weight, 0) / wSum;
}

export function scoreLoopPair(
  pair: LoopTurnPair,
  nearby: NearbyCaseySegment[],
  prefs: RoutePreferences,
  mode: "day" | "night",
): ScoredLoopPair {
  const a = blendNearbyCasey(pair.a, nearby, prefs, mode);
  const b = blendNearbyCasey(pair.b, nearby, prefs, mode);
  const parts = [a, b].filter((v): v is number => v != null);
  return {
    ...pair,
    blend: parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : null,
  };
}

/**
 * Top quartile first, one pair per 60° sector so shade-max does not
 * collapse every turn into the same reserve, then the rest by score.
 */
export function orderPairsForDraw(pairs: ScoredLoopPair[]): ScoredLoopPair[] {
  const scored = pairs.filter((p) => p.blend != null);
  const unscored = pairs.filter((p) => p.blend == null);
  scored.sort((a, b) => (b.blend ?? 0) - (a.blend ?? 0));
  if (scored.length < 4) return [...scored, ...unscored];

  const values = scored.map((p) => p.blend!).sort((a, b) => a - b);
  const q3 = values[Math.floor(values.length * 0.75)] ?? values[values.length - 1]!;
  const top = scored.filter((p) => (p.blend ?? 0) >= q3);
  const rest = scored.filter((p) => (p.blend ?? 0) < q3);

  const picked: ScoredLoopPair[] = [];
  const used = new Set<string>();
  for (let sector = 0; sector < 6; sector++) {
    const lo = sector * 60;
    const hi = lo + 60;
    const hit = top.find(
      (p) => !used.has(p.strategy) && p.bearingDeg >= lo && p.bearingDeg < hi,
    );
    if (hit) {
      picked.push(hit);
      used.add(hit.strategy);
    }
  }
  for (const p of [...top, ...rest]) {
    if (used.has(p.strategy)) continue;
    picked.push(p);
    used.add(p.strategy);
  }
  return [...picked, ...unscored];
}

function destinationAt(
  start: LngLat,
  distanceM: number,
  brDeg: number,
): LngLat {
  const R = 6371000;
  const br = (brDeg * Math.PI) / 180;
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
      Math.cos(ang) - Math.sin(lat1) * Math.cos(lat2),
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Extra turning-point pairs from high-scoring Casey footpaths in the
 * duration ring, so we are not only scoring compass points in paddocks.
 */
export function caseyRingPairs(
  start: LngLat,
  viaM: number,
  nearby: NearbyCaseySegment[],
  prefs: RoutePreferences,
  mode: "day" | "night",
  limit = 8,
): LoopTurnPair[] {
  const lo = viaM * 0.7;
  const hi = viaM * 1.25;
  const ring = nearby.filter((s) => {
    const d = haversineM(start, s.mid);
    return d >= lo && d <= hi;
  });
  if (ring.length < 2) return [];

  const ranked = ring
    .map((s) => ({
      s,
      blend: blendNearbyCasey(s.mid, nearby, prefs, mode),
      bearing: bearingDeg(start, s.mid),
    }))
    .filter((x) => x.blend != null)
    .sort((a, b) => (b.blend ?? 0) - (a.blend ?? 0));
  if (ranked.length < 2) return [];

  const q3Index = Math.floor(ranked.length * 0.25);
  const top = ranked.slice(0, Math.max(4, q3Index || ranked.length));
  const pairs: LoopTurnPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < top.length && pairs.length < limit; i++) {
    const a = top[i]!;
    let partner = top.find((b) => {
      if (b === a) return false;
      const spread = Math.abs(b.bearing - a.bearing);
      const ang = Math.min(spread, 360 - spread);
      return ang >= 90 && ang <= 150;
    });
    if (!partner) {
      const target = (a.bearing + 120) % 360;
      partner = ranked.find((b) => {
        if (b === a) return false;
        const spread = Math.abs(b.bearing - target);
        return Math.min(spread, 360 - spread) < 35;
      });
    }
    if (!partner) {
      const fallback = destinationAt(start, viaM * 0.95, a.bearing + 120);
      if (!pointInCaseyBbox(fallback)) continue;
      const snapped = snapToCaseyFootpath(fallback, nearby);
      const key = `${a.s.mid.lng.toFixed(5)}_${snapped.lng.toFixed(5)}`;
      if (seen.has(key)) continue;
      if (haversineM(a.s.mid, snapped) < viaM * 0.32) continue;
      seen.add(key);
      pairs.push({
        a: a.s.mid,
        b: snapped,
        strategy: `loop_casey_${Math.round(a.bearing)}_${Math.round(viaM)}`,
        bearingDeg: a.bearing,
      });
      continue;
    }
    const key = `${a.s.mid.lng.toFixed(5)}_${partner.s.mid.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    if (haversineM(a.s.mid, partner.s.mid) < viaM * 0.32) continue;
    seen.add(key);
    pairs.push({
      a: a.s.mid,
      b: partner.s.mid,
      strategy: `loop_casey_${Math.round(a.bearing)}_${Math.round(viaM)}`,
      bearingDeg: a.bearing,
    });
  }
  return pairs;
}

export function snapAndScorePairs(
  start: LngLat,
  pairs: LoopTurnPair[],
  nearby: NearbyCaseySegment[],
  prefs: RoutePreferences,
  mode: "day" | "night",
  minApartM: number,
): ScoredLoopPair[] {
  const out: ScoredLoopPair[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const a = snapToCaseyFootpath(pair.a, nearby);
    const b = snapToCaseyFootpath(pair.b, nearby);
    if (!pointInCaseyBbox(a) || !pointInCaseyBbox(b)) continue;
    if (haversineM(a, b) < minApartM) continue;
    const key = `${a.lng.toFixed(4)}_${a.lat.toFixed(4)}_${b.lng.toFixed(4)}_${b.lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      scoreLoopPair(
        { ...pair, a, b, bearingDeg: bearingDeg(start, a) },
        nearby,
        prefs,
        mode,
      ),
    );
  }
  return out;
}

/** Sort there-and-back turns: better Casey blend first. */
export function orderTurnsForDraw(
  turns: LngLat[],
  nearby: NearbyCaseySegment[],
  prefs: RoutePreferences,
  mode: "day" | "night",
): LngLat[] {
  return [...turns]
    .map((p) => {
      const snapped = snapToCaseyFootpath(p, nearby);
      return {
        p: snapped,
        blend: blendNearbyCasey(snapped, nearby, prefs, mode),
      };
    })
    .sort((a, b) => (b.blend ?? -1) - (a.blend ?? -1))
    .map((x) => x.p);
}

/** Shade-max vs footpaths-max (and night lighting) for verify scripts. */
export function contrastOutingPrefs(mode: "day" | "night"): {
  shadeOrLight: RoutePreferences;
  footpaths: RoutePreferences;
} {
  if (mode === "night") {
    return {
      shadeOrLight: {
        afterDark: PREF_IMPORTANCE_MAX,
        accessibility: PREF_IMPORTANCE_MIN,
        shadeHeat: 0,
        preferSharedPaths: false,
      },
      footpaths: {
        afterDark: PREF_IMPORTANCE_MIN,
        accessibility: PREF_IMPORTANCE_MAX,
        shadeHeat: 0,
        preferSharedPaths: false,
      },
    };
  }
  return {
    shadeOrLight: {
      afterDark: 0,
      accessibility: PREF_IMPORTANCE_MIN,
      shadeHeat: PREF_IMPORTANCE_MAX,
      preferSharedPaths: false,
    },
    footpaths: {
      afterDark: 0,
      accessibility: PREF_IMPORTANCE_MAX,
      shadeHeat: PREF_IMPORTANCE_MIN,
      preferSharedPaths: false,
    },
  };
}
