/**
 * Track 0e: verify nudged paint never weaves across its raw line.
 * Counts side flips (nudged vs raw, |offset| ≥ 2 m each side of the flip).
 * npx tsx scripts/verify-no-weave.ts
 */
import { readFileSync, existsSync } from "fs";
import { nudgeGeometryTowardSidewalk } from "../src/lib/routing/carriageway";
import { fetchChallengerRoute } from "../src/lib/routing/challenger";
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

const M_PER_DEG_LAT = 111320;
const coslat = (lat: number) => Math.cos((lat * Math.PI) / 180);

/** Signed lateral offset (m) of point p from its nearest segment of `line`. */
function signedOffsetM(p: [number, number], line: [number, number][]): number {
  let best = Infinity;
  let bestSigned = 0;
  const k = coslat(p[1]);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const ax = (p[0] - a[0]) * M_PER_DEG_LAT * k;
    const ay = (p[1] - a[1]) * M_PER_DEG_LAT;
    const bx = (b[0] - a[0]) * M_PER_DEG_LAT * k;
    const by = (b[1] - a[1]) * M_PER_DEG_LAT;
    const len2 = bx * bx + by * by;
    if (len2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / len2));
    const dx = ax - t * bx;
    const dy = ay - t * by;
    const d = Math.hypot(dx, dy);
    if (d < best) {
      best = d;
      // Sign by cross product of segment direction × offset vector.
      bestSigned = Math.sign(bx * dy - by * dx) * d;
    }
  }
  return bestSigned;
}

function densify(line: [number, number][], stepM: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const k = coslat(a[1]);
    const seg = Math.hypot(
      (b[0] - a[0]) * M_PER_DEG_LAT * k,
      (b[1] - a[1]) * M_PER_DEG_LAT,
    );
    const n = Math.max(1, Math.round(seg / stepM));
    for (let s = 0; s < n; s++) {
      const f = s / n;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  out.push(line[line.length - 1]!);
  return out;
}

function weaveFlips(
  raw: GeoJSON.LineString,
  nudged: GeoJSON.LineString,
): { flips: number; maxOffsetM: number } {
  const rawCs = raw.coordinates as [number, number][];
  const pts = densify(nudged.coordinates as [number, number][], 8);
  const offsets = pts.map((p) => signedOffsetM(p, rawCs));
  let flips = 0;
  let last = 0;
  let maxOff = 0;
  for (const o of offsets) {
    maxOff = Math.max(maxOff, Math.abs(o));
    if (Math.abs(o) < 2) continue;
    const s = Math.sign(o);
    if (last !== 0 && s !== last) flips++;
    last = s;
  }
  return { flips, maxOffsetM: maxOff };
}

const ODS: Array<{
  name: string;
  o: { lng: number; lat: number };
  d: { lng: number; lat: number };
}> = [
  {
    name: "OD-12 Cupples → Ashfield",
    o: { lng: 145.324244, lat: -38.056162 },
    d: { lng: 145.337065, lat: -38.050622 },
  },
  {
    name: "OD-05 Hampton Park → shops (Fordholm Rd)",
    o: { lng: 145.263, lat: -38.0305 },
    d: { lng: 145.271857, lat: -38.033843 },
  },
];

async function main() {
  loadEnv();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

  // OD-05 coords come from the bake-off fixture when available.
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
      ODS[1]!.o = od5.origin;
      ODS[1]!.d = od5.destination;
    }
  } catch {
    // keep hardcoded fallback
  }

  for (const od of ODS) {
    console.log(`\n=== ${od.name} ===`);
    const [mapbox, challenger] = await Promise.all([
      fetchWalkingRouteCandidates(od.o, od.d, token, 3),
      fetchChallengerRoute(od.o, od.d, "day", {
        apiBase: "http://localhost:3001",
      }),
    ]);
    for (const r of mapbox) {
      const n = await nudgeGeometryTowardSidewalk(r.geometry, token);
      const w = weaveFlips(r.geometry, n.geometry);
      console.log(
        `mapbox/${r.strategy}: nudged=${(n.nudged_share * 100).toFixed(0)}% flips=${w.flips} maxOffset=${w.maxOffsetM.toFixed(1)}m`,
      );
    }
    if (challenger) {
      const n = await nudgeGeometryTowardSidewalk(challenger.geometry, token);
      const w = weaveFlips(challenger.geometry, n.geometry);
      console.log(
        `challenger/${challenger.strategy}: nudged=${(n.nudged_share * 100).toFixed(0)}% flips=${w.flips} maxOffset=${w.maxOffsetM.toFixed(1)}m`,
      );
    } else {
      console.log("challenger: unavailable");
    }
  }
  console.log(
    "\nPASS criterion: flips ≤ 1 per route (0 ideal; 1 tolerated at a genuine crossing).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
