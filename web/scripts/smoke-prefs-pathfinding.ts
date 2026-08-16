/**
 * P2: preference-weighted challenger — shade-max vs footpaths-max geometries.
 *
 *   npx tsx scripts/smoke-prefs-pathfinding.ts
 *
 * Requires challenger on :8790 (graph rebuilt with prefs_pathfinding) and
 * Next proxy on :3000 (or YOURWALK_APP_URL).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import { isGeometryDistinct } from "../src/lib/routing/planRoute";

function loadEnv() {
  const p = ".env.local";
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1]!.trim();
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

type OdPair = {
  id: string;
  label: string;
  origin: { center: [number, number] };
  destination: { center: [number, number] };
};

function sampleAvg(
  a: GeoJSON.LineString,
  b: GeoJSON.LineString,
): number {
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
  const apiBase =
    process.env.YOURWALK_APP_URL?.trim() || "http://localhost:3000";

  const fixture = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../docs/fixtures/bakeoff_od_sample.json"),
      "utf8",
    ),
  ) as { pairs: OdPair[] };

  const want = new Set(["OD-01", "OD-11", "OD-12"]);
  const pairs = fixture.pairs.filter((p) => want.has(p.id));

  const shadeMax = { accessibility: 10, shadeHeat: 100, afterDark: 10 };
  const footMax = { accessibility: 100, shadeHeat: 10, afterDark: 10 };

  console.log(`apiBase=${apiBase}`);
  let distinctCount = 0;
  let compared = 0;

  for (const p of pairs) {
    const origin = { lng: p.origin.center[0], lat: p.origin.center[1] };
    const destination = {
      lng: p.destination.center[0],
      lat: p.destination.center[1],
    };

    const [shade, foot] = await Promise.all([
      fetchChallengerRoute(origin, destination, "day", {
        apiBase,
        prefs: shadeMax,
      }),
      fetchChallengerRoute(origin, destination, "day", {
        apiBase,
        prefs: footMax,
      }),
    ]);

    if (!shade || !foot) {
      console.log(
        `${p.id}  FAIL missing route shade=${Boolean(shade)} foot=${Boolean(foot)}`,
      );
      continue;
    }

    compared++;
    const distinct = isGeometryDistinct(
      shade.geometry,
      shade.distance_m,
      [{ geometry: foot.geometry, distance_m: foot.distance_m }],
    );
    if (distinct) distinctCount++;
    const avg = sampleAvg(shade.geometry, foot.geometry);

    console.log(
      `${p.id}  shade=${Math.round(shade.distance_m)}m (${shade.strategy})  foot=${Math.round(foot.distance_m)}m (${foot.strategy})  distinct=${distinct}  avgSampleΔ=${avg.toFixed(5)}`,
    );
  }

  console.log(
    `\nSummary: ${distinctCount}/${compared} ODs with distinct shade-max vs footpaths-max challenger geometries`,
  );
  if (compared === 0) {
    process.exit(1);
  }
  // Soft pass: at least one OD shows geometry change (network permitting)
  if (distinctCount === 0) {
    console.log(
      "WARN: no distinct geometries — network may not diversify on these ODs; not a hard fail",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
