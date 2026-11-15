// Pure helpers for the Google sign-in session (Supabase Auth, PKCE flow).
// No Next.js or server-only imports so node:test can exercise them directly.
//
// Security notes:
// - Tokens live only in httpOnly cookies; the browser JavaScript never sees them.
// - The JWT payload is decoded (not verified) only to read `sub`/`exp`/`email`
//   for routing decisions. Every data call sends the token to Supabase, which
//   verifies the signature and applies RLS, so a forged cookie gets no data.

export const ACCESS_COOKIE = "mm_access";
export const REFRESH_COOKIE = "mm_refresh";
export const VERIFIER_COOKIE = "mm_pkce";
export const NEXT_COOKIE = "mm_next";

/** Refresh the access token when it expires within this many seconds. */
export const REFRESH_SKEW_SECONDS = 60;
/** Session cookies last 30 days; the access token inside expires much sooner and is refreshed. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** The PKCE verifier only has to survive the round trip to Google. */
export const VERIFIER_MAX_AGE_SECONDS = 10 * 60;

export const DEFAULT_AFTER_LOGIN = "/dashboard";

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function cookieOptions(secure: boolean, maxAge: number): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 S256 challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** A fresh random verifier (43 base64url chars) and its S256 challenge. */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge: await pkceChallenge(verifier) };
}

export type JwtClaims = { sub: string; exp: number; email: string | null };

/** Reads the claims we route on. Returns null for anything that is not a well-formed JWT. */
export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload: unknown = JSON.parse(json);
    if (!payload || typeof payload !== "object") return null;
    const { sub, exp, email } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || !/^[0-9a-f-]{36}$/i.test(sub)) return null;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
    return { sub, exp, email: typeof email === "string" ? email : null };
  } catch {
    return null;
  }
}

/** True when the token is missing, malformed or expires within the skew window. */
export function needsRefresh(claims: JwtClaims | null, nowMs: number): boolean {
  return claims === null || claims.exp - REFRESH_SKEW_SECONDS <= Math.floor(nowMs / 1000);
}

/** Only same-site relative paths are allowed after login (no open redirects). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (next.startsWith("/auth/") || next === "/login" || next.startsWith("/login?")) return DEFAULT_AFTER_LOGIN;
  return next.slice(0, 200);
}

export type TokenSet = { accessToken: string; refreshToken: string };

/** Validates the token endpoint response shape without trusting anything else in it. */
export function parseTokenResponse(body: unknown): TokenSet | null {
  if (!body || typeof body !== "object") return null;
  const { access_token: accessToken, refresh_token: refreshToken } = body as Record<string, unknown>;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") return null;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/** Pages that need a signed-in user. Everything else (landing, login, auth, assets) is public. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/logs",
  "/profile",
  "/assistant",
  "/reminders",
  "/summary",
  "/prescriptions",
  "/welcome",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
