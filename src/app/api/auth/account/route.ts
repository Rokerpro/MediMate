import { cookies } from "next/headers";

import { authenticate } from "@/app/api/_lib/auth";
import { internalError } from "@/app/api/_lib/responses";
import { clearSessionCookies } from "@/lib/supabase/auth";
import { supabaseRest } from "@/lib/supabase/server";

/**
 * DELETE /api/auth/account — permanently deletes the signed-in user's account:
 * their profile, logs, chats and reminders, and their sign-in. The shared demo
 * profile is only unlinked, never deleted. 204 and the session cookies cleared.
 */
export async function DELETE(): Promise<Response> {
  const auth = await authenticate("DELETE /api/auth/account");
  if (!auth.ok) return auth.response;
  try {
    await supabaseRest("rpc/delete_medimate_account", {
      accessToken: auth.ctx.accessToken,
      method: "POST",
      body: {},
    });
  } catch (error) {
    return internalError(error, "DELETE /api/auth/account");
  }
  clearSessionCookies(await cookies());
  return new Response(null, { status: 204 });
}
