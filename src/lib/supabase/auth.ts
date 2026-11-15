import "server-only";

// Request context for signed-in users. Reads the httpOnly session cookies,
// refreshes the access token when it is about to expire, and finds the user's
// own profile. The profile id always comes from the database (filtered by the
// verified token and RLS), never from the client.
import { cookies } from "next/headers";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  cookieOptions,
  decodeJwtClaims,
  needsRefresh,
  parseTokenResponse,
  type TokenSet,
} from "@/lib/auth/session";

import { firstRow } from "./mappers";
import { SupabaseRequestError, supabaseAuth, supabaseRest } from "./server";

export type RequestContext = {
  profileId: string;
  accessToken: string;
  email: string | null;
  /** Google profile photo (https, Google's photo host only), or null. */
  avatarUrl: string | null;
};

/** No usable session. Route handlers turn this into a 401. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "UnauthenticatedError";
  }
}

const secureCookies = () => process.env.NODE_ENV === "production";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function writeSessionCookies(store: Pick<CookieStore, "set">, tokens: TokenSet): void {
  const options = cookieOptions(secureCookies(), SESSION_MAX_AGE_SECONDS);
  store.set(ACCESS_COOKIE, tokens.accessToken, options);
  store.set(REFRESH_COOKIE, tokens.refreshToken, options);
}

export function clearSessionCookies(store: Pick<CookieStore, "set">): void {
  const options = cookieOptions(secureCookies(), 0);
  store.set(ACCESS_COOKIE, "", options);
  store.set(REFRESH_COOKIE, "", options);
}

/** Exchanges a refresh token for a new token pair. Null if Supabase rejects it. */
export async function refreshTokens(refreshToken: string): Promise<TokenSet | null> {
  try {
    return parseTokenResponse(
      await supabaseAuth("token?grant_type=refresh_token", { body: { refresh_token: refreshToken } }),
    );
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status >= 400 && error.status < 500) return null;
    throw error;
  }
}

/** The signed-in user's profile id, looked up with their own token (RLS applies). */
async function findProfileId(accessToken: string, userId: string): Promise<string | null> {
  const row = firstRow(
    await supabaseRest(`profiles?select=id&user_id=eq.${userId}&limit=1`, { accessToken }),
  );
  if (!row || typeof row !== "object" || !("id" in row) || typeof row.id !== "string") return null;
  return row.id;
}

/**
 * Resolves the current user from cookies. Throws UnauthenticatedError when
 * there is no session, the refresh fails, or the user has no profile.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value ?? "";
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? "";
  if (!accessToken && !refreshToken) throw new UnauthenticatedError();

  let claims = accessToken ? decodeJwtClaims(accessToken) : null;
  if (needsRefresh(claims, Date.now())) {
    const refreshed = refreshToken ? await refreshTokens(refreshToken) : null;
    claims = refreshed ? decodeJwtClaims(refreshed.accessToken) : null;
    if (!refreshed || !claims) {
      clearSessionCookies(store);
      throw new UnauthenticatedError();
    }
    writeSessionCookies(store, refreshed);
    accessToken = refreshed.accessToken;
  }
  if (!claims) throw new UnauthenticatedError();

  let profileId: string | null;
  try {
    profileId = await findProfileId(accessToken, claims.sub);
  } catch (error) {
    // Supabase rejected the token (revoked, signed out elsewhere): treat as signed out.
    if (error instanceof SupabaseRequestError && (error.status === 401 || error.status === 403)) {
      clearSessionCookies(store);
      throw new UnauthenticatedError();
    }
    throw error;
  }
  if (!profileId) {
    clearSessionCookies(store);
    throw new UnauthenticatedError();
  }
  return { profileId, accessToken, email: claims.email, avatarUrl: claims.avatarUrl };
}
