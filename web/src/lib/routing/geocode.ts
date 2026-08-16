import { CASEY_BOUNDS } from "@/lib/scores";

import { pointInCaseyBbox } from "./geo";
import type { LngLat } from "./types";

export type PlaceResult = {
  id: string;
  label: string;
  place_name: string;
  center: LngLat;
  /** Quiet row hint, e.g. School or Hospital */
  kind?: string;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  text?: string;
  center: [number, number];
};

type MapboxGeocodeResponse = {
  features?: MapboxFeature[];
};

type SearchBoxFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
    feature_type?: string;
    poi_category?: string[];
  };
};

type SearchBoxResponse = {
  features?: SearchBoxFeature[];
};

const CASEY_BBOX = [
  CASEY_BOUNDS.west,
  CASEY_BOUNDS.south,
  CASEY_BOUNDS.east,
  CASEY_BOUNDS.north,
].join(",");

const CASEY_CENTER = `${(CASEY_BOUNDS.west + CASEY_BOUNDS.east) / 2},${(CASEY_BOUNDS.south + CASEY_BOUNDS.north) / 2}`;

const KIND_HINTS = [
  "hospital",
  "school",
  "university",
  "nursing home",
  "aged care",
  "clinic",
  "park",
  "shopping",
  "library",
  "station",
];

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function kindFromCategories(cats: string[] | undefined): string | undefined {
  if (!cats?.length) return undefined;
  const lower = cats.map((c) => c.toLowerCase());
  const hit = KIND_HINTS.find((k) => lower.some((c) => c.includes(k)));
  return titleCase(hit ?? cats[0]!);
}

function fromSearchBox(f: SearchBoxFeature): PlaceResult | null {
  const coords = f.geometry?.coordinates;
  const p = f.properties;
  if (!coords || coords.length < 2 || !p) return null;
  const center = { lng: coords[0], lat: coords[1] };
  if (!pointInCaseyBbox(center)) return null;
  const label = p.name?.trim() || p.full_address?.split(",")[0] || "Place";
  const place_name =
    p.full_address?.trim() ||
    [p.address, p.place_formatted].filter(Boolean).join(", ") ||
    label;
  return {
    id: p.mapbox_id || `${label}-${center.lng}-${center.lat}`,
    label,
    place_name,
    center,
    kind: p.feature_type === "poi" ? kindFromCategories(p.poi_category) : undefined,
  };
}

/**
 * Forward search, biased to Casey. Search Box first (schools, hospitals,
 * aged care, parks). Geocoding v5 is a fallback — it barely returns Casey POIs.
 */
export async function searchPlaces(
  query: string,
  token: string,
  limit = 8,
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const boxed = await searchBoxForward(q, token, limit);
    if (boxed.length) return boxed;
  } catch {
    /* fall through to v5 */
  }
  return searchGeocodeV5(q, token, limit);
}

async function searchBoxForward(
  q: string,
  token: string,
  limit: number,
): Promise<PlaceResult[]> {
  const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "au");
  url.searchParams.set("bbox", CASEY_BBOX);
  url.searchParams.set("proximity", CASEY_CENTER);
  url.searchParams.set(
    "types",
    "poi,place,locality,neighborhood,street,address",
  );
  url.searchParams.set("limit", String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set("language", "en");
  url.searchParams.set("auto_complete", "true");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Search Box failed (${res.status})`);
  }
  const body = (await res.json()) as SearchBoxResponse;
  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const f of body.features ?? []) {
    const row = fromSearchBox(f);
    if (!row) continue;
    const key = `${row.label.toLowerCase()}|${row.center.lng.toFixed(4)}|${row.center.lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function searchGeocodeV5(
  q: string,
  token: string,
  limit: number,
): Promise<PlaceResult[]> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "AU");
  url.searchParams.set("bbox", CASEY_BBOX);
  url.searchParams.set("proximity", CASEY_CENTER);
  url.searchParams.set("types", "address,poi,place,locality,neighborhood");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }

  const body = (await res.json()) as MapboxGeocodeResponse;
  const out: PlaceResult[] = [];
  for (const f of body.features ?? []) {
    const center = { lng: f.center[0], lat: f.center[1] };
    if (!pointInCaseyBbox(center)) continue;
    out.push({
      id: f.id,
      label: f.text ?? f.place_name.split(",")[0] ?? f.place_name,
      place_name: f.place_name,
      center,
    });
  }
  return out;
}

/** Reverse geocode for map-tap labels. */
export async function reverseGeocode(
  point: LngLat,
  token: string,
): Promise<string> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("types", "address,poi,place,locality");
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;

  const body = (await res.json()) as MapboxGeocodeResponse;
  const name = body.features?.[0]?.place_name;
  if (!name) return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
  return name.split(",").slice(0, 2).join(",").trim();
}
