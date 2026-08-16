/**
 * Track 0b verify: before/after road-centre distance along OD-12.
 * npx tsx scripts/verify-nudge-edges.ts
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { nudgeGeometryTowardSidewalk } from "../src/lib/routing/carriageway";
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

function haversineM(a: [number, number], b: [number, number]): number {
  const dLng = (a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
  const dLat = (a[1] - b[1]) * 111320;
  return Math.hypot(dLng, dLat);
}

function densify(line: GeoJSON.LineString, stepM: number): [number, number][] {
  const coords = line.coordinates as [number, number][];
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const d = haversineM(a, b);
    const n = Math.max(1, Math.round(d / stepM));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  out.push(coords[coords.length - 1]!);
  return out;
}

async function roadDist(
  lng: number,
  lat: number,
  token: string,
): Promise<number | null> {
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
  const road = (body.features ?? [])
    .map((f) => ({
      c: (f.properties?.class ?? "").toLowerCase(),
      t: (f.properties?.type ?? "").toLowerCase(),
      d: f.properties?.tilequery?.distance ?? 999,
    }))
    .filter((f) => !PATHISH.has(f.c) && !PATHISH.has(f.t))
    .sort((a, b) => a.d - b.d)[0];
  return road ? road.d : null;
}

async function stats(
  pts: [number, number][],
  token: string,
  label: string,
): Promise<number[]> {
  const ds: number[] = [];
  for (const [lng, lat] of pts) {
    const d = await roadDist(lng, lat, token);
    if (d != null) ds.push(d);
  }
  const mean = ds.reduce((s, d) => s + d, 0) / Math.max(1, ds.length);
  const onRoad = ds.filter((d) => d < 4).length;
  console.log(
    `${label}: mean road dist ${mean.toFixed(1)} m, <4m ${onRoad}/${ds.length}`,
  );
  return ds;
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
  const before = mapbox[0]!.geometry;
  const res = await nudgeGeometryTowardSidewalk(before, token);
  console.log("nudge", {
    nudged_share: res.nudged_share.toFixed(2),
    centreline_look_share: res.centreline_look_share.toFixed(2),
  });

  const bPts = densify(before, 60);
  const aPts = densify(res.geometry, 60);

  // Liara ≈ first 550 m → first ~9 probes @60m; Homestead ≈ last 600 m.
  await stats(bPts.slice(0, 9), token, "Liara BEFORE");
  await stats(aPts.slice(0, 9), token, "Liara AFTER ");
  await stats(bPts.slice(-10), token, "Homestead BEFORE");
  await stats(aPts.slice(-10), token, "Homestead AFTER ");

  // Max lateral departure: distance from each after-point to the before line
  // (5 m densification so along-track phase does not inflate the number).
  const bFine = densify(before, 5);
  const aFine = densify(res.geometry, 5);
  let maxShift = 0;
  for (const p of aFine) {
    let best = Infinity;
    for (const q of bFine) {
      best = Math.min(best, haversineM(p, q));
    }
    maxShift = Math.max(maxShift, best);
  }
  console.log(`max departure from original line ~${maxShift.toFixed(1)} m`);

  const out = resolve(
    __dirname,
    "../../pipeline/data/qa/nudge_before_after.geojson",
  );
  writeFileSync(
    out,
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { which: "before" },
          geometry: before,
        },
        {
          type: "Feature",
          properties: { which: "after" },
          geometry: res.geometry,
        },
      ],
    }),
  );
  console.log(`wrote ${out} (drop into geojson.io to compare)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
