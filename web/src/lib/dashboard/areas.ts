/**
 * Council insights roll-ups (docs/DASHBOARD.md). Length-weighted mean of the
 * scored segments tagged to each suburb or ward. Missing values are skipped,
 * never treated as zero. Must agree with
 * pipeline/scripts/extract_dashboard_area_ranks.py.
 *
 * Everything officers see is on one 0–10 scale. Streams are stored 0–100 in
 * the data and divided by 10 for display.
 */

export type AreaUnit = "suburb" | "ward";
export type IndexMode = "day" | "night";
/** What the map paints and the list ranks: the full index or one stream. */
export type ScoreView = "index" | "footpaths" | "stream";
export type StreamName = "Footpaths" | "Heat and shade" | "Night lighting";
export type Confidence = "low" | "medium" | "high";

/** Locked v1.1 weights (docs/VULNERABILITY_INDEX.md): shared 60, mode-specific 40. */
export const FOOTPATHS_WEIGHT = 0.6;
export const STREAM_WEIGHT = 0.4;

export type AreaStats = {
  id: string;
  name: string;
  unit: AreaUnit;
  /** 0–10, one decimal (same scale as resident pills). */
  day: number | null;
  night: number | null;
  /** Unrounded 0–100 stream means; round only for display. */
  footpaths: number | null;
  heatShade: number | null;
  nightLighting: number | null;
  segments: number;
  lengthKm: number;
  /** Length-weighted modal confidence for each index. */
  confidenceDay: Confidence | null;
  confidenceNight: Confidence | null;
  thin: boolean;
};

export type CaseySummary = Omit<AreaStats, "id" | "name" | "unit" | "thin">;

/** Below either threshold, the roll-up carries a thin-coverage note. */
export const THIN_SEGMENTS = 50;
export const THIN_KM = 2;

type Acc = { sum: number; w: number };

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function add(acc: Acc, v: unknown, w: number) {
  const n = num(v);
  if (n == null) return;
  acc.sum += n * w;
  acc.w += w;
}

function mean(acc: Acc): number | null {
  return acc.w > 0 ? acc.sum / acc.w : null;
}

export function round1(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}

function modalConfidence(weights: Record<string, number>): Confidence | null {
  let best: Confidence | null = null;
  let bestW = 0;
  for (const key of ["low", "medium", "high"] as const) {
    const w = weights[key] ?? 0;
    if (w > bestW) {
      best = key;
      bestW = w;
    }
  }
  return best;
}

export function slugArea(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

type Bucket = {
  day: Acc;
  night: Acc;
  footpaths: Acc;
  heat: Acc;
  lighting: Acc;
  segments: number;
  lengthM: number;
  confDay: Record<string, number>;
  confNight: Record<string, number>;
};

function emptyBucket(): Bucket {
  return {
    day: { sum: 0, w: 0 },
    night: { sum: 0, w: 0 },
    footpaths: { sum: 0, w: 0 },
    heat: { sum: 0, w: 0 },
    lighting: { sum: 0, w: 0 },
    segments: 0,
    lengthM: 0,
    confDay: {},
    confNight: {},
  };
}

function addFeature(b: Bucket, p: GeoJSON.GeoJsonProperties, w: number) {
  if (!p) return;
  add(b.day, p.day_index_score, w);
  add(b.night, p.night_index_score, w);
  add(b.footpaths, p.accessibility_score, w);
  add(b.heat, p.heat_shade_score, w);
  add(b.lighting, p.lighting_after_dark_score, w);
  b.segments += 1;
  b.lengthM += w;
  const cd = typeof p.confidence_day === "string" ? p.confidence_day : null;
  const cn = typeof p.confidence_night === "string" ? p.confidence_night : null;
  if (cd) b.confDay[cd] = (b.confDay[cd] ?? 0) + w;
  if (cn) b.confNight[cn] = (b.confNight[cn] ?? 0) + w;
}

function summarise(b: Bucket): CaseySummary {
  const day100 = mean(b.day);
  const night100 = mean(b.night);
  return {
    day: round1(day100 == null ? null : day100 / 10),
    night: round1(night100 == null ? null : night100 / 10),
    footpaths: mean(b.footpaths),
    heatShade: mean(b.heat),
    nightLighting: mean(b.lighting),
    segments: b.segments,
    lengthKm: Math.round(b.lengthM / 100) / 10,
    confidenceDay: modalConfidence(b.confDay),
    confidenceNight: modalConfidence(b.confNight),
  };
}

function weightOf(p: GeoJSON.GeoJsonProperties): number {
  const w = num(p?.length_m);
  return w != null && w > 0 ? w : 0;
}

/** Roll every scored segment up to one unit (suburb or ward). */
export function rollUpAreas(features: GeoJSON.Feature[], unit: AreaUnit): AreaStats[] {
  const buckets = new Map<string, Bucket>();
  for (const f of features) {
    const p = f.properties;
    const w = weightOf(p);
    if (!w) continue;
    const raw = p?.[unit];
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    let b = buckets.get(name);
    if (!b) {
      b = emptyBucket();
      buckets.set(name, b);
    }
    addFeature(b, p, w);
  }
  return [...buckets.entries()].map(([name, b]) => {
    const s = summarise(b);
    return {
      ...s,
      id: slugArea(name),
      name,
      unit,
      thin: s.segments < THIN_SEGMENTS || s.lengthKm < THIN_KM,
    };
  });
}

export function summariseCasey(features: GeoJSON.Feature[]): CaseySummary {
  const b = emptyBucket();
  for (const f of features) {
    const w = weightOf(f.properties);
    if (w) addFeature(b, f.properties, w);
  }
  return summarise(b);
}

export function streamName(mode: IndexMode): StreamName {
  return mode === "day" ? "Heat and shade" : "Night lighting";
}

export function viewName(mode: IndexMode, view: ScoreView): string {
  if (view === "footpaths") return "Footpaths";
  if (view === "stream") return streamName(mode);
  return mode === "day" ? "Day score" : "Night score";
}

function stream100(a: AreaStats | CaseySummary, mode: IndexMode): number | null {
  return mode === "day" ? a.heatShade : a.nightLighting;
}

/** The number the list ranks and shows for this view, on the 0–10 scale. */
export function areaValue(
  a: AreaStats | CaseySummary,
  mode: IndexMode,
  view: ScoreView = "index",
): number | null {
  if (view === "footpaths") return round1(a.footpaths == null ? null : a.footpaths / 10);
  if (view === "stream") {
    const s = stream100(a, mode);
    return round1(s == null ? null : s / 10);
  }
  return mode === "day" ? a.day : a.night;
}

export type BreakdownPart = {
  name: StreamName;
  /** Stream score on 0–10. */
  score: number | null;
  /** Points this stream adds to the index, and the most it could add. */
  points: number | null;
  maxPoints: number;
};

/**
 * Round two parts to tenths so they add up exactly to the shown total
 * (largest remainder). Plain rounding misses the total by 0.1 for about a
 * third of Casey suburbs. Returns null if the parts are too far off to share.
 */
function partsThatAddUp(a: number, b: number, total: number): [number, number] | null {
  const target = Math.round(total * 10);
  const fa = Math.floor(a * 10);
  const fb = Math.floor(b * 10);
  let diff = target - fa - fb;
  if (diff < 0 || diff > 2) return null;
  const order = a * 10 - fa >= b * 10 - fb ? [0, 1] : [1, 0];
  const out = [fa, fb];
  for (const i of order) {
    if (diff <= 0) break;
    out[i] += 1;
    diff -= 1;
  }
  return [out[0] / 10, out[1] / 10];
}

/** The index as two parts that add up: Footpaths (up to 6) + stream (up to 4). */
export function breakdown(
  a: AreaStats | CaseySummary,
  mode: IndexMode,
): { footpaths: BreakdownPart; stream: BreakdownPart; total: number | null } {
  const foot = a.footpaths;
  const other = stream100(a, mode);
  const footPts = foot == null ? null : (foot / 100) * 10 * FOOTPATHS_WEIGHT;
  const otherPts = other == null ? null : (other / 100) * 10 * STREAM_WEIGHT;
  const total = mode === "day" ? a.day : a.night;
  let shownFoot = round1(footPts);
  let shownOther = round1(otherPts);
  if (footPts != null && otherPts != null && total != null) {
    const pair = partsThatAddUp(footPts, otherPts, total);
    if (pair) [shownFoot, shownOther] = pair;
  }
  return {
    footpaths: {
      name: "Footpaths",
      score: round1(foot == null ? null : foot / 10),
      points: shownFoot,
      maxPoints: 10 * FOOTPATHS_WEIGHT,
    },
    stream: {
      name: streamName(mode),
      score: round1(other == null ? null : other / 10),
      points: shownOther,
      maxPoints: 10 * STREAM_WEIGHT,
    },
    total,
  };
}

export type HeldBack =
  | { kind: "stream"; name: StreamName; score: number; casey: number }
  | { kind: "above" }
  | null;

/** A part must cost at least 0.1 of the 0–10 score before we name it. */
const HELD_BACK_MIN_POINTS = 0.1;

/**
 * Which part pulls this area below Casey the most, in index points
 * (a stream gap is weighted by how much that stream counts).
 */
export function heldBackBy(
  a: AreaStats | CaseySummary,
  casey: CaseySummary,
  mode: IndexMode,
): HeldBack {
  const parts: { name: StreamName; v: number | null; c: number | null; w: number }[] = [
    { name: "Footpaths", v: a.footpaths, c: casey.footpaths, w: FOOTPATHS_WEIGHT },
    { name: streamName(mode), v: stream100(a, mode), c: stream100(casey, mode), w: STREAM_WEIGHT },
  ];
  let worst: (typeof parts)[number] | null = null;
  let worstGap = HELD_BACK_MIN_POINTS * 10;
  for (const p of parts) {
    if (p.v == null || p.c == null) continue;
    // 0–100 gap × weight is tenths of an index point
    const gap = (p.c - p.v) * p.w;
    if (gap >= worstGap) {
      worst = p;
      worstGap = gap;
    }
  }
  if (!worst) {
    return parts.every((p) => p.v != null && p.c != null) ? { kind: "above" } : null;
  }
  return {
    kind: "stream",
    name: worst.name,
    score: round1(worst.v! / 10)!,
    casey: round1(worst.c! / 10)!,
  };
}

/** Weakest first on the selected view; unscored areas sink to the end. */
export function rankAreas(
  areas: AreaStats[],
  mode: IndexMode,
  view: ScoreView = "index",
): AreaStats[] {
  const raw = (a: AreaStats) => {
    if (view === "footpaths") return a.footpaths;
    if (view === "stream") return stream100(a, mode);
    return mode === "day" ? a.day : a.night;
  };
  return [...areas].sort((a, b) => {
    const av = raw(a);
    const bv = raw(b);
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv || a.name.localeCompare(b.name);
  });
}

export function featuresInArea(
  features: GeoJSON.Feature[],
  unit: AreaUnit,
  name: string,
): GeoJSON.Feature[] {
  return features.filter((f) => {
    const raw = f.properties?.[unit];
    return typeof raw === "string" && raw.trim() === name;
  });
}
