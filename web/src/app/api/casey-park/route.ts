import { NextResponse } from "next/server";

import { CASEY_BOUNDS } from "@/lib/scores";

type CaseyRow = {
  parkresname?: string | null;
  suburb?: string | null;
  prtype?: string | null;
  prarea_m2?: number | null;
};

const CASEY_PARKS_URL =
  "https://data.casey.vic.gov.au/api/explore/v2.1/catalog/datasets/parks-reserves-ply-t1eam/records";

function inCaseyBbox(lng: number, lat: number): boolean {
  return (
    lng >= CASEY_BOUNDS.west &&
    lng <= CASEY_BOUNDS.east &&
    lat >= CASEY_BOUNDS.south &&
    lat <= CASEY_BOUNDS.north
  );
}

/** Skip road verges so a hospital car park does not become a naturestrip. */
function isNamedParkWorthShowing(
  name: string,
  prtype?: string | null,
): boolean {
  const n = name.trim();
  if (!n) return false;
  if (/naturestrip|tree reserve|\bmedian\b|roundabout/i.test(n)) return false;
  if (prtype && /naturestrip|arterial reserve|linking crt/i.test(prtype)) {
    return false;
  }
  return true;
}

/**
 * Point-in-polygon against Casey parks / reserves (T1EAM).
 * Used only to label a map tap. The pin stays where they tapped.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lng = Number(searchParams.get("lng"));
  const lat = Number(searchParams.get("lat"));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "lng and lat required" }, { status: 400 });
  }
  if (!inCaseyBbox(lng, lat)) {
    return NextResponse.json({ name: null });
  }

  const where = `intersects(geo_shape, geom'POINT(${lng} ${lat})')`;
  const url = new URL(CASEY_PARKS_URL);
  url.searchParams.set("where", where);
  url.searchParams.set("select", "parkresname,suburb,prtype,prarea_m2");
  url.searchParams.set("limit", "8");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ name: null }, { status: 200 });
    }
    const body = (await res.json()) as { results?: CaseyRow[] };
    const rows = [...(body.results ?? [])].sort(
      (a, b) => (b.prarea_m2 ?? 0) - (a.prarea_m2 ?? 0),
    );
    const hit = rows.find((r) =>
      isNamedParkWorthShowing(r.parkresname ?? "", r.prtype),
    );
    const name = hit?.parkresname?.trim() || null;
    const suburb = hit?.suburb?.trim() || null;
    return NextResponse.json(
      { name, suburb },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json({ name: null });
  }
}
