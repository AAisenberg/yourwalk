/**
 * Sample Mapbox Terrain-RGB along a walk line.
 *
 * Uses the public Terrain-RGB tileset (same family as Mapbox Terrain-DEM).
 * Resolution is roughly 10–30 m, so grades are estimates only.
 */

import {
  densifyLine,
  profileFromElevations,
  SAMPLE_STEP_M,
  type RouteElevation,
} from "./elevation";
import type { ScoredRoute } from "./types";

const TERRAIN_Z = 14;
/** Reject Terrain-RGB values that are clearly not ground in Casey. */
const MIN_PLAUSIBLE_M = -20;
const MAX_PLAUSIBLE_M = 2500;

type TileKey = `${number}/${number}/${number}`;

function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n,
  );
  return { x, y };
}

function lngLatToPixel(
  lng: number,
  lat: number,
  z: number,
  tileSize: number,
): { x: number; y: number; tx: number; ty: number } {
  const n = 2 ** z;
  const xFloat = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tx = Math.floor(xFloat);
  const ty = Math.floor(yFloat);
  return {
    tx,
    ty,
    x: Math.min(tileSize - 1, Math.max(0, Math.floor((xFloat - tx) * tileSize))),
    y: Math.min(tileSize - 1, Math.max(0, Math.floor((yFloat - ty) * tileSize))),
  };
}

export function decodeTerrainRgb(r: number, g: number, b: number): number | null {
  const height = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  if (!Number.isFinite(height)) return null;
  if (height < MIN_PLAUSIBLE_M || height > MAX_PLAUSIBLE_M) return null;
  return height;
}

async function imageDataFromBlob(blob: Blob): Promise<ImageData | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function fetchTerrainTile(
  z: number,
  x: number,
  y: number,
  token: string,
  cache: Map<TileKey, ImageData | null>,
  signal?: AbortSignal,
): Promise<ImageData | null> {
  const key: TileKey = `${z}/${x}/${y}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await imageDataFromBlob(await res.blob());
    cache.set(key, data);
    return data;
  } catch {
    cache.set(key, null);
    return null;
  }
}

function heightAt(
  lng: number,
  lat: number,
  tile: ImageData,
  z: number,
): number | null {
  const pix = lngLatToPixel(lng, lat, z, tile.width);
  const idx = (pix.y * tile.width + pix.x) * 4;
  return decodeTerrainRgb(tile.data[idx], tile.data[idx + 1], tile.data[idx + 2]);
}

export async function sampleLineElevations(
  line: GeoJSON.LineString,
  token: string,
  cache: Map<TileKey, ImageData | null>,
  signal?: AbortSignal,
): Promise<RouteElevation | null> {
  const points = densifyLine(line, SAMPLE_STEP_M);
  if (points.length < 3) return null;

  const elevations: Array<number | null> = [];
  for (const [lng, lat] of points) {
    if (signal?.aborted) return null;
    const { x, y } = lngLatToTile(lng, lat, TERRAIN_Z);
    const tile = await fetchTerrainTile(TERRAIN_Z, x, y, token, cache, signal);
    elevations.push(tile ? heightAt(lng, lat, tile, TERRAIN_Z) : null);
  }
  return profileFromElevations(points, elevations);
}

export async function attachElevationProfiles(
  routes: ScoredRoute[],
  token: string,
  signal?: AbortSignal,
): Promise<ScoredRoute[]> {
  if (!token || typeof document === "undefined") {
    return routes.map((r) => ({ ...r, elevation: r.elevation ?? null }));
  }
  const cache = new Map<TileKey, ImageData | null>();
  const out: ScoredRoute[] = [];
  for (const route of routes) {
    if (signal?.aborted) return routes;
    try {
      const elevation = await sampleLineElevations(
        route.geometry,
        token,
        cache,
        signal,
      );
      out.push({ ...route, elevation });
    } catch {
      out.push({ ...route, elevation: null });
    }
  }
  return out;
}
