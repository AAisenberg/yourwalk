import { NextResponse } from "next/server";

type Body = {
  start?: { lng: number; lat: number } | [number, number];
  minutes?: number;
  mode?: string;
  prefs?: {
    accessibility?: number;
    shadeHeat?: number;
    afterDark?: number;
    preferSharedPaths?: boolean;
  };
  max_options?: number;
};

function point(
  v: { lng: number; lat: number } | [number, number] | undefined,
): { lng: number; lat: number } | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    if (v.length < 2) return null;
    return { lng: Number(v[0]), lat: Number(v[1]) };
  }
  if (typeof v.lng === "number" && typeof v.lat === "number") {
    return { lng: v.lng, lat: v.lat };
  }
  return null;
}

/**
 * Proxy to the challenger's Around-here loop planner (POST /loop).
 * Local default: http://127.0.0.1:8790. Production: CHALLENGER_URL (Fly).
 * Optional CHALLENGER_SHARED_SECRET is sent as Bearer when set.
 */
export const maxDuration = 30;

function challengerHeaders(): HeadersInit {
  const secret = process.env.CHALLENGER_SHARED_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const start = point(body.start);
  const minutes = Number(body.minutes);
  if (!start || !Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json(
      { error: "start {lng,lat} and minutes required" },
      { status: 400 },
    );
  }

  const mode = body.mode === "night" ? "night" : "day";
  const prefs =
    body.prefs && typeof body.prefs === "object" ? body.prefs : undefined;
  const base =
    process.env.CHALLENGER_URL?.trim() || "http://127.0.0.1:8790";

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/loop`, {
      method: "POST",
      headers: challengerHeaders(),
      body: JSON.stringify({
        start,
        minutes,
        mode,
        ...(prefs ? { prefs } : {}),
        ...(body.max_options ? { max_options: body.max_options } : {}),
      }),
      cache: "no-store",
    });
    const text = await res.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json(
        { error: "Challenger returned non-JSON", detail: text.slice(0, 200) },
        { status: 502 },
      );
    }
    return NextResponse.json(payload, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Challenger service unreachable",
        detail: message,
        hint: "From pipeline/: python bakeoff/serve_challenger.py --port 8790",
      },
      { status: 503 },
    );
  }
}
