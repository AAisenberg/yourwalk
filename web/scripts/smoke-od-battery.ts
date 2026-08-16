/**
 * Full bake-off OD battery: funnel + prefs geometry + resident plan ranking.
 *
 *   YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/smoke-od-battery.ts
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import {
  isGeometryDistinct,
  planScoredRoutes,
} from "../src/lib/routing/planRoute";
import {
  DEFAULT_PREFS_DAY,
  sortRoutesByPreferences,
} from "../src/lib/routing/preferences";
import { diagnoseTripRouteFunnel } from "../src/lib/routing/tripFunnel";

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

type OdPair = {
  id: string;
  label: string;
  verified?: boolean;
  origin: { name?: string; center: [number, number] };
  destination: { name?: string; center: [number, number] };
};

function sampleAvg(a: GeoJSON.LineString, b: GeoJSON.LineString): number {
  const n = 7;
  const sa = sample(a, n);
  const sb = sample(b, n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.hypot(sa[i]![0] - sb[i]![0], sa[i]![1] - sb[i]![1]);
  }
  return sum / n;
}

function sample(line: GeoJSON.LineString, n: number): [number, number][] {
  const coords = line.coordinates;
  if (coords.length < 2) return Array(n).fill(coords[0] ?? [0, 0]);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idx = t * (coords.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(coords.length - 1, lo + 1);
    const f = idx - lo;
    const a = coords[lo]!;
    const b = coords[hi]!;
    out.push([a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f]);
  }
  return out;
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
  const apiBase = defaultApiBase();

  const fixture = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../docs/fixtures/bakeoff_od_sample.json"),
      "utf8",
    ),
  ) as { pairs: OdPair[] };

  const pairs: OdPair[] = [
    ...fixture.pairs,
    {
      id: "OD-CARRIAGE-01",
      label: "Epsom Lane → Arubi Ave (carriageway regression)",
      origin: { center: [145.332444, -38.088427] },
      destination: { center: [145.338191, -38.11054] },
    },
  ];

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

  console.log(`apiBase=${apiBase}`);
  const healthRes = await fetch(`${apiBase.replace(/\/$/, "")}/api/challenger-route`);
  const healthBody = (await healthRes.json()) as { ok?: boolean };
  console.log(
    `challenger proxy: ${healthRes.ok && healthBody.ok ? "OK" : "DOWN"}`,
  );

  const segRes = await fetch(
    `${apiBase.replace(/\/$/, "")}/api/map-data/segment_scores.geojson`,
  );
  if (!segRes.ok) {
    throw new Error(
      `segment_scores.geojson ${segRes.status} — map data API needed for pills`,
    );
  }
  const fc = (await segRes.json()) as GeoJSON.FeatureCollection;
  console.log(`segments loaded: ${fc.features.length}`);
  console.log("");

  type Row = {
    id: string;
    label: string;
    verified: boolean;
    mapbox_raw: number;
    final_cards: number;
    challenger: string;
    final: string;
    prefs_challenger_distinct: boolean | null;
    shade_m: number | null;
    foot_m: number | null;
    avg_sample_delta: number | null;
    shade_rec: string | null;
    foot_rec: string | null;
    recommended_moves: boolean | null;
    demo_score: number;
    notes: string[];
  };

  const rows: Row[] = [];

  for (const p of pairs) {
    const origin = { lng: p.origin.center[0], lat: p.origin.center[1] };
    const destination = {
      lng: p.destination.center[0],
      lat: p.destination.center[1],
    };
    const notes: string[] = [];

    const funnel = await diagnoseTripRouteFunnel({
      id: p.id,
      label: p.label,
      origin,
      destination,
      token,
      mode: "day",
      apiBase,
    });

    const [shadeCh, footCh] = await Promise.all([
      fetchChallengerRoute(origin, destination, "day", {
        apiBase,
        prefs: shadePrefs,
      }),
      fetchChallengerRoute(origin, destination, "day", {
        apiBase,
        prefs: footPrefs,
      }),
    ]);

    let prefsDistinct: boolean | null = null;
    let shadeM: number | null = null;
    let footM: number | null = null;
    let avgDelta: number | null = null;
    if (shadeCh && footCh) {
      shadeM = Math.round(shadeCh.distance_m);
      footM = Math.round(footCh.distance_m);
      prefsDistinct = isGeometryDistinct(shadeCh.geometry, shadeCh.distance_m, [
        { geometry: footCh.geometry, distance_m: footCh.distance_m },
      ]);
      avgDelta = sampleAvg(shadeCh.geometry, footCh.geometry);
    } else {
      notes.push("challenger missing under prefs");
    }

    let shadeRec: string | null = null;
    let footRec: string | null = null;
    let recMoves: boolean | null = null;
    try {
      const [shadePlan, footPlan] = await Promise.all([
        planScoredRoutes(
          origin,
          destination,
          fc.features,
          token,
          3,
          "day",
          shadePrefs,
          { challengerApiBase: apiBase },
        ),
        planScoredRoutes(
          origin,
          destination,
          fc.features,
          token,
          3,
          "day",
          footPrefs,
          { challengerApiBase: apiBase },
        ),
      ]);
      const shadeRanked = sortRoutesByPreferences(shadePlan, shadePrefs, "day");
      const footRanked = sortRoutesByPreferences(footPlan, footPrefs, "day");
      const a = shadeRanked[0];
      const b = footRanked[0];
      if (a && b) {
        shadeRec = `${a.strategy ?? a.id} ${Math.round(a.distance_m)}m HS=${a.score.heat_shade_display ?? "—"} FP=${a.score.accessibility_display ?? "—"}`;
        footRec = `${b.strategy ?? b.id} ${Math.round(b.distance_m)}m HS=${b.score.heat_shade_display ?? "—"} FP=${b.score.accessibility_display ?? "—"}`;
        recMoves = isGeometryDistinct(a.geometry, a.distance_m, [
          { geometry: b.geometry, distance_m: b.distance_m },
        ]);
      }
    } catch (err) {
      notes.push(
        `plan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const s = funnel.stages;
    const challengerLabel = !s.challenger_available
      ? "down"
      : s.challenger_kept
        ? "kept"
        : (funnel.challenger.reason ?? "dropped");

    // Demo usefulness: multi-card + prefs move geometry + verified QA
    let demo = 0;
    if (s.final_cards >= 2) demo += 3;
    if (prefsDistinct) demo += 3;
    if (recMoves) demo += 2;
    if (p.verified) demo += 1;
    if (s.challenger_kept) demo += 1;

    const row: Row = {
      id: p.id,
      label: p.label,
      verified: Boolean(p.verified),
      mapbox_raw: s.mapbox_raw,
      final_cards: s.final_cards,
      challenger: challengerLabel,
      final:
        funnel.final
          .map((f) => `${f.strategy} ${f.distance_m}m`)
          .join(" | ") || "(none)",
      prefs_challenger_distinct: prefsDistinct,
      shade_m: shadeM,
      foot_m: footM,
      avg_sample_delta: avgDelta,
      shade_rec: shadeRec,
      foot_rec: footRec,
      recommended_moves: recMoves,
      demo_score: demo,
      notes,
    };
    rows.push(row);

    console.log(
      `${p.id}  cards=${s.final_cards}  ch=${challengerLabel}  prefsΔ=${prefsDistinct}  recMoves=${recMoves}  demo=${demo}`,
    );
    console.log(`  ${p.label}`);
    console.log(`  final: ${row.final}`);
    if (shadeRec && footRec) {
      console.log(`  shade★ ${shadeRec}`);
      console.log(`  foot★  ${footRec}`);
    }
    if (notes.length) console.log(`  notes: ${notes.join("; ")}`);
    console.log("");
  }

  rows.sort((a, b) => b.demo_score - a.demo_score);

  const outDir = resolve(__dirname, "../../pipeline/data/qa");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "od_battery_latest.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        apiBase,
        rows,
      },
      null,
      2,
    ),
  );

  const multi = rows.filter((r) => r.final_cards >= 2).length;
  const prefsHit = rows.filter((r) => r.prefs_challenger_distinct).length;
  const recHit = rows.filter((r) => r.recommended_moves).length;

  console.log("=== Summary ===");
  console.log(`≥2 cards: ${multi}/${rows.length}`);
  console.log(`prefs change challenger geometry: ${prefsHit}/${rows.length}`);
  console.log(`Recommended geometry moves with prefs: ${recHit}/${rows.length}`);
  console.log("\nBest manual demos (by score):");
  for (const r of rows.slice(0, 5)) {
    console.log(
      `  ${r.id} (demo=${r.demo_score}) cards=${r.final_cards} prefsΔ=${r.prefs_challenger_distinct} recMoves=${r.recommended_moves}`,
    );
    console.log(`    ${r.label}`);
  }
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
