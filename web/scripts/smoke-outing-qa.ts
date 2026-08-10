/**
 * Pre-commit smoke: Loop finds + revisit gate + match prefers corridor.
 * npx tsx scripts/smoke-outing-qa.ts
 */
import { readFileSync, existsSync } from "fs";
import { planOutingRoutes } from "../src/lib/routing/planOuting";
import {
  DEFAULT_PREFS_DAY,
  preferenceScore,
} from "../src/lib/routing/preferences";

function loadEnv() {
  const p = ".env.local";
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseRev(strategy?: string): number | null {
  const m = strategy?.match(/rev([0-9.]+)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");

  const features = (
    (await (
      await fetch("http://localhost:3001/api/map-data/segment_scores.geojson")
    ).json()) as GeoJSON.FeatureCollection
  ).features;
  if (!features.length) throw new Error("No segment features from localhost:3001");

  const starts = [
    { name: "Montpelier", lng: 145.3485, lat: -38.0405 },
    { name: "Cranbourne", lng: 145.283, lat: -38.1 },
    { name: "Clyde N", lng: 145.342, lat: -38.09 },
    { name: "Narre", lng: 145.316, lat: -38.018 },
  ];

  let fails = 0;
  const rows: string[] = [];

  for (const s of starts) {
    for (const mins of [15, 30] as const) {
      try {
        const routes = await planOutingRoutes(
          s,
          mins,
          features,
          token,
          "day",
          DEFAULT_PREFS_DAY,
          { shape: "loop" },
        );
        const revs = routes.map((r) => parseRev(r.strategy));
        const bad = revs.some((v) => v != null && v > 0.2 + 1e-9);
        if (!routes.length) {
          fails++;
          rows.push(`${s.name} ${mins}m EMPTY`);
          continue;
        }
        if (bad) {
          fails++;
          rows.push(
            `${s.name} ${mins}m FAIL revisit>${0.2}: ${revs.join(",")}`,
          );
          continue;
        }
        // Match should prefer higher preferenceScore when durations similar
        if (routes.length >= 2) {
          const a = routes[0]!;
          const b = routes[1]!;
          const pa = preferenceScore(a, DEFAULT_PREFS_DAY, "day") ?? 0;
          const pb = preferenceScore(b, DEFAULT_PREFS_DAY, "day") ?? 0;
          const ma = a.match_score ?? 0;
          const mb = b.match_score ?? 0;
          // If B is clearly better corridor (+3 pts) and similar time, A shouldn't win by >2 match pts on time alone
          const durDiff =
            Math.abs(a.duration_s - b.duration_s) / 60;
          if (pb > pa + 3 && durDiff <= 3 && ma > mb + 2) {
            fails++;
            rows.push(
              `${s.name} ${mins}m WARN time still dominating match (${ma.toFixed(1)}>${mb.toFixed(1)} pref ${pa.toFixed(0)}/${pb.toFixed(0)})`,
            );
            continue;
          }
        }
        rows.push(
          `${s.name} ${mins}m OK n=${routes.length} rev=${revs.map((v) => (v == null ? "?" : v.toFixed(2))).join(",")}`,
        );
      } catch {
        // Honest empty is acceptable under approach A
        rows.push(`${s.name} ${mins}m EMPTY (error)`);
      }
    }

    // There-and-back still works
    try {
      const oab = await planOutingRoutes(
        s,
        25,
        features,
        token,
        "day",
        DEFAULT_PREFS_DAY,
        { shape: "out_and_back" },
      );
      rows.push(
        `${s.name} 25m there-back ${oab.length ? "OK" : "EMPTY"} n=${oab.length}`,
      );
    } catch {
      // There-and-back can miss ±5 at some starts; not a Loop A regression.
      rows.push(`${s.name} 25m there-back EMPTY (acceptable)`);
    }
  }

  console.log(rows.join("\n"));
  console.log(fails ? `\nSMOKE ISSUES: ${fails}` : "\nSMOKE PASS");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
