/**
 * Investigation #4: does walkway_bias change Mapbox route choice on problem ODs?
 * Compares bias 0 / 0.5 / 0.8 / 1.0 on OD-12 and OD-05.
 * npx tsx scripts/spike-walkway-bias.ts
 */
import { readFileSync, existsSync } from "fs";

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

const PATHISH = new Set([
  "path",
  "pedestrian",
  "footway",
  "sidewalk",
  "crossing",
  "steps",
  "cycleway",
  "track",
]);

async function fetchBias(
  o: [number, number],
  d: [number, number],
  bias: number | null,
  token: string,
) {
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/walking/${o[0]},${o[1]};${d[0]},${d[1]}`,
  );
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  if (bias != null) url.searchParams.set("walkway_bias", String(bias));
  url.searchParams.set("access_token", token);
  const body = (await (await fetch(url.toString())).json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: GeoJSON.LineString;
    }>;
  };
  return body.routes?.[0] ?? null;
}

async function pathishShare(line: GeoJSON.LineString, token: string) {
  const cs = line.coordinates as [number, number][];
  const step = Math.max(1, Math.floor(cs.length / 15));
  let path = 0;
  let road = 0;
  for (let i = 0; i < cs.length; i += step) {
    const url = new URL(
      `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${cs[i]![0]},${cs[i]![1]}.json`,
    );
    url.searchParams.set("radius", "35");
    url.searchParams.set("limit", "5");
    url.searchParams.set("layers", "road");
    url.searchParams.set("access_token", token);
    const body = (await (await fetch(url.toString())).json()) as {
      features?: Array<{
        properties?: { class?: string; type?: string };
      }>;
    };
    const top = body.features?.[0];
    if (!top) continue;
    const c = (top.properties?.class ?? "").toLowerCase();
    const t = (top.properties?.type ?? "").toLowerCase();
    if (PATHISH.has(c) || PATHISH.has(t)) path++;
    else road++;
  }
  return path / Math.max(1, path + road);
}

function geomDiffM(a: GeoJSON.LineString, b: GeoJSON.LineString): number {
  const M = 111320;
  const bc = b.coordinates as [number, number][];
  const ds = (a.coordinates as [number, number][]).map((p) =>
    Math.min(
      ...bc.map((q) =>
        Math.hypot(
          (q[0] - p[0]) * M * Math.cos((p[1] * Math.PI) / 180),
          (q[1] - p[1]) * M,
        ),
      ),
    ),
  );
  return ds.reduce((x, y) => x + y, 0) / Math.max(1, ds.length);
}

const ODS: Array<{ name: string; o: [number, number]; d: [number, number] }> = [
  {
    name: "OD-12 Cupples → Ashfield",
    o: [145.324244, -38.056162],
    d: [145.337065, -38.050622],
  },
  {
    name: "OD-05 Hampton Park → shops",
    o: [145.263, -38.0305],
    d: [145.271857, -38.033843],
  },
];

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

  try {
    const fixture = JSON.parse(
      readFileSync("public/bakeoff/od_sample.json", "utf8"),
    ) as Array<{
      od_id: string;
      origin: { lng: number; lat: number };
      destination: { lng: number; lat: number };
    }>;
    const od5 = fixture.find((f) => f.od_id === "OD-05");
    if (od5) {
      ODS[1]!.o = [od5.origin.lng, od5.origin.lat];
      ODS[1]!.d = [od5.destination.lng, od5.destination.lat];
    }
  } catch {
    // fallback coords
  }

  for (const od of ODS) {
    console.log(`\n=== ${od.name} ===`);
    let base: GeoJSON.LineString | null = null;
    for (const bias of [0, 0.5, 0.8, 1.0]) {
      const r = await fetchBias(od.o, od.d, bias, token);
      if (!r) {
        console.log(`bias=${bias}: no route`);
        continue;
      }
      const share = await pathishShare(r.geometry, token);
      const diff = base ? geomDiffM(r.geometry, base) : 0;
      if (!base) base = r.geometry;
      console.log(
        `bias=${bias.toFixed(1)}: ${Math.round(r.distance)}m ${(r.duration / 60).toFixed(1)}min pathish=${(share * 100).toFixed(0)}% geomΔ vs bias0=${diff.toFixed(1)}m`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
