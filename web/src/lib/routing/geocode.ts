import { CASEY_BOUNDS } from "@/lib/scores";

import { pointInCaseyBbox } from "./geo";
import type { LngLat } from "./types";

export type PlaceResult = {
  id: string;
  label: string;
  place_name: string;
  center: LngLat;
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

const CASEY_BBOX = [
  CASEY_BOUNDS.west,
  CASEY_BOUNDS.south,
  CASEY_BOUNDS.east,
  CASEY_BOUNDS.north,
].join(",");

const CASEY_CENTER = `${(CASEY_BOUNDS.west + CASEY_BOUNDS.east) / 2},${(CASEY_BOUNDS.south + CASEY_BOUNDS.north) / 2}`;

/**
 * Forward geocode, biased to Casey. Filters results to Casey bbox.
 */
export async function searchPlaces(
  query: string,
  token: string,
  limit = 5,
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

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
  // Shorten: take first two comma parts
  return name.split(",").slice(0, 2).join(",").trim();
}
