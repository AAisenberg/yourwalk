/**
 * Detect walking geometries that sit on road carriageways (Mapbox Streets).
 * Used to reject trip options that draw down the middle of the road, and to
 * nudge Mapbox paint toward sidewalks / casing edges (Track 0 — carriageway
 * truth).
 */

const PATHISH = new Set([
  "path",
  "pedestrian",
  "footway",
  "sidewalk",
  "crossing",
  "steps",
  "cycleway",
  "track",
  "bridleway",
  "corridor",
]);

/** Reject when this share of samples nearest a non-path street class. */
export const MAX_CARRIAGEWAY_SHARE = 0.28;

/**
 * When a path-safe Casey card exists, drop Mapbox if this share of densified
 * points sat on/in the carriageway (Track 0 look, before / during nudge).
 * Same budget as the carriageway gate. OD-12 Homestead fails this; path-safe
 * Mapbox alts on OD-CARRIAGE-01 do not.
 */
export const MAX_CENTRELINE_LOOK_WHEN_CASEY = 0.28;

/** True when Mapbox still reads as a mid-road walk (Casey should replace it). */
export function mapboxLooksCentreline(route: {
  centreline_look_share?: number | null;
}): boolean {
  const look = route.centreline_look_share;
  if (look == null || !Number.isFinite(look)) return false;
  return look >= MAX_CENTRELINE_LOOK_WHEN_CASEY;
}

/** Tilequery radius for carriageway / sidewalk probes (metres). */
const TILEQUERY_RADIUS_M = 35;

type TilequeryFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    class?: string;
    type?: string;
    tilequery?: { distance?: number };
  };
};

export type StreetProbe = {
  className: string;
  typeName: string;
  pathish: boolean;
  sidewalk: boolean;
  dist_m: number;
  coords: [number, number] | null;
};

function sampleLine(
  line: GeoJSON.LineString,
  n: number,
): [number, number][] {
  const coords = line.coordinates;
  if (coords.length === 0) return [];
  if (coords.length === 1) {
    return Array(n).fill(coords[0] as [number, number]) as [number, number][];
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idx = t * (coords.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(coords.length - 1, lo + 1);
    const f = idx - lo;
    const a = coords[lo]!;
    const b = coords[hi]!;
    out.push([a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f]);
  }
  return out;
}

function isPathish(className?: string, typeName?: string): boolean {
  const c = (className ?? "").toLowerCase();
  const t = (typeName ?? "").toLowerCase();
  return PATHISH.has(c) || PATHISH.has(t);
}

function isSidewalk(className?: string, typeName?: string): boolean {
  const c = (className ?? "").toLowerCase();
  const t = (typeName ?? "").toLowerCase();
  return c === "sidewalk" || t === "sidewalk";
}

async function probeStreets(
  lng: number,
  lat: number,
  token: string,
): Promise<StreetProbe[]> {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", String(TILEQUERY_RADIUS_M));
  url.searchParams.set("limit", "10");
  url.searchParams.set("layers", "road");
  url.searchParams.set("access_token", token);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const body = (await res.json()) as { features?: TilequeryFeature[] };
    return [...(body.features ?? [])]
      .map((f) => {
        const className = (f.properties?.class ?? "").toLowerCase();
        const typeName = (f.properties?.type ?? "").toLowerCase();
        const coords = f.geometry?.coordinates;
        return {
          className,
          typeName,
          pathish: isPathish(className, typeName),
          sidewalk: isSidewalk(className, typeName),
          dist_m: f.properties?.tilequery?.distance ?? 999,
          coords:
            coords && coords.length >= 2
              ? ([coords[0], coords[1]] as [number, number])
              : null,
        };
      })
      .sort((a, b) => a.dist_m - b.dist_m);
  } catch {
    return [];
  }
}

async function nearestStreetClass(
  lng: number,
  lat: number,
  token: string,
): Promise<"path" | "road" | "unknown"> {
  const feats = await probeStreets(lng, lat, token);
  const top = feats[0];
  if (!top) return "unknown";
  return top.pathish ? "path" : "road";
}

/**
 * Share of evenly spaced samples whose nearest Mapbox Streets feature is a
 * carriageway (street / primary / secondary / …), not footway/path/cycleway.
 * Returns null when sampling fails (caller should not reject).
 */
export async function roadCarriagewayShare(
  geometry: GeoJSON.LineString,
  token: string,
  sampleCount = 10,
): Promise<number | null> {
  const samples = sampleLine(geometry, sampleCount);
  if (samples.length < 3) return null;

  const classes = await Promise.all(
    samples.map(([lng, lat]) => nearestStreetClass(lng, lat, token)),
  );
  const known = classes.filter((c) => c !== "unknown");
  if (known.length < 3) return null;
  const road = known.filter((c) => c === "road").length;
  return road / known.length;
}

export async function isMostlyOffCarriageway(
  geometry: GeoJSON.LineString,
  token: string,
  maxShare = MAX_CARRIAGEWAY_SHARE,
): Promise<boolean> {
  const share = await roadCarriagewayShare(geometry, token);
  if (share == null) return true;
  return share <= maxShare;
}

/**
 * Challenger paths carry length-weighted OSM highway mix from the graph.
 * Prefer that over Streets tilequery: service/cycleway cut-throughs (OD-11)
 * are walkable in OSM but often nearest-neighbour to a road class in Streets.
 *
 * Pass when pathish share ≥ 1 − MAX_CARRIAGEWAY_SHARE (same 0.28 road budget).
 * Returns null when OSM stats are missing — caller should fall back to Streets.
 */
export function challengerOsmPathishOk(
  osmPathishShare: number | null | undefined,
  maxRoadShare = MAX_CARRIAGEWAY_SHARE,
): boolean | null {
  if (osmPathishShare == null || !Number.isFinite(osmPathishShare)) {
    return null;
  }
  return osmPathishShare >= 1 - maxRoadShare;
}

/**
 * Path-safe check for score-aware merge.
 * Pass if either signal says walkable:
 * - OSM pathish share (rescues service/cycleway cut-throughs Streets mislabels — OD-11)
 * - Streets tilequery (rescues footway corridors with short road connectors — OD-12)
 * Mapbox candidates still use Streets-only (`isMostlyOffCarriageway`).
 */
export async function isChallengerPathSafe(
  route: {
    geometry: GeoJSON.LineString;
    osm_pathish_share?: number | null;
  },
  token: string,
): Promise<boolean> {
  const osm = challengerOsmPathishOk(route.osm_pathish_share);
  if (osm === true) return true;
  return isMostlyOffCarriageway(route.geometry, token);
}

/** Metres per degree of latitude (longitude is cos-corrected). */
const M_PER_DEG_LAT = 111320;

function cosLat(lat: number): number {
  return Math.max(0.2, Math.cos((lat * Math.PI) / 180));
}

/** Local metric delta between two lng/lat points (east, north in metres). */
function metricDelta(
  from: [number, number],
  to: [number, number],
): [number, number] {
  return [
    (to[0] - from[0]) * M_PER_DEG_LAT * cosLat(from[1]),
    (to[1] - from[1]) * M_PER_DEG_LAT,
  ];
}

/**
 * Visual half-width of the drawn road casing by Streets class (metres).
 * A walk line closer to the centreline than this reads as "on the road".
 */
function roadEdgeTargetM(className: string): number {
  switch (className) {
    case "motorway":
    case "trunk":
    case "primary":
      return 16;
    case "secondary":
      return 15;
    case "tertiary":
      return 11;
    case "street":
      return 7;
    case "street_limited":
    case "service":
      return 4.5;
    default:
      return 9;
  }
}

/** Max metres a single point may be shifted (believability cap). */
const MAX_NUDGE_M = 9;

/**
 * Densify a line to roughly `stepM` spacing, capped at `maxPoints`.
 * Returned points follow the original geometry exactly.
 */
function densifyLine(
  line: GeoJSON.LineString,
  stepM: number,
  maxPoints: number,
): [number, number][] {
  const coords = line.coordinates as [number, number][];
  if (coords.length < 2) return coords.slice();

  let totalM = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ex, ny] = metricDelta(coords[i]!, coords[i + 1]!);
    totalM += Math.hypot(ex, ny);
  }
  const step = Math.max(stepM, totalM / Math.max(2, maxPoints - 1));

  const out: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const [ex, ny] = metricDelta(a, b);
    const segM = Math.hypot(ex, ny);
    const n = Math.max(1, Math.round(segM / step));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  out.push(coords[coords.length - 1]!);
  return out;
}

/** Heading change (degrees) around point i over a ±2 window. */
function turnAngleDeg(pts: [number, number][], i: number): number {
  const a = pts[Math.max(0, i - 2)]!;
  const b = pts[i]!;
  const c = pts[Math.min(pts.length - 1, i + 2)]!;
  const [e1, n1] = metricDelta(a, b);
  const [e2, n2] = metricDelta(b, c);
  const l1 = Math.hypot(e1, n1);
  const l2 = Math.hypot(e2, n2);
  if (l1 < 1 || l2 < 1) return 0;
  const dot = (e1 * e2 + n1 * n2) / (l1 * l2);
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

/**
 * Signed lateral (perpendicular-to-route) shift for one densified point, in
 * metres along the point's perpendicular. Null when no shift is warranted.
 *
 * Priority:
 * 1. Mapped sidewalk within radius and clearly off our line → move toward it
 *    (lateral component only).
 * 2. Point inside the road casing (dist to road centreline < class target),
 *    including "centreline footway" mislabels → push out to the casing edge,
 *    away from the road centreline.
 * Crossings suppress the shift — walkers legitimately cross carriageways.
 * Only along-route road classes (not side-street stubs) set the push target.
 */
function lateralShiftScalarM(
  pt: [number, number],
  perp: [number, number],
  feats: StreetProbe[],
): number | null {
  const crossing = feats.find(
    (f) =>
      (f.className === "crossing" || f.typeName === "crossing") &&
      f.dist_m <= 4,
  );
  if (crossing) return null;

  // Already on a genuinely offset footway/path: leave it alone. Only when the
  // road centreline is essentially coincident (Streets "footway at centre"
  // mislabels — Liara Blvd) do we keep going and push out to the casing edge.
  const onPath = feats.find((f) => f.pathish && f.dist_m <= 3);
  const nearestRoad = feats.find((f) => !f.pathish);
  if (onPath && (!nearestRoad || nearestRoad.dist_m > 4.5)) return null;

  const [px, py] = perp;
  const sidewalk = feats.find((f) => f.sidewalk && f.coords) ?? null;

  // Case 1: sidewalk mapped nearby but our line is not on it.
  if (sidewalk?.coords && sidewalk.dist_m > 3 && sidewalk.dist_m <= 30) {
    const [de, dn] = metricDelta(pt, sidewalk.coords);
    const lat = de * px + dn * py;
    const mag = Math.min(Math.abs(lat), sidewalk.dist_m, MAX_NUDGE_M);
    if (mag >= 1.5) return lat >= 0 ? mag : -mag;
  }

  // Case 2: inside the road casing (on-road, or footway drawn at centre).
  // Prefer the widest road within its own casing target — a big along-route
  // road (secondary) should win over a side-street stub near intersections.
  const road = feats
    .filter((f) => !f.pathish && f.dist_m < roadEdgeTargetM(f.className))
    .sort(
      (a, b) =>
        roadEdgeTargetM(b.className) -
        b.dist_m -
        (roadEdgeTargetM(a.className) - a.dist_m),
    )[0];
  if (road) {
    const pushM = Math.min(
      MAX_NUDGE_M,
      roadEdgeTargetM(road.className) - road.dist_m,
    );
    if (pushM < 1.5) return null;

    if (road.coords) {
      const [de, dn] = metricDelta(pt, road.coords);
      const lat = de * px + dn * py;
      // Away from the road centreline point.
      return lat > 0 ? -pushM : pushM;
    }
    const path = feats.find((f) => f.pathish && f.coords && f.dist_m > 2);
    if (path?.coords) {
      const [de, dn] = metricDelta(pt, path.coords);
      const lat = de * px + dn * py;
      return lat >= 0 ? pushM : -pushM;
    }
    return pushM;
  }

  return null;
}

/** Median of a 5-wide window over signed scalars (nulls treated as 0). */
function medianFilter5(values: Array<number | null>): number[] {
  return values.map((_, i) => {
    const win: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      win.push(values[j] ?? 0);
    }
    win.sort((a, b) => a - b);
    return win[Math.floor(win.length / 2)]!;
  });
}

export type SidewalkNudgeResult = {
  geometry: GeoJSON.LineString;
  /** Share of densified points that were shifted (0–1). */
  nudged_share: number;
  /** Share of points that looked on-carriageway before the shift (0–1). */
  centreline_look_share: number;
};

/**
 * Shift Mapbox walking paint off road carriageways: toward mapped sidewalks
 * when Streets has them, otherwise out to the road-casing edge (Google-style
 * edge paint). Works on a densified polyline with lateral-only offsets,
 * curvature damping at turns (no roundabout swing), and smoothing. Endpoints
 * stay fixed. Distance/duration remain Mapbox routing truth.
 *
 * Track 0 — carriageway truth (16 Aug 2026): OD-12 Liara Blvd + Homestead Rd.
 */
export async function nudgeGeometryTowardSidewalk(
  geometry: GeoJSON.LineString,
  token: string,
  stepM = 30,
  maxPoints = 70,
): Promise<SidewalkNudgeResult> {
  const pts = densifyLine(geometry, stepM, maxPoints);
  if (pts.length < 3) {
    return { geometry, nudged_share: 0, centreline_look_share: 0 };
  }

  const probes = await Promise.all(
    pts.map(([lng, lat]) => probeStreets(lng, lat, token)),
  );

  // Per-point perpendicular unit vectors (metric space).
  const perps: [number, number][] = pts.map((_, i) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(pts.length - 1, i + 1);
    const [te, tn] = metricDelta(pts[lo]!, pts[hi]!);
    const len = Math.hypot(te, tn) || 1;
    return [-tn / len, te / len];
  });

  // Raw signed lateral shifts (metres along each point's perpendicular).
  const raw: Array<number | null> = pts.map((pt, i) =>
    lateralShiftScalarM(pt, perps[i]!, probes[i]!),
  );

  const centrelineLook = raw.filter((s) => s != null).length;
  if (centrelineLook === 0) {
    return { geometry, nudged_share: 0, centreline_look_share: 0 };
  }

  // Curvature damping: kill shifts through turns / roundabouts so the paint
  // hugs the corner instead of swinging wide or into the island.
  const damped: Array<number | null> = raw.map((s, i) => {
    if (s == null) return null;
    const angle = turnAngleDeg(pts, i);
    const k = Math.max(0, 1 - angle / 45);
    if (k <= 0.15) return null;
    return s * k;
  });

  // Side-certainty guard: a shift is only trustworthy when a contiguous run
  // of proposed shifts agrees on which side of the road to move. Lines drawn
  // exactly on the centreline (OSM road ways without sidewalk geometry) give
  // a noise-driven sign per point — painting that weaves across the road
  // (Fordholm Rd). Ambiguous runs are dropped entirely: an honest centreline
  // beats a confident-looking squiggle.
  const guarded: Array<number | null> = damped.slice();
  let runStart = 0;
  while (runStart < guarded.length) {
    if (guarded[runStart] == null) {
      runStart++;
      continue;
    }
    let runEnd = runStart;
    while (runEnd < guarded.length && guarded[runEnd] != null) runEnd++;
    const run = guarded.slice(runStart, runEnd) as number[];
    const pos = run.filter((v) => v > 0).length;
    const neg = run.filter((v) => v < 0).length;
    const dominantShare = Math.max(pos, neg) / Math.max(1, pos + neg);
    if (dominantShare < 0.8) {
      for (let k = runStart; k < runEnd; k++) guarded[k] = null;
    } else {
      // Null stragglers on the minority side so smoothing can't weave.
      const sign = pos >= neg ? 1 : -1;
      for (let k = runStart; k < runEnd; k++) {
        if ((guarded[k] as number) * sign < 0) guarded[k] = null;
      }
    }
    runStart = runEnd;
  }

  // Median filter rejects isolated sign flips (side-street stubs at
  // intersections), then a light average softens the steps.
  const median = medianFilter5(guarded);
  const smoothed: number[] = median.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = -1; k <= 1; k++) {
      const j = i + k;
      if (j < 0 || j >= median.length) continue;
      sum += median[j]!;
      n++;
    }
    return n ? sum / n : 0;
  });

  const nudged = smoothed.filter((s) => Math.abs(s) >= 0.75).length;
  if (nudged === 0) {
    return {
      geometry,
      nudged_share: 0,
      centreline_look_share: centrelineLook / pts.length,
    };
  }

  const out: [number, number][] = pts.map((p, i) => {
    // Keep pins / endpoints stable so From/To markers still meet the line.
    if (i === 0 || i === pts.length - 1) return [p[0], p[1]];
    const s = smoothed[i]!;
    const [px, py] = perps[i]!;
    return [
      p[0] + (px * s) / (M_PER_DEG_LAT * cosLat(p[1])),
      p[1] + (py * s) / M_PER_DEG_LAT,
    ];
  });

  return {
    geometry: { type: "LineString", coordinates: out },
    nudged_share: nudged / pts.length,
    centreline_look_share: centrelineLook / pts.length,
  };
}
