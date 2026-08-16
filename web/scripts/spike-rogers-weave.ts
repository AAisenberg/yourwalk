/**
 * Track 0c: is the Rogers Close weave raw Mapbox or nudge paint?
 * npx tsx scripts/spike-rogers-weave.ts
 */
import { readFileSync, existsSync } from "fs";
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
        crossing: c === "crossing" || t === "crossing",
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
  const before = mapbox[0]!.geometry;
  const after = (await nudgeGeometryTowardSidewalk(before, token)).geometry;

  // Rogers Close / mid-Homestead window.
  const inWin = (c: number[]) => c[0]! >= 145.3308 && c[0]! <= 145.3345;

  console.log("=== RAW Mapbox vertices in Rogers window (west→east) ===");
  for (const c of before.coordinates.filter(inWin)) {
    const feats = await probe(c[0]!, c[1]!, token);
    const top = feats[0];
    const cross = feats.find((f) => f.crossing);
    console.log(
      `lat=${c[1]!.toFixed(6)} lng=${c[0]!.toFixed(6)}  top=${top ? `${top.cls}/${top.typ}@${top.dist.toFixed(0)}` : "—"}${cross ? `  crossing@${cross.dist.toFixed(0)}` : ""}`,
    );
  }

  console.log("\n=== NUDGED vertices in same window ===");
  for (const c of after.coordinates.filter(inWin)) {
    console.log(`lat=${c[1]!.toFixed(6)} lng=${c[0]!.toFixed(6)}`);
  }

  // Homestead centreline lat at a given lng is ~linear here; use raw road
  // probes to see which side each line sits on.
  console.log("\n=== Side of Homestead (raw vs nudged), sampled by lng ===");
  const lngs = [145.3310, 145.3316, 145.3322, 145.3328, 145.3334, 145.3340];
  const latAt = (line: GeoJSON.LineString, lng: number): number | null => {
    const cs = line.coordinates;
    for (let i = 0; i < cs.length - 1; i++) {
      const a = cs[i]!;
      const b = cs[i + 1]!;
      if ((a[0]! - lng) * (b[0]! - lng) <= 0 && a[0]! !== b[0]!) {
        const f = (lng - a[0]!) / (b[0]! - a[0]!);
        return a[1]! + (b[1]! - a[1]!) * f;
      }
    }
    return null;
  };
  for (const lng of lngs) {
    const bl = latAt(before, lng);
    const al = latAt(after, lng);
    console.log(
      `lng=${lng.toFixed(4)}  raw lat=${bl?.toFixed(6) ?? "—"}  nudged lat=${al?.toFixed(6) ?? "—"}  Δ=${bl != null && al != null ? ((al - bl) * 111320).toFixed(1) + "m N" : "—"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
