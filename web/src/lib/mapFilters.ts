import type { FilterSpecification } from "mapbox-gl";

export type PathClassFilter = "all" | "footpath" | "shared_use";

/** Mapbox layer filter for suburb + path class. `null` = show all. */
export function segmentsLayerFilter(
  suburb: string,
  pathClass: PathClassFilter,
): FilterSpecification | null {
  const clauses: FilterSpecification[] = [];

  if (suburb && suburb !== "all") {
    clauses.push(["==", ["get", "suburb"], suburb]);
  }
  if (pathClass !== "all") {
    clauses.push(["==", ["get", "walk_path_class"], pathClass]);
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return ["all", ...clauses];
}

export function listSuburbs(features: GeoJSON.Feature[]): string[] {
  const set = new Set<string>();
  for (const f of features) {
    const s = f.properties?.suburb;
    if (typeof s === "string" && s.trim()) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function firstCoord(geom: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!geom || !("coordinates" in geom)) return null;
  const walk = (coords: unknown): [number, number] | null => {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      return [coords[0], coords[1]];
    }
    return walk(coords[0]);
  };
  return walk(geom.coordinates);
}

/** One label point per Casey suburb, averaged from scored footpath geometry. */
export function suburbLabelPoints(
  features: GeoJSON.Feature[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const acc = new Map<string, { x: number; y: number; n: number }>();
  for (const f of features) {
    const raw = f.properties?.suburb;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const pt = firstCoord(f.geometry);
    if (!pt) continue;
    const key = raw.trim();
    const cur = acc.get(key) ?? { x: 0, y: 0, n: 0 };
    cur.x += pt[0];
    cur.y += pt[1];
    cur.n += 1;
    acc.set(key, cur);
  }
  return {
    type: "FeatureCollection",
    features: [...acc.entries()].map(([suburb, { x, y, n }]) => ({
      type: "Feature",
      properties: { suburb },
      geometry: { type: "Point", coordinates: [x / n, y / n] },
    })),
  };
}

export function countMatching(
  features: GeoJSON.Feature[],
  suburb: string,
  pathClass: PathClassFilter,
): number {
  return features.filter((f) => {
    const p = f.properties || {};
    if (suburb !== "all" && p.suburb !== suburb) return false;
    if (pathClass !== "all" && p.walk_path_class !== pathClass) return false;
    return true;
  }).length;
}

/** Lon/lat bounds [[west,south],[east,north]] or null if empty. */
export function boundsForFilter(
  features: GeoJSON.Feature[],
  suburb: string,
  pathClass: PathClassFilter,
): [[number, number], [number, number]] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let n = 0;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords) || coords.length === 0) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const x = coords[0] as number;
      const y = coords[1] as number;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      n += 1;
      return;
    }
    for (const c of coords) visit(c);
  };

  for (const f of features) {
    const p = f.properties || {};
    if (suburb !== "all" && p.suburb !== suburb) continue;
    if (pathClass !== "all" && p.walk_path_class !== pathClass) continue;
    if (f.geometry) {
      visit(
        (f.geometry as GeoJSON.Geometry & { coordinates: unknown }).coordinates,
      );
    }
  }

  if (n === 0 || !Number.isFinite(minX)) return null;
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
