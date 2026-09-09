/**
 * Route elevation profile (resident disclosure).
 *
 * Not an Accessibility index input. Gradient stays deferred in methodology
 * v1.1 (see docs/GRADIENT_DISCOVERY.md). This module turns sampled heights
 * along a planned walk into climb, an estimated max grade, and a hilliness
 * band so residents can see a steep walk before they start it.
 */

export type HillinessBand = "flat" | "gentle" | "hilly" | "steep";

export type ElevationSample = {
  distance_m: number;
  elevation_m: number;
};

export type RouteElevation = {
  source: "mapbox-terrain-rgb";
  sample_count: number;
  coverage_ratio: number;
  start_m: number;
  end_m: number;
  min_m: number;
  max_m: number;
  climb_m: number;
  descent_m: number;
  /** Smoothed max grade over GRADE_WINDOW_M, percent. */
  max_grade_pct: number;
  band: HillinessBand;
  samples: ElevationSample[];
};

export const ELEVATION_SOURCE_NOTE =
  "Approximate hilliness from Mapbox Terrain. Not a surveyed footpath grade, and not part of the Footpaths score.";

/** Sample spacing along the walk line. */
export const SAMPLE_STEP_M = 20;
/** Horizontal run used when estimating grade (damps DEM noise). */
export const GRADE_WINDOW_M = 40;
/** Need this share of samples with a height before we show a profile. */
export const MIN_ELEVATION_COVERAGE = 0.6;
export const MAX_ELEVATION_SAMPLES = 220;

/** AS 1428-style bands for language only — not a compliance claim. */
export const GRADE_GENTLE_PCT = 3;
export const GRADE_HILLY_PCT = 5;
export const GRADE_STEEP_PCT = 8;

const EARTH_M = 6_371_000;

export function haversineM(
  a: [number, number],
  b: [number, number],
): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Evenly space points along a LineString (by ground distance). */
export function densifyLine(
  line: GeoJSON.LineString,
  stepM: number = SAMPLE_STEP_M,
  maxSamples: number = MAX_ELEVATION_SAMPLES,
): [number, number][] {
  const coords = line.coordinates as [number, number][];
  if (coords.length === 0) return [];
  if (coords.length === 1) return [coords[0]];

  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineM(coords[i - 1], coords[i]));
  }
  const total = cum[cum.length - 1];
  if (total <= 0) return [coords[0]];

  const n = Math.min(maxSamples, Math.max(2, Math.floor(total / stepM) + 1));
  const out: [number, number][] = [];
  let seg = 1;
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    while (seg < cum.length - 1 && cum[seg] < target) seg += 1;
    const t0 = cum[seg - 1];
    const t1 = cum[seg];
    const f = t1 > t0 ? (target - t0) / (t1 - t0) : 0;
    const a = coords[seg - 1];
    const b = coords[seg];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

export function classifyHilliness(
  maxGradePct: number,
  climbM: number,
): HillinessBand {
  if (!Number.isFinite(maxGradePct) || maxGradePct < 0) return "flat";
  if (maxGradePct >= GRADE_STEEP_PCT) return "steep";
  if (maxGradePct >= GRADE_HILLY_PCT || climbM >= 25) return "hilly";
  if (maxGradePct >= GRADE_GENTLE_PCT || climbM >= 8) return "gentle";
  return "flat";
}

function smoothElevations(values: Array<number | null>, radius = 1): Array<number | null> {
  return values.map((v, i) => {
    if (v == null) return null;
    let sum = 0;
    let n = 0;
    for (let j = i - radius; j <= i + radius; j++) {
      const u = values[j];
      if (u == null) continue;
      sum += u;
      n += 1;
    }
    return n ? sum / n : v;
  });
}

/**
 * Build a profile from along-path heights. `elevations[i]` may be null when
 * a Terrain tile missed that sample.
 */
export function profileFromElevations(
  points: [number, number][],
  elevations: Array<number | null>,
): RouteElevation | null {
  if (points.length < 2 || elevations.length !== points.length) return null;

  const dist: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    dist.push(dist[i - 1] + haversineM(points[i - 1], points[i]));
  }

  const known = elevations.filter((z): z is number => z != null && Number.isFinite(z));
  const coverage = known.length / elevations.length;
  if (coverage < MIN_ELEVATION_COVERAGE || known.length < 3) return null;

  const smoothed = smoothElevations(elevations);

  let climb = 0;
  let descent = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const a = smoothed[i - 1];
    const b = smoothed[i];
    if (a == null || b == null) continue;
    const d = b - a;
    if (d > 0) climb += d;
    else descent += -d;
  }

  let maxGrade = 0;
  for (let i = 0; i < smoothed.length; i++) {
    const z0 = smoothed[i];
    if (z0 == null) continue;
    for (let j = i + 1; j < smoothed.length; j++) {
      const run = dist[j] - dist[i];
      if (run < GRADE_WINDOW_M) continue;
      const z1 = smoothed[j];
      if (z1 == null) break;
      const grade = (Math.abs(z1 - z0) / run) * 100;
      if (grade > maxGrade) maxGrade = grade;
      break;
    }
  }

  const first = smoothed.find((z) => z != null) ?? known[0];
  const last =
    [...smoothed].reverse().find((z) => z != null) ?? known[known.length - 1];
  const finite = smoothed.filter((z): z is number => z != null);

  const samples: ElevationSample[] = [];
  for (let i = 0; i < points.length; i++) {
    const z = smoothed[i];
    if (z == null) continue;
    samples.push({ distance_m: dist[i], elevation_m: z });
  }
  if (samples.length < 3) return null;

  return {
    source: "mapbox-terrain-rgb",
    sample_count: samples.length,
    coverage_ratio: Math.round(coverage * 1000) / 1000,
    start_m: first,
    end_m: last,
    min_m: Math.min(...finite),
    max_m: Math.max(...finite),
    climb_m: climb,
    descent_m: descent,
    max_grade_pct: maxGrade,
    band: classifyHilliness(maxGrade, climb),
    samples,
  };
}

export function hillinessCardLine(profile: RouteElevation): string {
  const climb = Math.round(profile.climb_m);
  switch (profile.band) {
    case "steep":
      return climb > 0 ? `Steep sections · ↑ ${climb} m` : "Steep sections";
    case "hilly":
      return climb > 0 ? `Some hills · ↑ ${climb} m` : "Some hills";
    case "gentle":
      return climb > 0 ? `Gentle hills · ↑ ${climb} m` : "Gentle hills";
    default:
      return "Mostly flat";
  }
}

export function hillinessDetailLine(profile: RouteElevation): string {
  const climb = Math.round(profile.climb_m);
  const grade = Math.round(profile.max_grade_pct);
  return `Climbs about ${climb} m. Steepest stretch about ${grade}%.`;
}

export function hillinessAriaLabel(profile: RouteElevation): string {
  const climb = Math.round(profile.climb_m);
  const line = hillinessCardLine(profile);
  return climb > 0
    ? `Hills along the walk. ${line}.`
    : `Hills along the walk. ${line}`;
}

export function isSteepElevation(profile: RouteElevation | undefined): boolean {
  return profile?.band === "steep";
}

/** SVG path for a compact elevation sparkline (distance × height). */
export function sparklinePath(
  samples: ElevationSample[],
  width: number,
  height: number,
  pad = 3,
): string {
  if (samples.length < 2 || width <= 0 || height <= 0) return "";
  const minZ = Math.min(...samples.map((s) => s.elevation_m));
  const maxZ = Math.max(...samples.map((s) => s.elevation_m));
  const spanZ = Math.max(2, maxZ - minZ);
  const maxD = samples[samples.length - 1]?.distance_m || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const parts: string[] = [];
  samples.forEach((s, i) => {
    const x = pad + (s.distance_m / maxD) * innerW;
    const y = pad + innerH - ((s.elevation_m - minZ) / spanZ) * innerH;
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return parts.join(" ");
}

export function mergeElevationById<T extends { id: string }>(
  current: T[],
  sourced: Array<{ id: string; elevation?: RouteElevation | null }>,
): Array<T & { elevation?: RouteElevation | null }> {
  const byId = new Map(sourced.map((r) => [r.id, r.elevation]));
  return current.map((r) => {
    if (!byId.has(r.id)) return r;
    return { ...r, elevation: byId.get(r.id) ?? null };
  });
}
