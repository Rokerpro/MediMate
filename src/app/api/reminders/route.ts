import type { NextRequest } from "next/server";

import { internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import {
  REMINDER_COLUMNS,
  firstRow,
  reminderCreateToRow,
  rowToReminder,
  sortReminders,
} from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import {
  DEMO_PROFILE_ID,
  reminderCreateSchema,
  reminderListQuerySchema,
  reminderListResponseSchema,
  reminderResponseSchema,
} from "@/lib/validations";

const MAX_REMINDERS = 100;

/** GET /api/reminders?includeInactive=false — the demo profile's reminders, next due first. */
export async function GET(request: NextRequest): Promise<Response> {
  const query = reminderListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return validationError(query.error);

  try {
    const rows = await supabaseRest(
      `reminders?select=${REMINDER_COLUMNS}` +
        `&profile_id=eq.${DEMO_PROFILE_ID}` +
        (query.data.includeInactive ? "" : "&active=is.true") +
        `&order=remind_at.asc&limit=${MAX_REMINDERS}`,
    );
    if (!Array.isArray(rows)) throw new Error("Unexpected reminders response shape");
    const now = Date.now();
    const reminders = sortReminders(rows.map((row) => rowToReminder(row, now)));
    return Response.json(reminderListResponseSchema.parse({ reminders }));
  } catch (error) {
    return internalError(error, "GET /api/reminders");
  }
}

/** POST /api/reminders — save a reminder the user has confirmed. Returns 201. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = reminderCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rows = await supabaseRest(`reminders?select=${REMINDER_COLUMNS}`, {
      method: "POST",
      body: reminderCreateToRow(parsed.data, DEMO_PROFILE_ID),
      returnRepresentation: true,
    });
    const row = firstRow(rows);
    if (row === undefined) throw new Error("Insert returned no row");
    return Response.json(reminderResponseSchema.parse({ reminder: rowToReminder(row) }), { status: 201 });
  } catch (error) {
    return internalError(error, "POST /api/reminders");
  }
}
