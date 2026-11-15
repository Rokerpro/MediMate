import { connection } from "next/server";

import { authenticate } from "@/app/api/_lib/auth";
import { apiError, internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import {
  PROFILE_COLUMNS,
  firstRow,
  profileUpdateToRow,
  rowToProfile,
} from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import { profileResponseSchema, profileUpdateSchema } from "@/lib/validations";

// The profile ID always comes from the signed-in user's session, never from the client.
const profileFilter = (profileId: string) => `id=eq.${profileId}`;

/** GET /api/profile — the signed-in user's profile. */
export async function GET(): Promise<Response> {
  await connection(); // Always run at request time; never prerender database data.
  const auth = await authenticate("GET /api/profile");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;
  try {
    const rows = await supabaseRest(`profiles?select=${PROFILE_COLUMNS}&${profileFilter(profileId)}&limit=1`, {
      accessToken,
    });
    const row = firstRow(rows);
    if (row === undefined) return apiError("NOT_FOUND", "Your profile was not found.");
    return Response.json(profileResponseSchema.parse({ profile: rowToProfile(row) }));
  } catch (error) {
    return internalError(error, "GET /api/profile");
  }
}

/** PATCH /api/profile — update any subset of the editable fields. */
export async function PATCH(request: Request): Promise<Response> {
  const auth = await authenticate("PATCH /api/profile");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = profileUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rows = await supabaseRest(`profiles?${profileFilter(profileId)}&select=${PROFILE_COLUMNS}`, {
      accessToken,
      method: "PATCH",
      body: profileUpdateToRow(parsed.data),
      returnRepresentation: true,
    });
    const row = firstRow(rows);
    if (row === undefined) return apiError("NOT_FOUND", "Your profile was not found.");
    return Response.json(profileResponseSchema.parse({ profile: rowToProfile(row) }));
  } catch (error) {
    return internalError(error, "PATCH /api/profile");
  }
}
