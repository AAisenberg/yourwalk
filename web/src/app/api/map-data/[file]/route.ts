import { NextResponse } from "next/server";

/**
 * Same-origin proxy for Casey map GeoJSON.
 *
 * The old Supabase Storage host (muxatxlmpbkrsygmxcje) no longer resolves.
 * Release assets on GitHub are the interim CDN, but browsers cannot fetch them
 * cross-origin — so the client loads /api/map-data/* and we stream here.
 *
 * Override with MAP_DATA_RELEASE_BASE if the release tag moves.
 */
const ALLOWED = new Set([
  "segment_scores.geojson",
  "casey_lga_boundary.geojson",
  "segment_scores.meta.json",
]);

const DEFAULT_BASE =
  "https://github.com/AAisenberg/yourwalk/releases/download/map-data-v1";

export async function GET(
  _req: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!ALLOWED.has(file)) {
    return NextResponse.json({ error: "Unknown map-data object" }, { status: 404 });
  }

  const base = (
    process.env.MAP_DATA_RELEASE_BASE?.trim() || DEFAULT_BASE
  ).replace(/\/$/, "");
  const upstream = `${base}/${file}`;

  const res = await fetch(upstream, {
    redirect: "follow",
    // Cache at the edge briefly; GeoJSON is large.
    next: { revalidate: 3600 },
  });

  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: `Upstream map-data failed: HTTP ${res.status}`, upstream },
      { status: 502 },
    );
  }

  const contentType = file.endsWith(".json")
    ? "application/json; charset=utf-8"
    : "application/geo+json; charset=utf-8";

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
