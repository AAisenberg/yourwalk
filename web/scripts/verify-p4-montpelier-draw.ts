/**
 * Live P4 draw: Montpelier 30 min Loop, shade-max vs footpaths-max.
 *
 *   YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/verify-p4-montpelier-draw.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { contrastOutingPrefs } from "../src/lib/routing/outingStreamBias";
import { planOutingRoutes } from "../src/lib/routing/planOuting";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
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

function pathKey(line: GeoJSON.LineString): string {
  const step = Math.max(1, Math.floor(line.coordinates.length / 12));
  return line.coordinates
    .filter((_, i) => i % step === 0)
    .map((c) => `${c[0]!.toFixed(4)},${c[1]!.toFixed(4)}`)
    .join("|");
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
  const base = apiBase();
  const fc = (await (
    await fetch(`${base}/api/map-data/segment_scores.geojson`)
  ).json()) as GeoJSON.FeatureCollection;
  if (!fc.features?.length) throw new Error("No segment features");

  const start = { lng: 145.3485, lat: -38.0405 };
  const { shadeOrLight, footpaths } = contrastOutingPrefs("day");
  const opts = { shape: "loop" as const, challengerApiBase: base };

  const shade = await planOutingRoutes(
    start,
    30,
    fc.features,
    token,
    "day",
    shadeOrLight,
    opts,
    2,
  );
  const feet = await planOutingRoutes(
    start,
    30,
    fc.features,
    token,
    "day",
    footpaths,
    opts,
    2,
  );

  const a = shade[0];
  const b = feet[0];
  if (!a || !b) {
    console.log(
      `Montpelier draw: shade n=${shade.length} footpaths n=${feet.length}`,
    );
    if (!shade.length && !feet.length) {
      console.log("P4 DRAW EMPTY (honest miss is allowed)");
      process.exit(0);
    }
    throw new Error("One pref set returned no loop");
  }

  const differ = pathKey(a.geometry) !== pathKey(b.geometry);
  console.log(
    `shade ${Math.round(a.duration_s / 60)}min ${a.strategy} heat=${a.score.heat_shade_display} acc=${a.score.accessibility_display}`,
  );
  console.log(
    `footpaths ${Math.round(b.duration_s / 60)}min ${b.strategy} heat=${b.score.heat_shade_display} acc=${b.score.accessibility_display}`,
  );
  console.log(differ ? "P4 DRAW DIFFERS" : "P4 DRAW SAME (one-circuit honesty)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
