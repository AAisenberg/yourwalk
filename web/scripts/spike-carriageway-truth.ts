/**
 * Track 0 spike: per-sample road vs path distances on OD-12 Mapbox line.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fetchWalkingRouteCandidates } from "../src/lib/routing/directions";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[m[1]!.trim()]) process.env[m[1]!.trim()] = v;
  }
}

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

function sampleLine(
  line: GeoJSON.LineString,
  n: number,
): [number, number][] {
  const coords = line.coordinates;
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

async function tilequery(lng: number, lat: number, token: string) {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", "30");
  url.searchParams.set("limit", "8");
  url.searchParams.set("layers", "road");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const body = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        class?: string;
        type?: string;
        tilequery?: { distance?: number };
      };
    }>;
  };
  return (body.features ?? [])
    .map((f) => {
      const c = (f.properties?.class ?? "").toLowerCase();
      const t = (f.properties?.type ?? "").toLowerCase();
      const pathish = PATHISH.has(c) || PATHISH.has(t);
      return {
        class: c || t,
        pathish,
        dist_m: f.properties?.tilequery?.distance ?? 999,
        coords: f.geometry?.coordinates,
      };
    })
    .sort((a, b) => a.dist_m - b.dist_m);
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const origin = { lng: 145.324244, lat: -38.056162 };
  const dest = { lng: 145.337065, lat: -38.050622 };
  const mapbox = await fetchWalkingRouteCandidates(origin, dest, token, 3);
  const r = mapbox[0]!;
  console.log("Mapbox", r.strategy, Math.round(r.distance), "m");
  const samples = sampleLine(r.geometry, 10);
  let centreline = 0;
  let pathOk = 0;
  for (let i = 0; i < samples.length; i++) {
    const [lng, lat] = samples[i]!;
    const feats = await tilequery(lng, lat, token);
    const nearestRoad = feats.find((f) => !f.pathish);
    const nearestPath = feats.find((f) => f.pathish);
    const roadD = nearestRoad?.dist_m ?? null;
    const pathD = nearestPath?.dist_m ?? null;
    // Centreline heuristic: road within 6m AND (no path OR path not clearly closer)
    const looksCentre =
      roadD != null &&
      roadD <= 6 &&
      (pathD == null || pathD > roadD + 1.5);
    if (looksCentre) centreline++;
    else pathOk++;
    console.log(`s${i}`, {
      road: nearestRoad
        ? `${nearestRoad.class}@${roadD?.toFixed(1)}m`
        : "—",
      path: nearestPath
        ? `${nearestPath.class}@${pathD?.toFixed(1)}m`
        : "—",
      looksCentre,
    });
  }
  console.log("summary", { centreline, pathOk, share: centreline / samples.length });

  const port = existsSync(resolve("../../.dev-pids/web.port"))
    ? readFileSync(resolve("../../.dev-pids/web.port"), "utf8").trim()
    : "3001";
  const ch = await fetchChallengerRoute(origin, dest, "day", {
    apiBase: `http://localhost:${port}`,
    prefs: { accessibility: 55, shadeHeat: 100 },
  });
  if (ch) {
    console.log("\nChallenger", Math.round(ch.distance_m), "m pathish", ch.osm_pathish_share);
    const cs = sampleLine(ch.geometry, 10);
    let c2 = 0;
    for (let i = 0; i < cs.length; i++) {
      const feats = await tilequery(cs[i]![0], cs[i]![1], token);
      const nearestRoad = feats.find((f) => !f.pathish);
      const nearestPath = feats.find((f) => f.pathish);
      const roadD = nearestRoad?.dist_m ?? null;
      const pathD = nearestPath?.dist_m ?? null;
      const looksCentre =
        roadD != null &&
        roadD <= 6 &&
        (pathD == null || pathD > roadD + 1.5);
      if (looksCentre) c2++;
      console.log(`c${i}`, {
        road: nearestRoad ? `${nearestRoad.class}@${roadD?.toFixed(1)}m` : "—",
        path: nearestPath ? `${nearestPath.class}@${pathD?.toFixed(1)}m` : "—",
        looksCentre,
      });
    }
    console.log("challenger centreline share", c2 / cs.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
