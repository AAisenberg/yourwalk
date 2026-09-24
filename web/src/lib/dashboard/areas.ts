/**
 * Council insights roll-ups (docs/DASHBOARD.md). Length-weighted mean of the
 * scored segments tagged to each suburb or ward. Missing values are skipped,
 * never treated as zero. Must agree with
 * pipeline/scripts/extract_dashboard_area_ranks.py.
 */

export type AreaUnit = "suburb" | "ward";
export type IndexMode = "day" | "night";
export type StreamTag = "Footpaths" | "Heat and shade" | "Night lighting";
export type Confidence = "low" | "medium" | "high";

export type AreaStats = {
  id: string;
  name: string;
  unit: AreaUnit;
  /** 0–10, one decimal (same scale as resident pills). */
  day: number | null;
  night: number | null;
  /** Streams 0–100. */
  footpaths: number | null;
  heatShade: number | null;
  nightLighting: number | null;
  segments: number;
  lengthKm: number;
  /** Length-weighted modal confidence for each index. */
  confidenceDay: Confidence | null;
  confidenceNight: Confidence | null;
  thin: boolean;
  tagsDay: StreamTag[];
  tagsNight: StreamTag[];
};

export type CaseySummary = Omit<
  AreaStats,
  "id" | "name" | "unit" | "thin" | "tagsDay" | "tagsNight"
>;

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

function round1(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}

function round0(v: number | null): number | null {
  return v == null ? null : Math.round(v);
}

function modalConfidence(
  weights: Record<string, number>,
): Confidence | null {
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
    footpaths: round0(mean(b.footpaths)),
    heatShade: round0(mean(b.heat)),
    nightLighting: round0(mean(b.lighting)),
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

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function tagStreams(areas: AreaStats[]) {
  const medFoot = median(
    areas.map((a) => a.footpaths).filter((v): v is number => v != null),
  );
  const medHeat = median(
    areas.map((a) => a.heatShade).filter((v): v is number => v != null),
  );
  const medLight = median(
    areas.map((a) => a.nightLighting).filter((v): v is number => v != null),
  );
  for (const a of areas) {
    const foot = medFoot != null && a.footpaths != null && a.footpaths < medFoot;
    const heat = medHeat != null && a.heatShade != null && a.heatShade < medHeat;
    const light =
      medLight != null && a.nightLighting != null && a.nightLighting < medLight;
    a.tagsDay = [
      ...(foot ? (["Footpaths"] as const) : []),
      ...(heat ? (["Heat and shade"] as const) : []),
    ];
    a.tagsNight = [
      ...(foot ? (["Footpaths"] as const) : []),
      ...(light ? (["Night lighting"] as const) : []),
    ];
  }
}

/** Roll every scored segment up to one unit (suburb or ward). */
export function rollUpAreas(
  features: GeoJSON.Feature[],
  unit: AreaUnit,
): AreaStats[] {
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
  const areas: AreaStats[] = [...buckets.entries()].map(([name, b]) => {
    const s = summarise(b);
    return {
      ...s,
      id: slugArea(name),
      name,
      unit,
      thin: s.segments < THIN_SEGMENTS || s.lengthKm < THIN_KM,
      tagsDay: [],
      tagsNight: [],
    };
  });
  tagStreams(areas);
  return areas;
}

export function summariseCasey(features: GeoJSON.Feature[]): CaseySummary {
  const b = emptyBucket();
  for (const f of features) {
    const w = weightOf(f.properties);
    if (w) addFeature(b, f.properties, w);
  }
  return summarise(b);
}

/** Weakest first on the selected index; unscored areas sink to the end. */
export function rankAreas(areas: AreaStats[], mode: IndexMode): AreaStats[] {
  return [...areas].sort((a, b) => {
    const av = mode === "day" ? a.day : a.night;
    const bv = mode === "day" ? b.day : b.night;
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv || a.name.localeCompare(b.name);
  });
}

export function areaIndex(a: AreaStats | CaseySummary, mode: IndexMode) {
  return mode === "day" ? a.day : a.night;
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
