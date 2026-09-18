import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  isAnalyticsEventName,
  isAnalyticsSessionId,
  sanitizeProperties,
} from "@/lib/analytics/events";

export const runtime = "nodejs";

type Body = {
  session_id?: unknown;
  event_name?: unknown;
  properties?: unknown;
};

/**
 * Accepts allowlisted anonymous planner events. Drops coordinates, addresses,
 * and unknown keys. Insert-only; the Data API cannot read this table as anon.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = serviceKey || anonKey;
  if (!url || !key) {
    return NextResponse.json({ ok: true, skipped: "unconfigured" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId =
    typeof body.session_id === "string" ? body.session_id.trim() : "";
  const eventName =
    typeof body.event_name === "string" ? body.event_name.trim() : "";

  if (!isAnalyticsSessionId(sessionId) || !isAnalyticsEventName(eventName)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const rawProps =
    body.properties &&
    typeof body.properties === "object" &&
    !Array.isArray(body.properties)
      ? (body.properties as Record<string, unknown>)
      : {};
  const properties = sanitizeProperties(rawProps);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("analytics_events").insert({
    session_id: sessionId,
    event_name: eventName,
    properties,
  });

  if (error) {
    return NextResponse.json(
      {
        error: "Insert failed",
        hint: "Apply supabase/migrations/20260917000000_analytics_events.sql",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
