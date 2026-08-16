/**
 * Track 0d: challenger paint — Homestead Rd centreline before/after nudge.
 * npx tsx scripts/spike-challenger-nudge.ts
 */
import { readFileSync, existsSync } from "fs";
import { nudgeGeometryTowardSidewalk } from "../src/lib/routing/carriageway";
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

async function roadDist(lng: number, lat: number, token: string) {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", "35");
  url.searchParams.set("limit", "10");
  url.searchParams.set("layers", "road");
  url.searchParams.set("access_token", token);
  const body = (await (await fetch(url.toString())).json()) as {
    features?: Array<{
      properties?: {
        class?: string;
        type?: string;
        tilequery?: { distance?: number };
      };
    }>;
  };
  const PATHISH = new Set([
    "path",
    "pedestrian",
    "footway",
    "sidewalk",
    "crossing",
    "steps",
    "cycleway",
    "track",
  ]);
  const roads = (body.features ?? []).filter((f) => {
    const c = (f.properties?.class ?? "").toLowerCase();
    const t = (f.properties?.type ?? "").toLowerCase();
    return !PATHISH.has(c) && !PATHISH.has(t);
  });
  return roads.length
    ? Math.min(...roads.map((f) => f.properties?.tilequery?.distance ?? 999))
    : null;
}

async function stats(
  line: GeoJSON.LineString,
  win: (c: number[]) => boolean,
  token: string,
) {
  const pts = line.coordinates.filter(win);
  const step = Math.max(1, Math.floor(pts.length / 12));
  const sampled = pts.filter((_, i) => i % step === 0);
  const ds: number[] = [];
  for (const c of sampled) {
    const d = await roadDist(c[0]!, c[1]!, token);
    if (d != null) ds.push(d);
  }
  const mean = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
  const near = ds.filter((d) => d < 4).length;
  return { n: ds.length, mean, near };
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const ch = await fetchChallengerRoute(
    { lng: 145.324244, lat: -38.056162 },
    { lng: 145.337065, lat: -38.050622 },
    "day",
    { apiBase: "http://localhost:3001" },
  );
  if (!ch) throw new Error("challenger unavailable");
  console.log(`challenger ${ch.strategy} ${Math.round(ch.distance_m)}m`);

  const nudged = await nudgeGeometryTowardSidewalk(ch.geometry, token);
  console.log({
    nudged_share: nudged.nudged_share.toFixed(2),
    centreline_look_share: nudged.centreline_look_share.toFixed(2),
  });

  // Homestead Rd east run (challenger vertices sit at lat ≈ -38.0539→-38.0550
  // between the Liara and Domain roundabouts).
  const homestead = (c: number[]) =>
    c[0]! >= 145.3250 && c[0]! <= 145.3352 && c[1]! < -38.0530;
  const before = await stats(ch.geometry, homestead, token);
  const after = await stats(nudged.geometry, homestead, token);
  console.log(
    `Homestead BEFORE: mean road dist ${before.mean.toFixed(1)} m, <4m ${before.near}/${before.n}`,
  );
  console.log(
    `Homestead AFTER : mean road dist ${after.mean.toFixed(1)} m, <4m ${after.near}/${after.n}`,
  );

  // Liara Blvd leg (northward run before the roundabout).
  const liara = (c: number[]) => c[0]! < 145.3250 && c[1]! < -38.0540;
  const lb = await stats(ch.geometry, liara, token);
  const la = await stats(nudged.geometry, liara, token);
  console.log(
    `Liara BEFORE: mean road dist ${lb.mean.toFixed(1)} m, <4m ${lb.near}/${lb.n}`,
  );
  console.log(
    `Liara AFTER : mean road dist ${la.mean.toFixed(1)} m, <4m ${la.near}/${la.n}`,
  );

  // North leg after the Domain roundabout (user: "onto the footpath after
  // Bellevue Drive") — confirm it is genuinely pathside and stays put.
  const north = (c: number[]) => c[0]! > 145.3355 && c[1]! > -38.0545;
  const nb = await stats(ch.geometry, north, token);
  const na = await stats(nudged.geometry, north, token);
  console.log(
    `North leg BEFORE: mean road dist ${nb.mean.toFixed(1)} m, <4m ${nb.near}/${nb.n}`,
  );
  console.log(
    `North leg AFTER : mean road dist ${na.mean.toFixed(1)} m, <4m ${na.near}/${na.n}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
