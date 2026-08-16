/**
 * Track 0 verification: OD-12 nudge + Recommended preference.
 * YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/smoke-carriageway-truth.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { nudgeGeometryTowardSidewalk } from "../src/lib/routing/carriageway";
import { fetchWalkingRouteCandidates } from "../src/lib/routing/directions";
import {
  planScoredRoutes,
} from "../src/lib/routing/planRoute";
import {
  DEFAULT_PREFS_DAY,
  sortRoutesByPreferences,
  tripRankScore,
} from "../src/lib/routing/preferences";

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

function apiBase() {
  if (process.env.YOURWALK_APP_URL?.trim())
    return process.env.YOURWALK_APP_URL.trim();
  const portFile = resolve(__dirname, "../../.dev-pids/web.port");
  if (existsSync(portFile)) {
    const port = readFileSync(portFile, "utf8").trim();
    if (port) return `http://localhost:${port}`;
  }
  return "http://localhost:3001";
}

function ptDistM(a: [number, number], b: [number, number]): number {
  const dLng = (a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
  const dLat = (a[1] - b[1]) * 111320;
  return Math.hypot(dLng, dLat);
}

/** Mean lateral shift: nearest-point distance from each after-vertex to the before line. */
function meanShiftM(
  before: GeoJSON.LineString,
  after: GeoJSON.LineString,
): number {
  const b = before.coordinates as [number, number][];
  const a = after.coordinates as [number, number][];
  if (a.length < 2 || b.length < 2) return 0;
  let sum = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) best = Math.min(best, ptDistM(p, q));
    sum += best;
  }
  return sum / a.length;
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("missing token");
  const base = apiBase();
  const prefs = { ...DEFAULT_PREFS_DAY, accessibility: 55, shadeHeat: 55 };

  const od12 = {
    id: "OD-12",
    origin: { lng: 145.324244, lat: -38.056162 },
    dest: { lng: 145.337065, lat: -38.050622 },
  };
  const carriage = {
    id: "OD-CARRIAGE-01",
    origin: { lng: 145.332444, lat: -38.088427 },
    dest: { lng: 145.338191, lat: -38.11054 },
  };

  const fc = (await (
    await fetch(`${base}/api/map-data/segment_scores.geojson`)
  ).json()) as GeoJSON.FeatureCollection;

  console.log("apiBase", base);

  const raw = await fetchWalkingRouteCandidates(
    od12.origin,
    od12.dest,
    token,
    1,
  );
  const before = raw[0]!.geometry;
  const nudged = await nudgeGeometryTowardSidewalk(before, token);
  console.log("\nOD-12 Mapbox nudge", {
    nudged_share: nudged.nudged_share,
    centreline_look_share: nudged.centreline_look_share,
    meanShiftM: meanShiftM(before, nudged.geometry).toFixed(1),
  });

  for (const od of [od12, carriage]) {
    const planned = await planScoredRoutes(
      od.origin,
      od.dest,
      fc.features,
      token,
      3,
      "day",
      prefs,
      { challengerApiBase: base },
    );
    const ranked = sortRoutesByPreferences(planned, prefs, "day");
    const shortest = Math.min(...ranked.map((r) => r.duration_s));
    console.log(`\n${od.id} cards=${ranked.length}`);
    for (const r of ranked) {
      const m = tripRankScore(r, prefs, shortest, "day");
      console.log({
        strategy: r.strategy,
        m: Math.round(r.distance_m),
        match: m != null ? (m / 10).toFixed(1) : null,
        paint_nudged: r.paint_nudged ?? false,
        centreline_look: r.centreline_look_share ?? 0,
        recommended: r.id === ranked[0]?.id,
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
