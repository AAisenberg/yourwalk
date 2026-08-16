/**
 * Why FP-high Find drops the second OD-12 card.
 * YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/diagnose-od12-pref-drop.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  challengerOsmPathishOk,
  isChallengerPathSafe,
  roadCarriagewayShare,
} from "../src/lib/routing/carriageway";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import { fetchWalkingRouteCandidates } from "../src/lib/routing/directions";
import {
  isGeometryDistinct,
  planScoredRoutes,
} from "../src/lib/routing/planRoute";
import {
  DEFAULT_PREFS_DAY,
  sortRoutesByPreferences,
  tripRankScore,
  type RoutePreferences,
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

function apiBase(): string {
  if (process.env.YOURWALK_APP_URL?.trim())
    return process.env.YOURWALK_APP_URL.trim();
  const portFile = resolve(__dirname, "../../.dev-pids/web.port");
  if (existsSync(portFile)) {
    const port = readFileSync(portFile, "utf8").trim();
    if (port) return `http://localhost:${port}`;
  }
  return "http://localhost:3001";
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("missing token");
  const base = apiBase();
  const origin = { lng: 145.324244, lat: -38.056162 };
  const dest = { lng: 145.337065, lat: -38.050622 };

  const cases: [string, RoutePreferences][] = [
    [
      "mid both",
      { ...DEFAULT_PREFS_DAY, accessibility: 55, shadeHeat: 55 },
    ],
    [
      "shade full, FP mid",
      { ...DEFAULT_PREFS_DAY, accessibility: 55, shadeHeat: 100 },
    ],
    [
      "FP full, shade mid",
      { ...DEFAULT_PREFS_DAY, accessibility: 100, shadeHeat: 55 },
    ],
    [
      "FP full, shade low",
      { ...DEFAULT_PREFS_DAY, accessibility: 100, shadeHeat: 10 },
    ],
  ];

  const fc = (await (
    await fetch(`${base.replace(/\/$/, "")}/api/map-data/segment_scores.geojson`)
  ).json()) as GeoJSON.FeatureCollection;
  const mapbox = await fetchWalkingRouteCandidates(origin, dest, token, 3);
  console.log("apiBase", base);
  console.log(
    "mapbox",
    mapbox.map((r) => `${r.strategy}:${Math.round(r.distance)}m`),
  );

  for (const [label, prefs] of cases) {
    const ch = await fetchChallengerRoute(origin, dest, "day", {
      apiBase: base,
      prefs,
    });
    if (!ch) {
      console.log("\n" + label, "challenger NULL");
      continue;
    }
    const osm = challengerOsmPathishOk(ch.osm_pathish_share);
    const streets = await roadCarriagewayShare(ch.geometry, token);
    const safe = await isChallengerPathSafe(ch, token);
    const distinct = isGeometryDistinct(
      ch.geometry,
      ch.distance_m,
      mapbox.map((r) => ({ geometry: r.geometry, distance_m: r.distance })),
    );
    const planned = await planScoredRoutes(
      origin,
      dest,
      fc.features,
      token,
      3,
      "day",
      prefs,
      { challengerApiBase: base },
    );
    const ranked = sortRoutesByPreferences(planned, prefs, "day");
    const shortest = Math.min(...ranked.map((r) => r.duration_s));
    console.log("\n" + label);
    console.log("  challenger", {
      m: Math.round(ch.distance_m),
      strategy: ch.strategy,
      pathish: ch.osm_pathish_share,
      osmOk: osm,
      streetsShare: streets,
      pathSafe: safe,
      distinct,
      wouldMerge: Boolean(safe && distinct),
    });
    console.log(
      "  cards",
      ranked.length,
      ranked.map((r) => {
        const m = tripRankScore(r, prefs, shortest, "day");
        return `${r.strategy}:${Math.round(r.distance_m)}m match=${
          m != null ? (m / 10).toFixed(1) : "?"
        } FP=${r.score.accessibility_display} HS=${r.score.heat_shade_display}`;
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
