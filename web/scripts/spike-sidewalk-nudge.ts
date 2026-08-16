/**
 * Where is sidewalk vs footway vs road along OD-12 Mapbox?
 */
import { readFileSync, existsSync } from "fs";
import { fetchWalkingRouteCandidates } from "../src/lib/routing/directions";

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

function sampleLine(line: GeoJSON.LineString, n: number): [number, number][] {
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

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const mapbox = await fetchWalkingRouteCandidates(
    { lng: 145.324244, lat: -38.056162 },
    { lng: 145.337065, lat: -38.050622 },
    token,
    1,
  );
  const samples = sampleLine(mapbox[0]!.geometry, 12);
  let nudgeCandidates = 0;
  for (let i = 0; i < samples.length; i++) {
    const [lng, lat] = samples[i]!;
    const url = new URL(
      `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
    );
    url.searchParams.set("radius", "28");
    url.searchParams.set("limit", "10");
    url.searchParams.set("layers", "road");
    url.searchParams.set("access_token", token);
    const body = (await (await fetch(url.toString())).json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          class?: string;
          type?: string;
          tilequery?: { distance?: number };
        };
      }>;
    };
    const feats = (body.features ?? [])
      .map((f) => ({
        class: f.properties?.class,
        type: f.properties?.type,
        dist: f.properties?.tilequery?.distance ?? 999,
        coords: f.geometry?.coordinates,
      }))
      .sort((a, b) => a.dist - b.dist);
    const road = feats.find(
      (f) =>
        f.class &&
        !["path", "pedestrian", "footway", "sidewalk", "crossing", "steps", "cycleway", "track", "bridleway", "corridor"].includes(
          f.class,
        ) &&
        f.type !== "sidewalk" &&
        f.type !== "footway",
    );
    const sidewalk = feats.find(
      (f) => f.type === "sidewalk" || f.class === "sidewalk",
    );
    const footway = feats.find(
      (f) => f.type === "footway" || (f.class === "path" && f.type === "footway"),
    );
    const shouldNudge =
      sidewalk &&
      sidewalk.dist <= 28 &&
      sidewalk.dist > 2.5 &&
      (road?.dist ?? 99) <= 14 &&
      (footway?.dist ?? 99) < 3;
    if (shouldNudge) nudgeCandidates++;
    console.log(`s${i}`, {
      road: road ? `${road.class}/${road.type}@${road.dist.toFixed(1)}` : "—",
      footway: footway ? `@${footway.dist.toFixed(1)}` : "—",
      sidewalk: sidewalk
        ? `@${sidewalk.dist.toFixed(1)} → ${sidewalk.coords?.map((x) => +x.toFixed(5))}`
        : "—",
      nudge: shouldNudge,
    });
  }
  console.log("nudgeCandidates", nudgeCandidates, "/", samples.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
