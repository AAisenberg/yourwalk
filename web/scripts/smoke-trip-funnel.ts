/**
 * A→B candidate funnel: where options die (Mapbox → gates → challenger).
 *
 *   npx tsx scripts/smoke-trip-funnel.ts
 *   YOURWALK_APP_URL=https://yourwalk.vercel.app npx tsx scripts/smoke-trip-funnel.ts
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { diagnoseTripRouteFunnel } from "../src/lib/routing/tripFunnel";

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

async function probeChallenger(apiBase: string): Promise<string> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/challenger-route`, {
      method: "GET",
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && body.ok !== false) return `OK ${res.status}`;
    return `DOWN ${res.status} ${body.error ?? ""}`.trim();
  } catch (err) {
    return `DOWN ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN missing");

  const apiBase =
    process.env.YOURWALK_APP_URL?.trim() || "http://localhost:3000";

  const fixturePath = resolve(
    __dirname,
    "../../docs/fixtures/bakeoff_od_sample.json",
  );
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    pairs: OdPair[];
  };

  // Focus set: verified bake-off ODs + carriageway regression + longer trip
  const want = new Set([
    "OD-01",
    "OD-03",
    "OD-08",
    "OD-11",
    "OD-12",
  ]);
  const pairs = fixture.pairs.filter((p) => want.has(p.id));

  // OD-CARRIAGE-01 from ROUTING_OUTPUTS.md
  pairs.push({
    id: "OD-CARRIAGE-01",
    label: "Epsom Lane → Arubi Ave (carriageway regression)",
    origin: { center: [145.332444, -38.088427] },
    destination: { center: [145.338191, -38.11054] },
  });

  // Montpelier-area A→B (suburb grid / demo corridor)
  pairs.push({
    id: "OD-MONTPELIER",
    label: "Montpelier Dr area → nearby arterial walk",
    origin: { center: [145.3485, -38.0405] },
    destination: { center: [145.3555, -38.035] },
  });

  console.log(`apiBase=${apiBase}`);
  const health = await probeChallenger(apiBase);
  console.log(`challenger health: ${health}`);
  console.log("");

  const reports = [];
  for (const p of pairs) {
    const report = await diagnoseTripRouteFunnel({
      id: p.id,
      label: p.label,
      origin: { lng: p.origin.center[0], lat: p.origin.center[1] },
      destination: {
        lng: p.destination.center[0],
        lat: p.destination.center[1],
      },
      token,
      mode: "day",
      apiBase,
    });
    reports.push(report);

    const s = report.stages;
    console.log(
      `${p.id}  raw=${s.mapbox_raw} detour=${s.after_detour} carriage=${s.after_carriageway} distinct=${s.after_mapbox_distinct} final=${s.final_cards}  challenger=${s.challenger_available ? (s.challenger_kept ? "kept" : report.challenger.reason) : "down"}`,
    );
    if (report.dropped_carriageway.length) {
      console.log(
        `  dropped carriageway: ${report.dropped_carriageway
          .map(
            (d) =>
              `${d.strategy} ${d.distance_m}m share=${d.carriageway_share}`,
          )
          .join("; ")}`,
      );
    }
    if (report.dropped_detour.length) {
      console.log(
        `  dropped detour: ${report.dropped_detour
          .map((d) => `${d.strategy} ${d.distance_m}m`)
          .join("; ")}`,
      );
    }
    console.log(
      `  final: ${report.final
        .map((f) => `${f.strategy} ${f.distance_m}m`)
        .join(" | ") || "(none)"}`,
    );
  }

  const outDir = resolve(__dirname, "../../pipeline/data/qa");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "trip_funnel_2026-08-12.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        apiBase,
        challenger_health: health,
        reports,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${outPath}`);

  const single = reports.filter((r) => r.stages.final_cards <= 1).length;
  const multi = reports.filter((r) => r.stages.final_cards >= 2).length;
  console.log(
    `\nSummary: ${multi} ODs with ≥2 cards, ${single} with ≤1 card, challenger ${health.startsWith("OK") ? "up" : "DOWN"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
