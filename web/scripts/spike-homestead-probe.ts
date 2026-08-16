/**
 * Track 0b: dense probe along OD-12 Mapbox line — why Homestead stays centre.
 * npx tsx scripts/spike-homestead-probe.ts
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

/** Densify to ~every `stepM` metres. */
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

async function probe(lng: number, lat: number, token: string) {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", "35");
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
  return (body.features ?? [])
    .map((f) => {
      const c = (f.properties?.class ?? "").toLowerCase();
      const t = (f.properties?.type ?? "").toLowerCase();
      return {
        cls: c,
        typ: t,
        pathish: PATHISH.has(c) || PATHISH.has(t),
        sidewalk: c === "sidewalk" || t === "sidewalk",
        dist: f.properties?.tilequery?.distance ?? 999,
        coords: f.geometry?.coordinates ?? null,
      };
    })
    .sort((a, b) => a.dist - b.dist);
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
  const line = mapbox[0]!.geometry;
  const pts = densify(line, 40);
  console.log(`route ${Math.round(mapbox[0]!.distance)} m, ${pts.length} probes @~40m`);

  let cum = 0;
  let prev: [number, number] | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (prev) cum += haversineM(prev, p);
    prev = p;
    const feats = await probe(p[0], p[1], token);
    const road = feats.find((f) => !f.pathish);
    const sw = feats.find((f) => f.sidewalk);
    const fw = feats.find((f) => f.pathish && !f.sidewalk);
    console.log(
      `${String(Math.round(cum)).padStart(4)}m`,
      `road=${road ? `${road.cls}@${road.dist.toFixed(0)}` : "—"}`.padEnd(18),
      `sw=${sw ? sw.dist.toFixed(0) : "—"}`.padEnd(7),
      `fw=${fw ? `${fw.typ || fw.cls}@${fw.dist.toFixed(0)}` : "—"}`.padEnd(16),
      `@${p[1].toFixed(5)},${p[0].toFixed(5)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
