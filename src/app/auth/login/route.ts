import { NextResponse, type NextRequest } from "next/server";

import {
  NEXT_COOKIE,
  VERIFIER_COOKIE,
  VERIFIER_MAX_AGE_SECONDS,
  cookieOptions,
  createPkcePair,
  safeNextPath,
} from "@/lib/auth/session";
import { SupabaseConfigError, supabaseAuthUrl } from "@/lib/supabase/server";

/**
 * GET /auth/login?next=/logs — starts "Continue with Google" (Supabase Auth,
 * PKCE). The verifier stays in an httpOnly cookie; only its hash goes to Google.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const secure = process.env.NODE_ENV === "production";
  const { verifier, challenge } = await createPkcePair();

  let authorizeUrl: URL;
  try {
    authorizeUrl = new URL(supabaseAuthUrl("authorize"));
  } catch (error) {
    if (error instanceof SupabaseConfigError) console.error("[auth] login: supabase env vars missing");
    return NextResponse.redirect(new URL("/login?error=failed", request.url));
  }
  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", new URL("/auth/callback", request.nextUrl.origin).toString());
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "s256");

  const response = NextResponse.redirect(authorizeUrl);
  const options = cookieOptions(secure, VERIFIER_MAX_AGE_SECONDS);
  response.cookies.set(VERIFIER_COOKIE, verifier, options);
  response.cookies.set(NEXT_COOKIE, safeNextPath(request.nextUrl.searchParams.get("next")), options);
  return response;
}
