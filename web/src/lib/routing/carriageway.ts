/**
 * Detect walking geometries that sit on road carriageways (Mapbox Streets).
 * Used to reject trip options that draw down the middle of the road.
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

type TilequeryFeature = {
  properties?: {
    class?: string;
    type?: string;
    tilequery?: { distance?: number };
  };
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

async function nearestStreetClass(
  lng: number,
  lat: number,
  token: string,
): Promise<"path" | "road" | "unknown"> {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", "22");
  url.searchParams.set("limit", "5");
  url.searchParams.set("layers", "road");
  url.searchParams.set("access_token", token);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return "unknown";
    const body = (await res.json()) as { features?: TilequeryFeature[] };
    const feats = [...(body.features ?? [])].sort(
      (a, b) =>
        (a.properties?.tilequery?.distance ?? 999) -
        (b.properties?.tilequery?.distance ?? 999),
    );
    const top = feats[0];
    if (!top) return "unknown";
    return isPathish(top.properties?.class, top.properties?.type)
      ? "path"
      : "road";
  } catch {
    return "unknown";
  }
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
