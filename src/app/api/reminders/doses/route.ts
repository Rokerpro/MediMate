import type { NextRequest } from "next/server";

import { authenticate } from "@/app/api/_lib/auth";
import { internalError, validationError } from "@/app/api/_lib/responses";
import { DOSE_COLUMNS, rowToDose } from "@/lib/notifications/doses";
import { supabaseRest } from "@/lib/supabase/server";
import { doseListQuerySchema, doseListResponseSchema } from "@/lib/validations";

const MAX_DOSES = 50;

/** GET /api/reminders/doses?hours=24 — the signed-in user's recent medicine doses, newest first (contract §3f). */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticate("GET /api/reminders/doses");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  const query = doseListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return validationError(query.error);

  try {
    const since = new Date(Date.now() - query.data.hours * 60 * 60 * 1000).toISOString();
    const rows = await supabaseRest(
      `reminder_doses?select=${DOSE_COLUMNS}&profile_id=eq.${profileId}` +
        `&due_at=gte.${encodeURIComponent(since)}&order=due_at.desc&limit=${MAX_DOSES}`,
      { accessToken },
    );
    if (!Array.isArray(rows)) throw new Error("Unexpected reminder_doses response shape");
    const now = Date.now();
    return Response.json(doseListResponseSchema.parse({ doses: rows.map((row) => rowToDose(row, now)) }));
  } catch (error) {
    return internalError(error, "GET /api/reminders/doses");
  }
}
