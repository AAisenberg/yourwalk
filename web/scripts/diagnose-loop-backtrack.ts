/**
 * Diagnostic (not a gate): where does Montpelier loop backtracking come from?
 *
 * 1. Reproduce the resident loops (shade-max / footpaths-max / default).
 * 2. Re-derive the Casey turning-point pairs and probe the three challenger
 *    legs per pair: do they connect, what duration, how much do legs overlap?
 * 3. Dump card + leg geometries to /tmp/yourwalk-loop-diag for plotting.
 *
 *   npx tsx scripts/diagnose-loop-backtrack.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import {
  caseyRingPairs,
  caseySegmentsNearStart,
  contrastOutingPrefs,
  orderPairsForDraw,
  snapAndScorePairs,
} from "../src/lib/routing/outingStreamBias";
import { planOutingRoutes } from "../src/lib/routing/planOuting";
import {
  DEFAULT_PREFS_DAY,
  type RoutePreferences,
} from "../src/lib/routing/preferences";
import type { LngLat } from "../src/lib/routing/types";

const OUT_DIR = "/tmp/yourwalk-loop-diag";
const START: LngLat = { lng: 145.3485, lat: -38.0405 };
const MINUTES = 30;
/** Same sizing maths as planOutingRoutes for a 30 min loop. */
const VIA_M = Math.max(160, (MINUTES / 3) * 75 * 0.62);

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

function haversineM(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---- product revisit metric, replicated for diagnosis (planOuting.ts) ----
const STEP_M = 28;
const NEAR_M = 15;
const SEP_M = 95;
const STUB_M = 80;

type Sample = { p: LngLat; along: number };

function densify(geometry: GeoJSON.LineString): Sample[] {
  const coords = geometry.coordinates;
  if (coords.length < 2) return [];
  const samples: Sample[] = [
    { p: { lng: coords[0]![0]!, lat: coords[0]![1]! }, along: 0 },
  ];
  let along = 0;
  let since = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = { lng: coords[i - 1]![0]!, lat: coords[i - 1]![1]! };
    const b = { lng: coords[i]![0]!, lat: coords[i]![1]! };
    const seg = haversineM(a, b);
    if (seg < 0.5) continue;
    let remaining = seg;
    let t0 = 0;
    while (since + remaining >= STEP_M) {
      const need = STEP_M - since;
      const t = t0 + need / seg;
      samples.push({
        p: {
          lng: a.lng + (b.lng - a.lng) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        },
        along: along + need,
      });
      along += need;
      remaining -= need;
      t0 += need / seg;
      since = 0;
    }
    along += remaining;
    since += remaining;
  }
  const last = coords[coords.length - 1]!;
  samples.push({ p: { lng: last[0]!, lat: last[1]! }, along });
  return samples;
}

/**
 * Product-equivalent revisit ratio plus a "perceived" variant: how much of
 * the walk re-passes within `nearM` of an earlier stretch. 15 m = counted
 * same-path; 45 m = looks like backtracking to a human (opposite kerb etc).
 */
function revisitRatio(
  geometry: GeoJSON.LineString,
  start: LngLat,
  nearM: number,
): { ratio: number; hits: LngLat[] } {
  const samples = densify(geometry);
  if (samples.length < 8) return { ratio: 1, hits: [] };
  const totalM = samples[samples.length - 1]!.along;
  if (totalM < 120) return { ratio: 1, hits: [] };
  let revisit = 0;
  let scored = 0;
  const hits: LngLat[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const nearStart = haversineM(s.p, start) <= STUB_M;
    if (s.along < totalM * 0.18) continue;
    scored++;
    for (let j = 0; j < i; j++) {
      const e = samples[j]!;
      if (s.along - e.along < SEP_M) continue;
      if (nearStart && haversineM(e.p, start) <= STUB_M) continue;
      if (haversineM(s.p, e.p) <= nearM) {
        revisit++;
        hits.push(s.p);
        break;
      }
    }
  }
  return { ratio: scored ? revisit / scored : 1, hits };
}

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

function lineFeature(
  geometry: GeoJSON.LineString,
  props: Record<string, unknown>,
): GeoJSON.Feature {
  return { type: "Feature", properties: props, geometry };
}

function pointFeatures(
  points: LngLat[],
  props: Record<string, unknown>,
): GeoJSON.Feature[] {
  return points.map((p) => ({
    type: "Feature" as const,
    properties: props,
    geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
  }));
}

async function reproduceCards(
  label: string,
  prefs: RoutePreferences,
  features: GeoJSON.Feature[],
  token: string,
  base: string,
  dump: GeoJSON.Feature[],
) {
  const routes = await planOutingRoutes(
    START,
    MINUTES,
    features,
    token,
    "day",
    prefs,
    { shape: "loop", challengerApiBase: base },
    3,
  );
  console.log(`\n== ${label}: ${routes.length} card(s)`);
  for (const r of routes) {
    const engine = r.strategy?.startsWith("score_aware_loop")
      ? "casey-legs"
      : "mapbox-draw";
    const counted = revisitRatio(r.geometry, START, NEAR_M);
    const perceived = revisitRatio(r.geometry, START, 45);
    console.log(
      `  ${engine}  ${Math.round(r.duration_s / 60)}min ${Math.round(r.distance_m)}m  rev15=${counted.ratio.toFixed(2)} rev45=${perceived.ratio.toFixed(2)}  ${r.strategy}`,
    );
    dump.push(
      lineFeature(r.geometry, {
        kind: "card",
        label,
        engine,
        strategy: r.strategy,
        duration_min: Math.round(r.duration_s / 60),
        rev15: Number(counted.ratio.toFixed(3)),
        rev45: Number(perceived.ratio.toFixed(3)),
      }),
      ...pointFeatures(counted.hits, { kind: "rev15", label }),
      ...pointFeatures(
        perceived.hits.filter(
          (p) => !counted.hits.some((q) => haversineM(p, q) < 1),
        ),
        { kind: "rev45only", label },
      ),
    );
  }
}

function legOverlapM(
  a: GeoJSON.LineString,
  b: GeoJSON.LineString,
): number {
  const sa = densify(a);
  const sb = densify(b);
  let overlap = 0;
  for (const s of sa) {
    for (const e of sb) {
      if (haversineM(s.p, e.p) <= NEAR_M) {
        overlap += STEP_M;
        break;
      }
    }
  }
  return overlap;
}

async function probePairs(
  label: string,
  prefs: RoutePreferences,
  features: GeoJSON.Feature[],
  base: string,
  dump: GeoJSON.Feature[],
) {
  const nearby = caseySegmentsNearStart(
    START,
    features,
    VIA_M * 1.28 * 1.25 + 160,
  );
  const pairs = orderPairsForDraw(
    snapAndScorePairs(
      START,
      caseyRingPairs(START, VIA_M, nearby, prefs, "day"),
      nearby,
      prefs,
      "day",
      VIA_M * 0.32,
    ),
  );
  console.log(`\n== ${label}: probing ${Math.min(6, pairs.length)} Casey pairs`);
  const band: [number, number] = [(MINUTES - 5) * 60, (MINUTES + 5) * 60];
  for (const pair of pairs.slice(0, 6)) {
    const opts = {
      apiBase: base,
      prefs: {
        accessibility: prefs.accessibility,
        shadeHeat: prefs.shadeHeat,
        afterDark: prefs.afterDark,
      },
    };
    const [l1, l2, l3] = await Promise.all([
      fetchChallengerRoute(START, pair.a, "day", opts),
      fetchChallengerRoute(pair.a, pair.b, "day", opts),
      fetchChallengerRoute(pair.b, START, "day", opts),
    ]);
    if (!l1 || !l2 || !l3) {
      console.log(`  ${pair.strategy}: leg missing (${!!l1},${!!l2},${!!l3})`);
      continue;
    }
    const dur = l1.duration_s + l2.duration_s + l3.duration_s;
    const inBand = dur >= band[0] && dur <= band[1];
    const o12 = legOverlapM(l1.geometry, l2.geometry);
    const o23 = legOverlapM(l2.geometry, l3.geometry);
    const o13 = legOverlapM(l1.geometry, l3.geometry);
    console.log(
      `  ${pair.strategy}: ${Math.round(dur / 60)}min ${inBand ? "IN-BAND" : "out-of-band"}  legOverlap m 1-2=${Math.round(o12)} 2-3=${Math.round(o23)} 1-3=${Math.round(o13)}`,
    );
    for (const [leg, geom] of [
      ["leg1", l1.geometry],
      ["leg2", l2.geometry],
      ["leg3", l3.geometry],
    ] as const) {
      dump.push(
        lineFeature(geom, {
          kind: "leg",
          label,
          pair: pair.strategy,
          leg,
          duration_min: Math.round(dur / 60),
          in_band: inBand,
        }),
      );
    }
  }
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
  const base = apiBase();
  const featuresRes = await fetch(
    `${base}/api/map-data/segment_scores.geojson`,
  );
  const features = ((await featuresRes.json()) as GeoJSON.FeatureCollection)
    .features;
  if (!features.length) throw new Error("No segment features");
  mkdirSync(OUT_DIR, { recursive: true });

  const { shadeOrLight, footpaths } = contrastOutingPrefs("day");
  const sets: [string, RoutePreferences][] = [
    ["shade-max", shadeOrLight],
    ["footpaths-max", footpaths],
    ["default", DEFAULT_PREFS_DAY],
  ];

  const cardDump: GeoJSON.Feature[] = [];
  for (const [label, prefs] of sets) {
    await reproduceCards(label, prefs, features, token, base, cardDump);
  }
  writeFileSync(`${OUT_DIR}/cards.geojson`, JSON.stringify(fc(cardDump)));

  const legDump: GeoJSON.Feature[] = [];
  for (const [label, prefs] of sets.slice(0, 2)) {
    await probePairs(label, prefs, features, base, legDump);
  }
  writeFileSync(`${OUT_DIR}/legs.geojson`, JSON.stringify(fc(legDump)));

  console.log(`\nDumped ${OUT_DIR}/cards.geojson and legs.geojson`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
