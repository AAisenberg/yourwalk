import { NextResponse } from "next/server";

/**
 * Legacy paginated PostGIS path — superseded by static GeoJSON on Supabase Storage.
 * Prefer NEXT_PUBLIC_SEGMENTS_GEOJSON_URL (see upload_segment_scores_geojson.py).
 */
export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SEGMENTS_GEOJSON_URL?.trim() ||
    (process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/map-data/segment_scores.geojson`
      : null);

  if (!url) {
    return NextResponse.json(
      {
        error: "Static GeoJSON URL not configured",
        hint: "Run pipeline/scripts/upload_segment_scores_geojson.py and set NEXT_PUBLIC_SEGMENTS_GEOJSON_URL",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    deprecated: true,
    message:
      "Map loads static GeoJSON from Storage. Use NEXT_PUBLIC_SEGMENTS_GEOJSON_URL.",
    url,
  });
}
