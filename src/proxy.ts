import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, isProtectedPath } from "@/lib/auth/session";

/**
 * Sends signed-out visitors on app pages to /login. This is a convenience
 * redirect only: the real check is in every API route (401) and in Supabase
 * RLS, which verify the token itself. The landing page, /login, /auth/* and
 * static files stay public.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const hasSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/logs/:path*",
    "/profile/:path*",
    "/assistant/:path*",
    "/reminders/:path*",
    "/summary/:path*",
    "/prescriptions/:path*",
    "/welcome/:path*",
  ],
};
