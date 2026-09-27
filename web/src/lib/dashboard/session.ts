/**
 * Council insights shared-password session (DB-1, Phases 1–2 of the rollout
 * in docs/DASHBOARD.md). No accounts and no personal data: a signed expiry
 * in an httpOnly cookie. Rotate DASHBOARD_PASSWORD and DASHBOARD_SESSION_SECRET
 * in Vercel to revoke everyone.
 */

export const DASHBOARD_COOKIE = "yw_dash";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Constant-time string compare (lengths may differ). */
function sameString(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_MAX_AGE_S * 1000);
  return `${exp}.${await sign(secret, `yw-dashboard:${exp}`)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < now) return false;
  return sameString(token.slice(dot + 1), await sign(secret, `yw-dashboard:${exp}`));
}

/** Compare hashes so timing does not leak the password length or prefix. */
export async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(given)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return sameString(toBase64Url(a), toBase64Url(b));
}

export type GateConfig = { password: string; secret: string } | null;

/** Both server-only secrets, or null (gate fails closed on public hosts). */
export function gateConfig(): GateConfig {
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  const secret = process.env.DASHBOARD_SESSION_SECRET?.trim();
  return password && secret ? { password, secret } : null;
}
