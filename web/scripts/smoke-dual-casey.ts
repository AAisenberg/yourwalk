/**
 * Dual Casey consistency: preference-best + other pathish corridor
 * across the bake-off OD sample (default day prefs, away off).
 *
 *   YOURWALK_APP_URL=http://localhost:3001 npx tsx scripts/smoke-dual-casey.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
import {
  isGeometryDistinct,
  planScoredRoutes,
} from "../src/lib/routing/planRoute";
import {
  DEFAULT_PREFS_DAY,
  isComplementStrategy,
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

type OdPair = {
  id: string;
  label: string;
  verified?: boolean;
  origin: { center: [number, number] };
  destination: { center: [number, number] };
};

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
  const base = apiBase();
  console.log(`apiBase=${base}\n`);

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
      label: "Epsom → Arubi",
      origin: { center: [145.332444, -38.088427] },
      destination: { center: [145.338191, -38.11054] },
    },
  ];

  const prefs = {
    accessibility: DEFAULT_PREFS_DAY.accessibility,
    shadeHeat: DEFAULT_PREFS_DAY.shadeHeat,
    afterDark: DEFAULT_PREFS_DAY.afterDark,
  };

  let dual = 0;
  let single = 0;
  let missing = 0;

  console.log(
    "id               pref_m  comp_m  distinct  pathish  vs_quick  plan_casey  plan_mapbox  note",
  );

  for (const p of pairs) {
    const origin = { lng: p.origin.center[0], lat: p.origin.center[1] };
    const destination = {
      lng: p.destination.center[0],
      lat: p.destination.center[1],
    };

    const [pref, comp, quick, planned] = await Promise.all([
      fetchChallengerRoute(origin, destination, "day", { apiBase: base, prefs }),
      fetchChallengerRoute(origin, destination, "day", {
        apiBase: base,
        prefs: { ...prefs, complement: true },
      }),
      fetchChallengerRoute(origin, destination, "day", { apiBase: base }),
      planScoredRoutes(origin, destination, [], token, 3, "day", DEFAULT_PREFS_DAY, {
        challengerApiBase: base,
      }),
    ]);

    if (!pref) {
      missing++;
      console.log(`${p.id.padEnd(16)}  FAIL no preference-best`);
      continue;
    }

    const distinct =
      Boolean(comp) &&
      isGeometryDistinct(comp!.geometry, comp!.distance_m, [
        { geometry: pref.geometry, distance_m: pref.distance_m },
      ]);
    const vsQuick =
      Boolean(comp) &&
      Boolean(quick) &&
      !isGeometryDistinct(comp!.geometry, comp!.distance_m, [
        { geometry: quick!.geometry, distance_m: quick!.distance_m },
      ]);
    const casey = planned.filter((r) => isScoreAwareStrategy(r.strategy));
    const mapbox = planned.filter((r) => !isScoreAwareStrategy(r.strategy));
    const hasCompCard = casey.some((r) => isComplementStrategy(r.strategy));

    let note = "";
    if (!comp) note = "complement omitted";
    else if (!distinct) note = "complement = pref";
    else if (vsQuick) note = "complement = pathish-quickest";
    else note = "other corridor";

    if (casey.length >= 2) dual++;
    else if (casey.length === 1) single++;
    else missing++;

    console.log(
      `${p.id.padEnd(16)} ${Math.round(pref.distance_m).toString().padStart(6)}  ${
        comp ? Math.round(comp.distance_m).toString().padStart(6) : "     —"
      }  ${distinct ? "yes" : "no "}      ${
        comp?.osm_pathish_share?.toFixed(2) ?? "   —"
      }   ${vsQuick ? "same   " : "diff   "}  ${String(casey.length).padStart(2)} (${hasCompCard ? "comp" : "no-c"})   ${String(mapbox.length).padStart(2)}          ${note}`,
    );
    console.log(`                 ${p.label}`);
  }

  console.log(
    `\ndual Casey ${dual}  single Casey ${single}  none ${missing}  of ${pairs.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
