import { CASEY_BOUNDS } from "@/lib/scores";

import { pointInCaseyBbox } from "./geo";
import type { LngLat } from "./types";

export type PlaceResult = {
  id: string;
  label: string;
  place_name: string;
  /** What From / To should show after a pick: place name, not a street number. */
  fieldLabel: string;
  suburb?: string;
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

type SearchBoxContext = {
  locality?: { name?: string };
  place?: { name?: string };
  neighborhood?: { name?: string };
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
    context?: SearchBoxContext;
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

/**
 * Map-tap civic destinations only. Shops, cafes, surgeries, and township
 * names stay out of the pin label. Parks come from Casey polygons, not
 * this list (Mapbox park points steal nearby streets).
 */
const TAP_CIVIC = [
  "hospital",
  "school",
  "university",
  "nursing home",
  "aged care",
  "library",
];

const TAP_CIVIC_MAX_M = 45;

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

export function suburbFromContext(
  ctx: SearchBoxContext | undefined,
): string | undefined {
  const locality = ctx?.locality?.name?.trim();
  if (locality && !/^melbourne$/i.test(locality)) return locality;
  const place = ctx?.place?.name?.trim();
  if (place && !/^melbourne$/i.test(place)) return place;
  return undefined;
}

/** "Wilson Botanic Park" + Berwick → "Wilson Botanic Park, Berwick". */
export function composeFieldLabel(name: string, suburb?: string): string {
  const clean = name.trim();
  if (!clean) return "";
  if (!suburb) return clean;
  const sub = suburb.trim();
  if (!sub || /^melbourne$/i.test(sub)) return clean;
  if (clean.toLowerCase() === sub.toLowerCase()) return clean;
  if (clean.toLowerCase().endsWith(` ${sub.toLowerCase()}`)) {
    return `${clean.slice(0, clean.length - sub.length).trim()}, ${sub}`;
  }
  if (clean.toLowerCase().includes(sub.toLowerCase())) return clean;
  return `${clean}, ${sub}`;
}

/** Strip state / postcode / Australia. Keep "Name, Suburb". */
export function shortenPlaceLabel(s: string): string {
  if (!s) return "";
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      if (/^(Australia|Victoria|VIC)$/i.test(p)) return false;
      if (/^(Victoria|VIC)\s+\d{4}$/i.test(p)) return false;
      if (/^\d{4}$/.test(p)) return false;
      return true;
    });
  const name = parts[0] ?? "";
  let locality = (parts[1] ?? "")
    .replace(/\s*(Victoria|VIC)(\s+\d{4})?\s*$/i, "")
    .trim();
  if (/^melbourne$/i.test(locality)) locality = "";
  return locality ? `${name}, ${locality}` : name;
}

export function fieldLabelFromPlace(r: PlaceResult): string {
  return r.fieldLabel || composeFieldLabel(r.label, r.suburb);
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
  const suburb = suburbFromContext(p.context);
  return {
    id: p.mapbox_id || `${label}-${center.lng}-${center.lat}`,
    label,
    place_name,
    fieldLabel: composeFieldLabel(label, suburb),
    suburb,
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
    const label = f.text ?? f.place_name.split(",")[0] ?? f.place_name;
    out.push({
      id: f.id,
      label,
      place_name: f.place_name,
      fieldLabel: shortenPlaceLabel(f.place_name),
      center,
    });
  }
  return out;
}

function coordsLabel(point: LngLat): string {
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

function distanceMetres(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const rlat1 = (a.lat * Math.PI) / 180;
  const rlat2 = (b.lat * Math.PI) / 180;
  const dlat = rlat2 - rlat1;
  const dlng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dlng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function catsOf(f: SearchBoxFeature): string[] {
  return (f.properties?.poi_category ?? []).map((c) => c.toLowerCase());
}

function hasNeedle(cats: string[], needles: string[]): boolean {
  return cats.some((c) => needles.some((n) => c.includes(n)));
}

function isCivicTapPoi(cats: string[]): boolean {
  if (
    hasNeedle(cats, [
      "bus stop",
      "parking",
      "shopping",
      "dentist",
      "doctor",
      "clinic",
    ])
  ) {
    return false;
  }
  return hasNeedle(cats, TAP_CIVIC);
}

function isTownshipLikeName(name: string): boolean {
  return /township|town centre|activity centre|\bvillage\b/i.test(name);
}

type CaseyParkHit = { name: string; suburb?: string };

async function lookupCaseyPark(point: LngLat): Promise<CaseyParkHit | null> {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL("/api/casey-park", window.location.origin);
    url.searchParams.set("lng", String(point.lng));
    url.searchParams.set("lat", String(point.lat));
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: string; suburb?: string };
    const name = body.name?.trim();
    if (!name) return null;
    return { name, suburb: body.suburb?.trim() || undefined };
  } catch {
    return null;
  }
}

/**
 * Tap label from Search Box. Address is the default. A civic POI wins
 * only when the tap is on that site. Parks are not decided here.
 */
function labelFromSearchBoxReverse(
  point: LngLat,
  features: SearchBoxFeature[],
): string | null {
  let civic: { label: string; dist: number } | null = null;
  let address: string | null = null;

  for (const f of features) {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    if (!p?.name || !coords || coords.length < 2) continue;
    const name = p.name.trim();
    if (isTownshipLikeName(name)) continue;
    const center = { lng: coords[0], lat: coords[1] };
    const dist = distanceMetres(point, center);
    const suburb = suburbFromContext(p.context);
    const label = composeFieldLabel(name, suburb);
    const type = p.feature_type ?? "";

    if (type === "address" && !address) {
      address = label;
      continue;
    }
    if (type !== "poi" || !isCivicTapPoi(catsOf(f))) continue;
    if (dist > TAP_CIVIC_MAX_M) continue;
    if (!civic || dist < civic.dist) civic = { label, dist };
  }

  return civic?.label ?? address;
}

async function searchBoxReverse(
  point: LngLat,
  token: string,
): Promise<string | null> {
  const url = new URL("https://api.mapbox.com/search/searchbox/v1/reverse");
  url.searchParams.set("longitude", String(point.lng));
  url.searchParams.set("latitude", String(point.lat));
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "au");
  url.searchParams.set("types", "poi,address");
  url.searchParams.set("limit", "8");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const body = (await res.json()) as SearchBoxResponse;
  return labelFromSearchBoxReverse(point, body.features ?? []);
}

async function reverseGeocodeV5Address(
  point: LngLat,
  token: string,
): Promise<string | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("types", "address");
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const body = (await res.json()) as MapboxGeocodeResponse;
  const name = body.features?.[0]?.place_name;
  return name ? shortenPlaceLabel(name) : null;
}

/**
 * Label for a map tap or geolocate. The pin stays on the tap.
 *
 * 1. Inside a Casey park or reserve polygon → that park name
 * 2. On a school, hospital, library, or aged-care site (about 45 m) → that name
 * 3. Otherwise the nearest street address
 *
 * Shops, cafes, and township names are not used as tap labels. Typed search
 * can still find those if someone looks them up.
 */
export async function reverseGeocode(
  point: LngLat,
  token: string,
): Promise<string> {
  const [park, boxed] = await Promise.all([
    lookupCaseyPark(point),
    searchBoxReverse(point, token).catch(() => null),
  ]);
  if (park) return composeFieldLabel(park.name, park.suburb);
  if (boxed) return boxed;
  const v5 = await reverseGeocodeV5Address(point, token).catch(() => null);
  return v5 || coordsLabel(point);
}
