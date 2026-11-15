import { connection } from "next/server";

import { internalError } from "@/app/api/_lib/responses";
import { UnauthenticatedError, getRequestContext } from "@/lib/supabase/auth";
import { firstRow } from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import { currentUserResponseSchema } from "@/lib/validations";

/** GET /api/auth/me — `{ user: { email, displayName } }`, or `{ user: null }` when signed out. */
export async function GET(): Promise<Response> {
  await connection();
  try {
    const { profileId, accessToken, email } = await getRequestContext();
    const row = firstRow(
      await supabaseRest(`profiles?select=display_name&id=eq.${profileId}&limit=1`, { accessToken }),
    );
    const displayName =
      row && typeof row === "object" && "display_name" in row && typeof row.display_name === "string"
        ? row.display_name
        : "MediMate user";
    return Response.json(currentUserResponseSchema.parse({ user: { email, displayName } }));
  } catch (error) {
    if (error instanceof UnauthenticatedError) return Response.json({ user: null });
    return internalError(error, "GET /api/auth/me");
  }
}
