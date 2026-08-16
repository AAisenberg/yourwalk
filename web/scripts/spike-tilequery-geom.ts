import { readFileSync, existsSync } from "fs";
import { fetchWalkingRouteCandidates } from "../src/lib/routing/directions";

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
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const mapbox = await fetchWalkingRouteCandidates(
    { lng: 145.324244, lat: -38.056162 },
    { lng: 145.337065, lat: -38.050622 },
    token,
    1,
  );
  const coords = mapbox[0]!.geometry.coordinates;
  const i = Math.floor(coords.length * 0.2);
  const [lng, lat] = coords[i]!;
  console.log("sample vertex", i, "of", coords.length, { lng, lat });

  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json`,
  );
  url.searchParams.set("radius", "30");
  url.searchParams.set("limit", "10");
  url.searchParams.set("layers", "road");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const body = (await res.json()) as {
    features?: Array<{
      geometry?: { type?: string; coordinates?: unknown };
      properties?: {
        class?: string;
        type?: string;
        tilequery?: { distance?: number };
      };
    }>;
  };
  for (const f of body.features ?? []) {
    const p = f.properties ?? {};
    const g = f.geometry;
    console.log({
      class: p.class,
      type: p.type,
      dist: p.tilequery?.distance,
      geomType: g?.type,
      coordsPreview: JSON.stringify(g?.coordinates)?.slice(0, 120),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
