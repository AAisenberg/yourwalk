import { NextResponse, type NextRequest } from "next/server";

import { DASHBOARD_COOKIE, gateConfig, verifySessionToken } from "@/lib/dashboard/session";

/**
 * Host routing for the single Vercel project (ADR-012, docs/FRONT_DOOR.md):
 *
 *   yourwalk.au            → front door (rewrite / → /front-door)
 *   www.yourwalk.au        → redirect to yourwalk.au
 *   app.yourwalk.au        → today's planner (pass through; /front-door bounces
 *                            to the apex so planner and front door never mix;
 *                            /dashboard never serves here)
 *   dashboard.yourwalk.au  → Council insights behind a shared-password gate
 *                            (DB-1, docs/DASHBOARD.md). / rewrites to /dashboard.
 *
 * Vercel's own password protection covers whole deployments, which would also
 * lock the public front door and planner, hence the host-scoped gate here.
 *
 * Localhost and Vercel previews match none of these hosts and pass through,
 * so /front-door and /dashboard stay directly viewable for review (previews
 * are already behind Vercel login).
 */

const APEX = "yourwalk.au";
const WWW = "www.yourwalk.au";
const PLANNER = "app.yourwalk.au";
const DASHBOARD = "dashboard.yourwalk.au";
/** dashboard.localhost tests the host locally; gated only if the secrets are set. */
const DASHBOARD_LOCAL = "dashboard.localhost";

/** Paths the apex serves besides the front door itself. */
const APEX_ALLOWED_EXACT = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/manifest.webmanifest",
]);

const APEX_ALLOWED_PREFIXES = ["/front-door/", "/brand/"];

/** Dashboard host paths that never need a session. */
const DASHBOARD_PUBLIC_EXACT = new Set([
  "/dashboard/sign-in",
  "/api/dashboard-session",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/manifest.webmanifest",
]);
// Open map data, already public on the planner host; the gate protects the tool
const DASHBOARD_PUBLIC_PREFIXES = ["/brand/", "/api/map-data/", "/map-data/", "/overlays/"];

function noIndex(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

async function dashboardHost(request: NextRequest, host: string): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/robots.txt") {
    return noIndex(
      new NextResponse("User-agent: *\nDisallow: /\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }
  if (
    DASHBOARD_PUBLIC_EXACT.has(pathname) ||
    DASHBOARD_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return noIndex(NextResponse.next());
  }

  const config = gateConfig();
  const gated = host === DASHBOARD || config != null;
  if (gated) {
    const token = request.cookies.get(DASHBOARD_COOKIE)?.value;
    // Fails closed on the public host if the secrets are missing
    const ok = config != null && (await verifySessionToken(token, config.secret));
    if (!ok) {
      const url = new URL("/dashboard/sign-in", request.url);
      if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
      return noIndex(NextResponse.redirect(url, 307));
    }
  }

  if (pathname === "/") return noIndex(NextResponse.rewrite(new URL("/dashboard", request.url)));
  if (pathname === "/dashboard") return noIndex(NextResponse.redirect(new URL("/", request.url), 308));
  // Planner, lab and front door routes never serve on the dashboard host
  if (!pathname.startsWith("/api/")) return noIndex(NextResponse.redirect(new URL("/", request.url), 307));
  return noIndex(NextResponse.next());
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  if (host === DASHBOARD || host === DASHBOARD_LOCAL) {
    return dashboardHost(request, host);
  }

  if (host === WWW) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = APEX;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  if (host === APEX) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/front-door", request.url));
    }
    // One canonical URL for the page itself
    if (pathname === "/front-door") {
      return NextResponse.redirect(new URL(`https://${APEX}/`), 308);
    }
    if (
      APEX_ALLOWED_EXACT.has(pathname) ||
      APEX_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.next();
    }
    // Planner routes and anything unknown never serve on the apex host
    return NextResponse.redirect(new URL(`https://${APEX}/`), 307);
  }

  if (
    host === PLANNER &&
    (pathname === "/front-door" || pathname.startsWith("/front-door/"))
  ) {
    return NextResponse.redirect(new URL(`https://${APEX}/`), 308);
  }

  if (
    host === PLANNER &&
    (pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/api/dashboard-session")
  ) {
    return NextResponse.redirect(new URL(`https://${PLANNER}/`), 307);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals; everything else goes through host routing above
  matcher: ["/((?!_next/).*)"],
};
