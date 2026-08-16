import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fetchWalkingRouteCandidates } from "../src/lib/routing/directions";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import {
  isMostlyOffCarriageway,
  roadCarriagewayShare,
  isChallengerPathSafe,
  challengerOsmPathishOk,
} from "../src/lib/routing/carriageway";
import {
  isGeometryDistinct,
  planScoredRoutes,
} from "../src/lib/routing/planRoute";
import type { RoutePreferences } from "../src/lib/routing/preferences";

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

const DEFAULT: RoutePreferences = {
  afterDark: 0,
  accessibility: 60,
  shadeHeat: 85,
  preferSharedPaths: false,
};

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("no token");
  const base = apiBase();
  const origin = { lng: 145.324244, lat: -38.056162 };
  const dest = { lng: 145.337065, lat: -38.050622 };

  const mapbox = await fetchWalkingRouteCandidates(origin, dest, token, 3);
  console.log("=== Mapbox (after directions.ts filters) ===");
  for (const r of mapbox) {
    const share = await roadCarriagewayShare(r.geometry, token);
    const off = await isMostlyOffCarriageway(r.geometry, token);
    console.log({
      strategy: r.strategy,
      m: Math.round(r.distance),
      carriagewayShare: share,
      mostlyOffRoad: off,
    });
  }

  console.log("\n=== Challenger ===");
  for (const [label, prefs] of [
    ["shade-biased", { ...DEFAULT, accessibility: 55, shadeHeat: 100 }],
    ["fp-biased", { ...DEFAULT, accessibility: 100, shadeHeat: 55 }],
  ] as const) {
    const ch = await fetchChallengerRoute(origin, dest, "day", {
      apiBase: base,
      prefs,
    });
    if (!ch) {
      console.log(label, "null");
      continue;
    }
    const streets = await roadCarriagewayShare(ch.geometry, token);
    console.log(label, {
      m: Math.round(ch.distance_m),
      pathish: ch.osm_pathish_share,
      osmOk: challengerOsmPathishOk(ch.osm_pathish_share),
      streetsShare: streets,
      pathSafe: await isChallengerPathSafe(ch, token),
      distinct: isGeometryDistinct(
        ch.geometry,
        ch.distance_m,
        mapbox.map((r) => ({ geometry: r.geometry, distance_m: r.distance })),
      ),
    });
  }

  const fc = (await (
    await fetch(`${base}/api/map-data/segment_scores.geojson`)
  ).json()) as GeoJSON.FeatureCollection;
  const planned = await planScoredRoutes(
    origin,
    dest,
    fc.features,
    token,
    3,
    "day",
    { ...DEFAULT, accessibility: 55, shadeHeat: 100 },
    { challengerApiBase: base },
  );
  console.log("\n=== UI cards (shade Find) ===");
  for (const r of planned) {
    console.log({
      strategy: r.strategy,
      m: Math.round(r.distance_m),
      carriagewayShare: await roadCarriagewayShare(r.geometry, token),
      FP: r.score.accessibility_display,
      HS: r.score.heat_shade_display,
      matched_m: Math.round(r.score.matched_length_m),
      coverage: r.score.coverage_ratio,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
