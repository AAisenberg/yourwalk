/**
 * P4: turning-point order must follow the slider blend.
 * Synthetic (always). Optional live Montpelier if map-data is up.
 *
 *   npx tsx scripts/verify-p4-outing-bias.ts
 *   YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/verify-p4-outing-bias.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import {
  caseySegmentsNearStart,
  contrastOutingPrefs,
  orderPairsForDraw,
  scoreLoopPair,
  snapToCaseyFootpath,
  type LoopTurnPair,
  type NearbyCaseySegment,
} from "../src/lib/routing/outingStreamBias";
import type { LngLat } from "../src/lib/routing/types";

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
  return "http://localhost:3000";
}

const START: LngLat = { lng: 145.35, lat: -38.04 };
const EAST: LngLat = { lng: 145.3554, lat: -38.04 };
const WEST: LngLat = { lng: 145.3446, lat: -38.04 };
const NORTH: LngLat = { lng: 145.35, lat: -38.0356 };
const SOUTH: LngLat = { lng: 145.35, lat: -38.0444 };
const NE: LngLat = { lng: 145.3538, lat: -38.0368 };
const NW: LngLat = { lng: 145.3462, lat: -38.0368 };

const nearby: NearbyCaseySegment[] = [
  {
    mid: EAST,
    lengthM: 40,
    accessibility: 38,
    heatShade: 94,
    lighting: null,
    nightIndex: 55,
  },
  {
    mid: WEST,
    lengthM: 40,
    accessibility: 93,
    heatShade: 24,
    lighting: null,
    nightIndex: 55,
  },
  {
    mid: NORTH,
    lengthM: 30,
    accessibility: 60,
    heatShade: 60,
    lighting: null,
    nightIndex: 55,
  },
  {
    mid: SOUTH,
    lengthM: 30,
    accessibility: 60,
    heatShade: 60,
    lighting: null,
    nightIndex: 55,
  },
  {
    mid: NE,
    lengthM: 25,
    accessibility: 42,
    heatShade: 88,
    lighting: null,
    nightIndex: 55,
  },
  {
    mid: NW,
    lengthM: 25,
    accessibility: 86,
    heatShade: 32,
    lighting: null,
    nightIndex: 55,
  },
];

const pairs: LoopTurnPair[] = [
  { a: EAST, b: NORTH, strategy: "east", bearingDeg: 90 },
  { a: WEST, b: SOUTH, strategy: "west", bearingDeg: 270 },
  { a: NE, b: SOUTH, strategy: "ne", bearingDeg: 45 },
  { a: NW, b: SOUTH, strategy: "nw", bearingDeg: 315 },
];

function firstStrategy(
  prefs: ReturnType<typeof contrastOutingPrefs>["footpaths"],
): string {
  const scored = pairs.map((p) => scoreLoopPair(p, nearby, prefs, "day"));
  const ordered = orderPairsForDraw(scored);
  return ordered[0]?.strategy ?? "";
}

async function liveMontpelier(): Promise<string | null> {
  const base = apiBase();
  try {
    const res = await fetch(`${base}/api/map-data/segment_scores.geojson`);
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    const start = { lng: 145.3485, lat: -38.0405 };
    const segs = caseySegmentsNearStart(start, fc.features, 900);
    if (segs.length < 20) return `live skip (only ${segs.length} nearby segments)`;
    const { shadeOrLight, footpaths } = contrastOutingPrefs("day");
    const compass: LoopTurnPair[] = [30, 90, 150, 210, 270, 330].map((br) => ({
      a: {
        lng: start.lng + 0.004 * Math.sin((br * Math.PI) / 180),
        lat: start.lat + 0.004 * Math.cos((br * Math.PI) / 180),
      },
      b: {
        lng: start.lng + 0.004 * Math.sin(((br + 120) * Math.PI) / 180),
        lat: start.lat + 0.004 * Math.cos(((br + 120) * Math.PI) / 180),
      },
      strategy: `tri_${br}`,
      bearingDeg: br,
    }));
    const shadeFirst = orderPairsForDraw(
      compass.map((p) => scoreLoopPair(p, segs, shadeOrLight, "day")),
    )[0];
    const footFirst = orderPairsForDraw(
      compass.map((p) => scoreLoopPair(p, segs, footpaths, "day")),
    )[0];
    if (!shadeFirst || !footFirst) return "live skip (no scored pairs)";
    const differ = shadeFirst.strategy !== footFirst.strategy;
    return `live Montpelier shade-first=${shadeFirst.strategy} footpaths-first=${footFirst.strategy} ${differ ? "DIFFERS" : "SAME (honest if one corridor)"}`;
  } catch {
    return null;
  }
}

async function main() {
  loadEnv();
  const { shadeOrLight, footpaths } = contrastOutingPrefs("day");
  const shadeFirst = firstStrategy(shadeOrLight);
  const footFirst = firstStrategy(footpaths);

  const snapped = snapToCaseyFootpath(
    { lng: EAST.lng + 0.0004, lat: EAST.lat },
    nearby,
  );
  const snapOk =
    Math.abs(snapped.lng - EAST.lng) < 1e-6 &&
    Math.abs(snapped.lat - EAST.lat) < 1e-6;

  const polyFc: GeoJSON.Feature[] = [
    {
      type: "Feature",
      properties: {
        accessibility_score: 40,
        heat_shade_score: 90,
        length_m: 30,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [EAST.lng - 0.0002, EAST.lat - 0.0001],
          [EAST.lng + 0.0002, EAST.lat - 0.0001],
          [EAST.lng + 0.0002, EAST.lat + 0.0001],
          [EAST.lng - 0.0002, EAST.lat + 0.0001],
          [EAST.lng - 0.0002, EAST.lat - 0.0001],
        ]],
      },
    },
  ];
  const fromPoly = caseySegmentsNearStart(START, polyFc, 900);
  const polyOk = fromPoly.length === 1;

  const ok =
    shadeFirst === "east" && footFirst === "west" && snapOk && polyOk;
  console.log(
    `synthetic shade-first=${shadeFirst} footpaths-first=${footFirst} snap=${snapOk ? "OK" : "FAIL"} poly=${polyOk ? "OK" : "FAIL"}`,
  );
  const live = await liveMontpelier();
  if (live) console.log(live);
  if (!ok) {
    console.error("P4 VERIFY FAIL: shade should prefer east, footpaths west");
    process.exit(1);
  }
  console.log("P4 VERIFY PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
