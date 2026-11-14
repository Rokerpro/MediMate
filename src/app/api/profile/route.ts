import { connection } from "next/server";

import { apiError, internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import {
  PROFILE_COLUMNS,
  firstRow,
  profileUpdateToRow,
  rowToProfile,
} from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import { DEMO_PROFILE_ID, profileResponseSchema, profileUpdateSchema } from "@/lib/validations";

// The profile ID always comes from the server, never from the client.
const DEMO_PROFILE_FILTER = `id=eq.${DEMO_PROFILE_ID}`;

/** GET /api/profile — the seeded synthetic demo profile. */
export async function GET(): Promise<Response> {
  await connection(); // Always run at request time; never prerender database data.
  try {
    const rows = await supabaseRest(`profiles?select=${PROFILE_COLUMNS}&${DEMO_PROFILE_FILTER}&limit=1`);
    const row = firstRow(rows);
    if (row === undefined) return apiError("NOT_FOUND", "The demo profile was not found.");
    return Response.json(profileResponseSchema.parse({ profile: rowToProfile(row) }));
  } catch (error) {
    return internalError(error, "GET /api/profile");
  }
}

/** PATCH /api/profile — update any subset of the editable fields. */
export async function PATCH(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = profileUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rows = await supabaseRest(`profiles?${DEMO_PROFILE_FILTER}&select=${PROFILE_COLUMNS}`, {
      method: "PATCH",
      body: profileUpdateToRow(parsed.data),
      returnRepresentation: true,
    });
    const row = firstRow(rows);
    if (row === undefined) return apiError("NOT_FOUND", "The demo profile was not found.");
    return Response.json(profileResponseSchema.parse({ profile: rowToProfile(row) }));
  } catch (error) {
    return internalError(error, "PATCH /api/profile");
  }
}
