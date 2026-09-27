import { NextResponse } from "next/server";

import {
  DASHBOARD_COOKIE,
  SESSION_MAX_AGE_S,
  createSessionToken,
  gateConfig,
  passwordMatches,
} from "@/lib/dashboard/session";

/** Sign in to Council insights with the shared pilot password. */
export async function POST(req: Request) {
  const config = gateConfig();
  if (!config) {
    return NextResponse.json({ error: "Sign-in is not set up yet." }, { status: 503 });
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!(await passwordMatches(password, config.password))) {
    // Slow repeated guesses a little; this is a shared pilot password, not accounts
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "That password did not work." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: DASHBOARD_COOKIE,
    value: await createSessionToken(config.secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}

/** Sign out: clear the session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: DASHBOARD_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
