/**
 * OD-12 Cupples → Ashfield: prove Recommended geometry moves with prefs.
 * npx tsx scripts/smoke-od12-prefs-demo.ts
 */
import { readFileSync, existsSync } from "fs";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
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

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
  const apiBase = "http://localhost:3000";

  // Same OD as your screenshot / bake-off OD-12
  const origin = { lng: 145.324244, lat: -38.056162 };
  const dest = { lng: 145.337065, lat: -38.050622 };

  const shadePrefs = {
    ...DEFAULT_PREFS_DAY,
    accessibility: 10,
    shadeHeat: 100,
    preferSharedPaths: false,
  };
  const footPrefs = {
    ...DEFAULT_PREFS_DAY,
    accessibility: 100,
    shadeHeat: 10,
    preferSharedPaths: false,
  };

  const [shadeCh, footCh] = await Promise.all([
    fetchChallengerRoute(origin, dest, "day", {
      apiBase,
      prefs: shadePrefs,
    }),
    fetchChallengerRoute(origin, dest, "day", {
      apiBase,
      prefs: footPrefs,
    }),
  ]);

  console.log("OD-12 Cupples Crescent → Ashfield Drive, Berwick\n");
  console.log("=== Score-aware challenger only ===");
  if (!shadeCh || !footCh) {
    throw new Error("Challenger missing — is serve_challenger.py on :8790?");
  }
  console.log(
    `Heat & Shade MAX: ${Math.round(shadeCh.distance_m)} m · ~${Math.round(shadeCh.duration_s / 60)} min · ${shadeCh.strategy}`,
  );
  console.log(
    `Footpaths MAX:    ${Math.round(footCh.distance_m)} m · ~${Math.round(footCh.duration_s / 60)} min · ${footCh.strategy}`,
  );
  const chDistinct = isGeometryDistinct(shadeCh.geometry, shadeCh.distance_m, [
    { geometry: footCh.geometry, distance_m: footCh.distance_m },
  ]);
  console.log(`Challenger geometries distinct: ${chDistinct}`);

  const fc = (await (
    await fetch(`${apiBase}/api/map-data/segment_scores.geojson`)
  ).json()) as GeoJSON.FeatureCollection;

  const planOpts = { challengerApiBase: apiBase };
  const [shadePlan, footPlan] = await Promise.all([
    planScoredRoutes(
      origin,
      dest,
      fc.features,
      token,
      3,
      "day",
      shadePrefs,
      planOpts,
    ),
    planScoredRoutes(
      origin,
      dest,
      fc.features,
      token,
      3,
      "day",
      footPrefs,
      planOpts,
    ),
  ]);
  const shadeRanked = sortRoutesByPreferences(shadePlan, shadePrefs, "day");
  const footRanked = sortRoutesByPreferences(footPlan, footPrefs, "day");

  console.log("\n=== Full resident plan (Mapbox + challenger + rank) ===");
  for (const [label, ranked] of [
    ["Heat & Shade MAX", shadeRanked],
    ["Footpaths MAX", footRanked],
  ] as const) {
    console.log(`\n${label} — ${ranked.length} card(s)`);
    for (const r of ranked) {
      console.log(
        `  ${r.id === ranked[0]?.id ? "★" : " "} ${r.strategy ?? r.id}  ${Math.round(r.distance_m)} m · ~${Math.round(r.duration_s / 60)} min  Footpaths ${r.score.accessibility_display ?? "—"} · Heat & Shade ${r.score.heat_shade_display ?? "—"}`,
      );
    }
  }

  const a = shadeRanked[0]!;
  const b = footRanked[0]!;
  const recDistinct = isGeometryDistinct(a.geometry, a.distance_m, [
    { geometry: b.geometry, distance_m: b.distance_m },
  ]);
  console.log("\n=== Verdict ===");
  console.log(
    `Recommended geometry moves with prefs: ${recDistinct ? "YES" : "NO"}`,
  );
  console.log(
    `Shade-max Recommended: ${a.strategy} ${Math.round(a.distance_m)} m (Heat & Shade pill ${a.score.heat_shade_display})`,
  );
  console.log(
    `Foot-max Recommended:  ${b.strategy} ${Math.round(b.distance_m)} m (Heat & Shade pill ${b.score.heat_shade_display})`,
  );

  if (!chDistinct && !recDistinct) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
