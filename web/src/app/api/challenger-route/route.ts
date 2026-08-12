import { NextResponse } from "next/server";

type Body = {
  origin?: { lng: number; lat: number } | [number, number];
  destination?: { lng: number; lat: number } | [number, number];
  mode?: string;
  prefs?: {
    accessibility?: number;
    shadeHeat?: number;
    afterDark?: number;
  };
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
 * Proxy to local score-aware challenger (pipeline/bakeoff/serve_challenger.py).
 * Default: http://127.0.0.1:8790 — override with CHALLENGER_URL.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const origin = point(body.origin);
  const destination = point(body.destination);
  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin and destination required as {lng,lat}" },
      { status: 400 },
    );
  }

  const mode = body.mode === "night" ? "night" : "day";
  const prefs =
    body.prefs && typeof body.prefs === "object" ? body.prefs : undefined;
  const base =
    process.env.CHALLENGER_URL?.trim() || "http://127.0.0.1:8790";

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        mode,
        ...(prefs ? { prefs } : {}),
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

export async function GET() {
  const base =
    process.env.CHALLENGER_URL?.trim() || "http://127.0.0.1:8790";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, {
      cache: "no-store",
    });
    const payload = await res.json();
    return NextResponse.json(payload, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        hint: "Start: python bakeoff/serve_challenger.py --port 8790",
      },
      { status: 503 },
    );
  }
}
