import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_COOKIE,
  NEXT_COOKIE,
  REFRESH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  VERIFIER_COOKIE,
  cookieOptions,
  parseTokenResponse,
  safeNextPath,
} from "@/lib/auth/session";
import { SupabaseRequestError, supabaseAuth, supabaseRest } from "@/lib/supabase/server";

/** Raised by claim_medimate_profile() when the sign-up cap is reached (migration 0003). */
const SIGNUPS_CLOSED_CODE = "MMCAP";

/**
 * GET /auth/callback?code=… — Google sends the user back here via Supabase.
 * Exchanges the code (PKCE), links or creates the user's profile, then sets
 * httpOnly session cookies. Cookies are only set once a profile exists.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const secure = process.env.NODE_ENV === "production";
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  const next = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
  const code = request.nextUrl.searchParams.get("code");

  const finish = (target: string) => {
    const response = NextResponse.redirect(new URL(target, request.url));
    const expired = cookieOptions(secure, 0);
    response.cookies.set(VERIFIER_COOKIE, "", expired);
    response.cookies.set(NEXT_COOKIE, "", expired);
    return response;
  };

  if (!code || !verifier || code.length > 512) return finish("/login?error=failed");

  try {
    const tokens = parseTokenResponse(
      await supabaseAuth("token?grant_type=pkce", { body: { auth_code: code, code_verifier: verifier } }),
    );
    if (!tokens) return finish("/login?error=failed");

    // Links the demo profile for the configured demo account, returns an
    // existing profile, or creates an empty one while sign-ups are open.
    await supabaseRest("rpc/claim_medimate_profile", {
      accessToken: tokens.accessToken,
      method: "POST",
      body: {},
    });

    const response = finish(next);
    const options = cookieOptions(secure, SESSION_MAX_AGE_SECONDS);
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, options);
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, options);
    return response;
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.code === SIGNUPS_CLOSED_CODE) {
      return finish("/login?error=closed");
    }
    console.error(`[auth] callback: ${error instanceof Error ? error.message : "unknown error"}`);
    return finish("/login?error=failed");
  }
}
