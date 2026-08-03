import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { toDisplayScore } from "@/lib/routing/geo";
import type { RouteScore } from "@/lib/routing/types";

type Body = {
  geometry: GeoJSON.LineString;
  buffer_m?: number;
};

/**
 * PostGIS length-weighted route scoring via score_route_corridor RPC.
 * Apply migration first:
 *   python scripts/apply_migration_sql.py ../supabase/migrations/20260716000000_score_route_corridor.sql
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase env not configured" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.geometry || body.geometry.type !== "LineString") {
    return NextResponse.json(
      { error: "geometry must be a GeoJSON LineString" },
      { status: 400 },
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("score_route_corridor", {
    route_geojson: body.geometry,
    buffer_m: body.buffer_m ?? 20,
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: "Apply supabase/migrations/20260716000000_score_route_corridor.sql",
      },
      { status: 503 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({ error: "Empty score result" }, { status: 502 });
  }

  const score: RouteScore = {
    day_index_score: row.day_index_score ?? null,
    night_index_score: row.night_index_score ?? null,
    accessibility_score: row.accessibility_score ?? null,
    day_display: toDisplayScore(row.day_index_score),
    night_display: toDisplayScore(row.night_index_score),
    accessibility_display: toDisplayScore(row.accessibility_score),
    confidence_day: row.confidence_day ?? "reduced",
    confidence_night: row.confidence_night ?? "reduced",
    segment_count: Number(row.segment_count ?? 0),
    matched_length_m: Number(row.matched_length_m ?? 0),
    coverage_ratio: Number(row.coverage_ratio ?? 0),
    shared_use_ratio: Number(row.shared_use_ratio ?? 0),
    source: "postgis",
  };

  return NextResponse.json({ score });
}
