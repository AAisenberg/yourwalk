import { NextResponse, type NextRequest } from "next/server";

/**
 * Host routing for the single Vercel project (ADR-012, docs/FRONT_DOOR.md):
 *
 *   yourwalk.au       → front door (rewrite / → /front-door)
 *   www.yourwalk.au   → redirect to yourwalk.au
 *   app.yourwalk.au   → today's planner (pass through; /front-door bounces
 *                       to the apex so planner and front door never mix)
 *
 * Localhost and Vercel previews match none of these hosts and pass through,
 * so /front-door stays directly viewable for review.
 */

const APEX = "yourwalk.au";
const WWW = "www.yourwalk.au";
const PLANNER = "app.yourwalk.au";

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

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  // Skip Next internals; everything else goes through host routing above
  matcher: ["/((?!_next/).*)"],
};
