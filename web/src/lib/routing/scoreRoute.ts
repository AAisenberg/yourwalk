import { booleanIntersects } from "@turf/boolean-intersects";
import { buffer } from "@turf/buffer";
import { feature as turfFeature, lineString } from "@turf/helpers";
import { length } from "@turf/length";

import { toDisplayScore } from "./geo";
import type { RouteScore } from "./types";

const BUFFER_KM = 0.02; // 20 m — matches Sprint C / PostGIS default
const MIN_OVERLAP_M = 0.5;
/** Degrees ≈ 20 m pad around corridor bbox (Casey latitudes). */
const BBOX_PAD_DEG = 0.00025;

type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : null;
}

function coordsBBox(coords: GeoJSON.Position[]): BBox | null {
  if (!coords.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of coords) {
    const x = c[0];
    const y = c[1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

function geomBBox(geom: GeoJSON.Geometry): BBox | null {
  switch (geom.type) {
    case "Point":
      return coordsBBox([geom.coordinates]);
    case "MultiPoint":
    case "LineString":
      return coordsBBox(geom.coordinates);
    case "MultiLineString":
    case "Polygon":
      return coordsBBox(geom.coordinates.flat());
    case "MultiPolygon":
      return coordsBBox(geom.coordinates.flat(2));
    case "GeometryCollection": {
      let out: BBox | null = null;
      for (const g of geom.geometries) {
        const b = geomBBox(g);
        if (!b) continue;
        out = out
          ? [
              Math.min(out[0], b[0]),
              Math.min(out[1], b[1]),
              Math.max(out[2], b[2]),
              Math.max(out[3], b[3]),
            ]
          : b;
      }
      return out;
    }
    default:
      return null;
  }
}

function expandBBox(b: BBox, pad: number): BBox {
  return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
}

function bboxOverlaps(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

/**
 * Length-weighted mean of segment scores along a route corridor.
 * Lean client path: uses loaded GeoJSON until PostGIS RPC is applied.
 *
 * Bbox prefilter avoids turf intersects against the full ~27k T1EAM set
 * (main-thread freeze on long walks).
 */
export function scoreRouteAgainstSegments(
  geometry: GeoJSON.LineString,
  segments: GeoJSON.Feature[],
  routeDistanceM?: number,
): RouteScore {
  const line = lineString(geometry.coordinates);
  const corridor = buffer(line, BUFFER_KM, { units: "kilometers" });
  if (!corridor) {
    return emptyScore(routeDistanceM ?? length(line, { units: "meters" }));
  }

  const routeBBox = expandBBox(
    coordsBBox(geometry.coordinates) ?? [0, 0, 0, 0],
    BBOX_PAD_DEG,
  );

  let weightSum = 0;
  let daySum = 0;
  let nightSum = 0;
  let accSum = 0;
  let dayW = 0;
  let nightW = 0;
  let accW = 0;
  const confDay: string[] = [];
  const confNight: string[] = [];
  let segmentCount = 0;

  for (const seg of segments) {
    if (!seg.geometry) continue;
    const props = seg.properties ?? {};
    if (props.score_eligible === false) continue;

    const sb = geomBBox(seg.geometry);
    if (!sb || !bboxOverlaps(routeBBox, sb)) continue;

    const poly = turfFeature(seg.geometry);
    try {
      if (!booleanIntersects(corridor, poly)) continue;
    } catch {
      continue;
    }

    const w =
      num(props.length_m) ??
      Math.max(MIN_OVERLAP_M, length(poly, { units: "meters" }) * 0.15);
    if (w < MIN_OVERLAP_M) continue;

    segmentCount += 1;
    weightSum += w;

    const day = num(props.day_index_score);
    const night = num(props.night_index_score);
    const acc = num(props.accessibility_score);
    if (day != null) {
      daySum += day * w;
      dayW += w;
    }
    if (night != null) {
      nightSum += night * w;
      nightW += w;
    }
    if (acc != null) {
      accSum += acc * w;
      accW += w;
    }

    const cd = str(props.confidence_day);
    const cn = str(props.confidence_night);
    if (cd) confDay.push(cd);
    if (cn) confNight.push(cn);
  }

  const routeLen = routeDistanceM ?? length(line, { units: "meters" });
  const coverage = routeLen > 0 ? weightSum / routeLen : 0;

  let confidenceDay = modeOr(confDay, "reduced");
  let confidenceNight = modeOr(confNight, "reduced");
  if (coverage < 0.35 || segmentCount === 0) {
    confidenceDay = "reduced";
    confidenceNight = "reduced";
  }

  const day_index_score = dayW > 0 ? daySum / dayW : null;
  const night_index_score = nightW > 0 ? nightSum / nightW : null;
  const accessibility_score = accW > 0 ? accSum / accW : null;

  return {
    day_index_score,
    night_index_score,
    accessibility_score,
    day_display: toDisplayScore(day_index_score),
    night_display: toDisplayScore(night_index_score),
    accessibility_display: toDisplayScore(accessibility_score),
    confidence_day: confidenceDay,
    confidence_night: confidenceNight,
    segment_count: segmentCount,
    matched_length_m: weightSum,
    coverage_ratio: coverage,
    source: "client-geojson",
  };
}

function emptyScore(_routeLengthM: number): RouteScore {
  return {
    day_index_score: null,
    night_index_score: null,
    accessibility_score: null,
    day_display: null,
    night_display: null,
    accessibility_display: null,
    confidence_day: "reduced",
    confidence_night: "reduced",
    segment_count: 0,
    matched_length_m: 0,
    coverage_ratio: 0,
    source: "client-geojson",
  };
}

function modeOr(values: string[], fallback: string): string {
  if (!values.length) return fallback;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}
