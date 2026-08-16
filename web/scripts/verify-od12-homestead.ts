/**
 * OD-12 acceptance: default challenger should take the north-side Homestead
 * footpath via the Liara roundabout crossings (not the road carriageway).
 *
 *   YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/verify-od12-homestead.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import { isGeometryDistinct, planScoredRoutes } from "../src/lib/routing/planRoute";
import {
  DEFAULT_PREFS_DAY,
  isScoreAwareStrategy,
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
  return "http://localhost:3000";
}

const ORIGIN = { lng: 145.324244, lat: -38.056162 };
const DEST = { lng: 145.337065, lat: -38.050622 };
/** Just east of the Liara / Homestead roundabout (north vs south side). */
const HOMESTEAD_EAST_LNG: [number, number] = [145.3242, 145.3268];
const ROUNDABOUT = { lng: 145.32385, lat: -38.05385 };
/** Bellevue Drive / Fieldhouse Lane — the other pathish OD-12 corridor. */
const BELLEVUE: [number, number, number, number] = [
  145.3284, 145.33, -38.0542, -38.0508,
];
const FIELDHOUSE: [number, number, number, number] = [
  145.3304, 145.3322, -38.0526, -38.0506,
];

function countInBox(
  line: GeoJSON.LineString,
  box: [number, number, number, number],
): number {
  const [lng0, lng1, lat0, lat1] = box;
  return line.coordinates.filter(
    (c) =>
      c[0]! >= lng0 && c[0]! <= lng1 && c[1]! >= lat0 && c[1]! <= lat1,
  ).length;
}

function haversineM(a: [number, number], b: [number, number]): number {
  const dLng = (a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
  const dLat = (a[1] - b[1]) * 111320;
  return Math.hypot(dLng, dLat);
}

function minDistM(line: GeoJSON.LineString, p: [number, number]): number {
  let best = Infinity;
  for (const c of line.coordinates) {
    best = Math.min(best, haversineM([c[0]!, c[1]!], p));
  }
  return best;
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
  const base = apiBase();
  console.log(`apiBase=${base}`);

  const [def, complement, away, awayShade] = await Promise.all([
    fetchChallengerRoute(ORIGIN, DEST, "day", {
      apiBase: base,
      prefs: {
        accessibility: DEFAULT_PREFS_DAY.accessibility,
        shadeHeat: DEFAULT_PREFS_DAY.shadeHeat,
      },
    }),
    fetchChallengerRoute(ORIGIN, DEST, "day", {
      apiBase: base,
      prefs: {
        accessibility: DEFAULT_PREFS_DAY.accessibility,
        shadeHeat: DEFAULT_PREFS_DAY.shadeHeat,
        complement: true,
      },
    }),
    fetchChallengerRoute(ORIGIN, DEST, "day", {
      apiBase: base,
      prefs: {
        accessibility: DEFAULT_PREFS_DAY.accessibility,
        shadeHeat: DEFAULT_PREFS_DAY.shadeHeat,
        preferSharedPaths: true,
      },
    }),
    fetchChallengerRoute(ORIGIN, DEST, "day", {
      apiBase: base,
      prefs: {
        accessibility: 55,
        shadeHeat: 100,
        preferSharedPaths: true,
      },
    }),
  ]);

  if (!def) {
    console.error("FAIL: default challenger unavailable");
    process.exit(1);
  }

  const hw = def.osm_highway_m ?? {};
  const pathishM =
    (hw.footway ?? 0) +
    (hw.path ?? 0) +
    (hw.cycleway ?? 0) +
    (hw.pedestrian ?? 0) +
    (hw.crossing ?? 0) +
    (hw.track ?? 0);
  const roadM =
    (hw.secondary ?? 0) +
    (hw.tertiary ?? 0) +
    (hw.residential ?? 0) +
    (hw.primary ?? 0) +
    (hw.unclassified ?? 0);

  const cs = def.geometry.coordinates as [number, number][];
  let closestIdx = 0;
  let closestD = Infinity;
  for (let i = 0; i < cs.length; i++) {
    const d = haversineM(cs[i]!, [ROUNDABOUT.lng, ROUNDABOUT.lat]);
    if (d < closestD) {
      closestD = d;
      closestIdx = i;
    }
  }
  // Vertices just after the roundabout, still on the Homestead eastbound start.
  const eastOfRoundabout = cs
    .slice(closestIdx, closestIdx + 8)
    .filter(
      (c) => c[0] >= HOMESTEAD_EAST_LNG[0] && c[0] <= HOMESTEAD_EAST_LNG[1] + 0.002,
    );
  const meanLat =
    eastOfRoundabout.reduce((s, c) => s + c[1], 0) /
    Math.max(1, eastOfRoundabout.length);
  // North of the roundabout node = north-side Homestead (road angles ESE).
  const northOfRoad = meanLat > ROUNDABOUT.lat;
  const roundaboutM = closestD;

  console.log("default", {
    m: Math.round(def.distance_m),
    strategy: def.strategy,
    pathish: def.osm_pathish_share,
    highway: hw,
    pathishM: Math.round(pathishM),
    roadM: Math.round(roadM),
    eastOfRoundabout: eastOfRoundabout.length,
    eastMeanLat: Number(meanLat.toFixed(6)),
    northOfRoad,
    roundaboutM: Math.round(roundaboutM),
  });
  if (complement) {
    console.log("complement", {
      m: Math.round(complement.distance_m),
      strategy: complement.strategy,
      stream: complement.complement_stream,
      pathish: complement.osm_pathish_share,
      detour: complement.detour_vs_graph_shortest ?? complement.capped_from_detour,
      hw: complement.osm_highway_m,
    });
  } else {
    console.log("complement: omitted (not distinct or over cap)");
  }
  if (away) {
    console.log("away", {
      m: Math.round(away.distance_m),
      strategy: away.strategy,
      pathish: away.osm_pathish_share,
      detour: away.detour_vs_graph_shortest ?? away.capped_from_detour,
    });
  } else {
    console.log("away: unavailable");
  }
  if (awayShade) {
    console.log("away+shade", {
      m: Math.round(awayShade.distance_m),
      strategy: awayShade.strategy,
      pathish: awayShade.osm_pathish_share,
      cappedToDefault: awayShade.away_capped_to_default,
      hw: awayShade.osm_highway_m,
    });
  } else {
    console.log("away+shade: unavailable");
  }

  const fails: string[] = [];
  if (pathishM <= roadM) {
    fails.push(
      `Homestead still road-led (pathish ${Math.round(pathishM)}m ≤ road ${Math.round(roadM)}m)`,
    );
  }
  if (!northOfRoad && eastOfRoundabout.length >= 2) {
    fails.push(
      `east-of-roundabout samples not north of crossing (mean lat ${meanLat.toFixed(6)} ≤ ${ROUNDABOUT.lat})`,
    );
  }
  if (roundaboutM > 80) {
    fails.push(`route misses Liara/Homestead roundabout (${Math.round(roundaboutM)}m)`);
  }
  if (complement) {
    if (!complement.strategy?.includes("_complement")) {
      fails.push(`complement not labelled (${complement.strategy})`);
    }
    if (
      !isGeometryDistinct(complement.geometry, complement.distance_m, [
        { geometry: def.geometry, distance_m: def.distance_m },
      ])
    ) {
      fails.push(
        `complement not geometrically distinct (${Math.round(complement.distance_m)}m vs default ${Math.round(def.distance_m)}m)`,
      );
    }
    if ((complement.osm_pathish_share ?? 0) < 0.7) {
      fails.push(
        `complement pathish share too low (${complement.osm_pathish_share})`,
      );
    }
    const bellevuePts = countInBox(complement.geometry, BELLEVUE);
    const fieldhousePts = countInBox(complement.geometry, FIELDHOUSE);
    console.log("complement corridors", { bellevuePts, fieldhousePts });
    if (bellevuePts < 2 || fieldhousePts < 2) {
      fails.push(
        `complement is not Bellevue/Fieldhouse (bellevue=${bellevuePts} fieldhouse=${fieldhousePts})`,
      );
    }
  } else {
    fails.push("complement omitted — expected a second Casey corridor on OD-12");
  }
  if (away && Math.abs(away.distance_m - def.distance_m) < 80) {
    fails.push(
      `away variant not distinct (${Math.round(away.distance_m)}m ≈ default ${Math.round(def.distance_m)}m)`,
    );
  }
  if (awayShade) {
    if (awayShade.strategy?.includes("_away")) {
      fails.push(
        `shade+away still labelled away (${awayShade.strategy} ${Math.round(awayShade.distance_m)}m)`,
      );
    }
    const shHw = awayShade.osm_highway_m ?? {};
    const alleyM =
      (shHw.service ?? 0) + (shHw.residential ?? 0) + (shHw.tertiary ?? 0);
    if (alleyM > 80) {
      fails.push(
        `shade+away fell back to alley/road classes (${Math.round(alleyM)}m)`,
      );
    }
  }

  const planned = await planScoredRoutes(
    ORIGIN,
    DEST,
    [],
    token,
    3,
    "day",
    DEFAULT_PREFS_DAY,
    { challengerApiBase: base },
  );
  const mapboxLeft = planned.filter((r) => !isScoreAwareStrategy(r.strategy));
  console.log(
    "plan cards",
    planned.map((r) => `${r.strategy ?? r.id}:${Math.round(r.distance_m)}m`),
  );
  const caseyCards = planned.filter((r) => isScoreAwareStrategy(r.strategy));
  if (caseyCards.length < 2) {
    fails.push(
      `expected two Casey cards, got ${caseyCards.length} (${planned.map((r) => r.strategy).join(", ")})`,
    );
  }
  if (mapboxLeft.length) {
    fails.push(
      `Mapbox still shown beside Casey (${mapboxLeft.map((r) => r.strategy).join(", ")})`,
    );
  }
  if (fails.length) {
    console.error("FAIL:\n  " + fails.join("\n  "));
    process.exit(1);
  }
  console.log(
    "PASS: north-side Homestead default + Bellevue/Fieldhouse complement",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
