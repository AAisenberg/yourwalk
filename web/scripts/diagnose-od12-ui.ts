/**
 * Why localhost UI may show 1 card for Cupples → Ashfield.
 *
 *   YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/diagnose-od12-ui.ts
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

function defaultApiBase(): string {
  if (process.env.YOURWALK_APP_URL?.trim())
    return process.env.YOURWALK_APP_URL.trim();
  const portFile = resolve(__dirname, "../../.dev-pids/web.port");
  if (existsSync(portFile)) {
    const port = readFileSync(portFile, "utf8").trim();
    if (port) return `http://localhost:${port}`;
  }
  return "http://localhost:3000";
}

async function geocode(q: string, token: string) {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "AU");
  url.searchParams.set("bbox", "145.2,-38.2,145.5,-37.9");
  url.searchParams.set("limit", "3");
  const res = await fetch(url.toString());
  const body = (await res.json()) as {
    features?: Array<{ place_name: string; center: [number, number] }>;
  };
  return (body.features ?? []).map((f) => ({
    label: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}

async function diagnose(
  origin: { lng: number; lat: number },
  dest: { lng: number; lat: number },
  label: string,
  token: string,
  apiBase: string,
) {
  console.log("\n##", label);
  console.log("origin", origin, "dest", dest);
  const prefs = { ...DEFAULT_PREFS_DAY, accessibility: 10, shadeHeat: 100 };
  const mapbox = await fetchWalkingRouteCandidates(origin, dest, token, 3);
  const ch = await fetchChallengerRoute(origin, dest, "day", {
    apiBase,
    prefs,
  });
  console.log(
    "mapbox",
    mapbox.length,
    mapbox.map((r) => `${r.strategy}:${Math.round(r.distance)}m`),
  );
  if (!ch) {
    console.log("challenger: NULL (proxy down or no path)");
    return;
  }
  const osm = challengerOsmPathishOk(ch.osm_pathish_share);
  const streets = await roadCarriagewayShare(ch.geometry, token);
  const safe = await isChallengerPathSafe(ch, token);
  const distinct = isGeometryDistinct(
    ch.geometry,
    ch.distance_m,
    mapbox.map((r) => ({ geometry: r.geometry, distance_m: r.distance })),
  );
  console.log("challenger", {
    m: Math.round(ch.distance_m),
    strategy: ch.strategy,
    pathish: ch.osm_pathish_share,
    osmOk: osm,
    streetsShare: streets,
    pathSafe: safe,
    distinctFromMapbox: distinct,
    wouldMerge: Boolean(safe && distinct),
  });

  const fc = (await (
    await fetch(`${apiBase.replace(/\/$/, "")}/api/map-data/segment_scores.geojson`)
  ).json()) as GeoJSON.FeatureCollection;
  const planned = await planScoredRoutes(
    origin,
    dest,
    fc.features,
    token,
    3,
    "day",
    prefs,
    { challengerApiBase: apiBase },
  );
  const ranked = sortRoutesByPreferences(planned, prefs, "day");
  console.log(
    "final cards",
    ranked.length,
    ranked.map((r) => `${r.strategy}:${Math.round(r.distance_m)}m`),
  );
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("missing token");
  const apiBase = defaultApiBase();
  console.log("apiBase", apiBase);

  const fixtureO = { lng: 145.324244, lat: -38.056162 };
  const fixtureD = { lng: 145.337065, lat: -38.050622 };

  const queries: [string, string, string][] = [
    [
      "unnumbered street",
      "Cupples Crescent, Berwick Victoria",
      "Ashfield Drive, Berwick Victoria 3806",
    ],
    [
      "numbered bake-off",
      "66 Cupples Crescent, Berwick VIC 3806",
      "2 Ashfield Drive, Berwick VIC 3806",
    ],
  ];

  for (const [label, fq, tq] of queries) {
    const fromHits = await geocode(fq, token);
    const toHits = await geocode(tq, token);
    console.log(`\nGeocode (${label}) From:`, fromHits[0]);
    console.log(`Geocode (${label}) To:`, toHits[0]);
    if (fromHits[0] && toHits[0]) {
      await diagnose(
        { lng: fromHits[0].lng, lat: fromHits[0].lat },
        { lng: toHits[0].lng, lat: toHits[0].lat },
        `UI-like geocode: ${label}`,
        token,
        apiBase,
      );
    }
  }

  await diagnose(
    fixtureO,
    fixtureD,
    "bake-off fixture coords",
    token,
    apiBase,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
