import type { LngLat } from "./types";

export type ChallengerRoute = {
  engine: string;
  strategy: string;
  distance_m: number;
  duration_s: number;
  geometry: GeoJSON.LineString;
  detour_vs_graph_shortest?: number | null;
  capped_from_detour?: number | null;
};

type ChallengerResponse = {
  route?: ChallengerRoute;
  error?: string;
};

/**
 * Fetch OSM+Casey score-aware path via Next proxy → local serve_challenger.py.
 * Returns null if the service is down (Mapbox-only fallback).
 */
export async function fetchChallengerRoute(
  origin: LngLat,
  destination: LngLat,
  mode: "day" | "night" = "day",
): Promise<ChallengerRoute | null> {
  try {
    const res = await fetch("/api/challenger-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lng: origin.lng, lat: origin.lat },
        destination: { lng: destination.lng, lat: destination.lat },
        mode,
      }),
    });
    if (!res.ok) {
      if (res.status !== 503 && res.status !== 404) {
        console.warn(`Challenger HTTP ${res.status}`);
      }
      return null;
    }
    const body = (await res.json()) as ChallengerResponse;
    if (!body.route?.geometry?.coordinates?.length) return null;
    return body.route;
  } catch (err) {
    console.warn("Challenger unavailable", err);
    return null;
  }
}
