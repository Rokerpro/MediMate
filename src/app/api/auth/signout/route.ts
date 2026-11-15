import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/auth/session";
import { clearSessionCookies } from "@/lib/supabase/auth";
import { supabaseAuth } from "@/lib/supabase/server";

/** POST /api/auth/signout — ends the Supabase session (best effort) and clears the cookies. 204. */
export async function POST(): Promise<Response> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    try {
      await supabaseAuth("logout", { accessToken });
    } catch {
      // The cookies are cleared either way; an expired token cannot log out remotely.
    }
  }
  clearSessionCookies(store);
  return new Response(null, { status: 204 });
}
