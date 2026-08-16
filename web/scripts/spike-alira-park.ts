/**
 * Investigation: why doesn't OD-12 route through Alira Park and along the
 * north-side Homestead Rd footpath?
 * Tests: (1) park paths present in Streets/OSM? (2) challenger can route on
 * them? (3) any mapped crossing over Homestead? (4) is the sidewalk Mapbox
 * uses present in the challenger graph? (5) how long is the park detour?
 * npx tsx scripts/spike-alira-park.ts
 */
import { readFileSync, existsSync } from "fs";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
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
]);

async function probe(lng: number, lat: number, token: string, radius = 40) {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", String(radius));
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
  return (body.features ?? []).map((f) => ({
    cls: (f.properties?.class ?? "").toLowerCase(),
    typ: (f.properties?.type ?? "").toLowerCase(),
    dist: f.properties?.tilequery?.distance ?? 999,
    coords: (f.geometry?.coordinates ?? null) as [number, number] | null,
  }));
}

const M = 111320;
const dM = (a: [number, number], b: [number, number]) =>
  Math.hypot(
    (b[0] - a[0]) * M * Math.cos((a[1] * Math.PI) / 180),
    (b[1] - a[1]) * M,
  );

function meanDistToLine(
  line: GeoJSON.LineString,
  ref: GeoJSON.LineString,
): number {
  const refCs = ref.coordinates as [number, number][];
  const ds = (line.coordinates as [number, number][]).map((p) =>
    Math.min(...refCs.map((r) => dM(p, r))),
  );
  return ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
}

const A = { lng: 145.324244, lat: -38.056162 }; // Cupples origin
const D = { lng: 145.337065, lat: -38.050622 }; // Ashfield destination

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const apiBase = "http://localhost:3001";

  // 1. Park paths present? Grid over Alira Park (west of Liara Blvd).
  console.log("=== 1. Alira Park path probe (Streets = OSM-derived) ===");
  const parkHits: Array<{ p: [number, number]; d: number }> = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const lng = 145.3175 + (i * (145.3238 - 145.3175)) / 5;
      const lat = -38.0565 + (j * 0.0035) / 5;
      const feats = await probe(lng, lat, token, 50);
      const path = feats.find((f) => PATHISH.has(f.cls) || PATHISH.has(f.typ));
      if (path?.coords) parkHits.push({ p: path.coords, d: path.dist });
    }
  }
  const uniq = new Map<string, [number, number]>();
  for (const h of parkHits)
    uniq.set(`${h.p[0].toFixed(5)},${h.p[1].toFixed(5)}`, h.p);
  console.log(
    `pathish features found near park grid: ${uniq.size} unique points`,
  );
  for (const p of [...uniq.values()].slice(0, 12))
    console.log(`  path @ ${p[0].toFixed(5)},${p[1].toFixed(5)}`);

  // 2/5. Challenger via-park legs (P = northernmost park path point).
  const parkPts = [...uniq.values()];
  if (parkPts.length > 0) {
    const P = parkPts.reduce((a, b) => (b[1] > a[1] ? b : a));
    console.log(
      `\n=== 2. Challenger legs via park point ${P[0].toFixed(5)},${P[1].toFixed(5)} ===`,
    );
    const [direct, leg1, leg2] = await Promise.all([
      fetchChallengerRoute(A, D, "day", { apiBase }),
      fetchChallengerRoute(A, { lng: P[0], lat: P[1] }, "day", { apiBase }),
      fetchChallengerRoute({ lng: P[0], lat: P[1] }, D, "day", { apiBase }),
    ]);
    console.log(`direct A→D: ${direct ? Math.round(direct.distance_m) + "m" : "—"}`);
    console.log(`A→park:     ${leg1 ? Math.round(leg1.distance_m) + "m" : "—"}`);
    console.log(`park→D:     ${leg2 ? Math.round(leg2.distance_m) + "m" : "—"}`);
    if (direct && leg1 && leg2) {
      const via = leg1.distance_m + leg2.distance_m;
      console.log(
        `via park total: ${Math.round(via)}m (+${Math.round(via - direct.distance_m)}m, ×${(via / direct.distance_m).toFixed(2)})`,
      );
    }
  } else {
    console.log("\nNo park paths found in Streets — park likely unmapped in OSM.");
  }

  // 3. Mapped crossings over Homestead along the challenger's east run?
  console.log("\n=== 3. Crossing features along challenger Homestead run ===");
  const direct = await fetchChallengerRoute(A, D, "day", { apiBase });
  if (direct) {
    const run = (direct.geometry.coordinates as [number, number][]).filter(
      (c) => c[0] > 145.3250 && c[0] < 145.3355,
    );
    let crossings = 0;
    const step = Math.max(1, Math.floor(run.length / 15));
    for (let i = 0; i < run.length; i += step) {
      const feats = await probe(run[i]![0], run[i]![1], token, 30);
      const c = feats.find((f) => f.cls === "crossing" || f.typ === "crossing");
      if (c) {
        crossings++;
        console.log(
          `  crossing @ ${c.coords?.[0].toFixed(5)},${c.coords?.[1].toFixed(5)} (${c.dist.toFixed(0)}m from line)`,
        );
      }
    }
    if (crossings === 0) console.log("  none found within 30m of the run");
  }

  // 4. Is the sidewalk Mapbox walks on in the challenger graph?
  console.log("\n=== 4. North-side sidewalk in challenger graph? ===");
  const mapbox = await fetchWalkingRouteCandidates(A, D, token, 1);
  const mb = mapbox[0]!.geometry;
  // Take two Mapbox vertices on the Homestead sidewalk stretch (west→mid).
  const mbPts = (mb.coordinates as [number, number][]).filter(
    (c) => c[0] > 145.3260 && c[0] < 145.3310,
  );
  if (mbPts.length >= 2) {
    const s1 = mbPts[0]!;
    const s2 = mbPts[mbPts.length - 1]!;
    console.log(
      `sidewalk test points: ${s1[0].toFixed(5)},${s1[1].toFixed(5)} → ${s2[0].toFixed(5)},${s2[1].toFixed(5)} (${Math.round(dM(s1, s2))}m apart)`,
    );
    const ch = await fetchChallengerRoute(
      { lng: s1[0], lat: s1[1] },
      { lng: s2[0], lat: s2[1] },
      "day",
      { apiBase },
    );
    if (ch) {
      const refLine: GeoJSON.LineString = {
        type: "LineString",
        coordinates: mbPts,
      };
      const mean = meanDistToLine(ch.geometry, refLine);
      console.log(
        `challenger between them: ${Math.round(ch.distance_m)}m, mean dist to Mapbox sidewalk line = ${mean.toFixed(1)}m`,
      );
      console.log(
        mean < 6
          ? "  → sidewalk IS in the challenger graph (or coincident)"
          : "  → challenger snaps elsewhere: sidewalk likely NOT in its graph",
      );
    } else {
      console.log("challenger returned no route between sidewalk points");
    }
  } else {
    console.log("Mapbox route has no vertices in that lng window");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
