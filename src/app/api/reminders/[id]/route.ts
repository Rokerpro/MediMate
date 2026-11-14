import { apiError, internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import { REMINDER_COLUMNS, firstRow, reminderUpdateToRow, rowToReminder } from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import {
  DEMO_PROFILE_ID,
  reminderIdSchema,
  reminderResponseSchema,
  reminderUpdateSchema,
} from "@/lib/validations";

const NOT_FOUND_MESSAGE = "This reminder was not found. It may have been deleted.";

/** The id path segment, validated so it is safe to put in the PostgREST filter. */
async function reminderId(ctx: RouteContext<"/api/reminders/[id]">): Promise<string | null> {
  const parsed = reminderIdSchema.safeParse((await ctx.params).id);
  return parsed.success ? parsed.data : null;
}

const filter = (id: string) => `reminders?id=eq.${id}&profile_id=eq.${DEMO_PROFILE_ID}&select=${REMINDER_COLUMNS}`;

/** PATCH /api/reminders/{id} — edit, pause/resume (active) or reschedule a reminder. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/reminders/[id]">): Promise<Response> {
  const id = await reminderId(ctx);
  if (id === null) return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = reminderUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rows = await supabaseRest(filter(id), {
      method: "PATCH",
      body: reminderUpdateToRow(parsed.data),
      returnRepresentation: true,
    });
    const row = firstRow(rows);
    if (row === undefined) return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);
    return Response.json(reminderResponseSchema.parse({ reminder: rowToReminder(row) }));
  } catch (error) {
    return internalError(error, "PATCH /api/reminders/{id}");
  }
}

/** DELETE /api/reminders/{id} — 204 on success, 404 if it does not exist. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/reminders/[id]">): Promise<Response> {
  const id = await reminderId(ctx);
  if (id === null) return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);

  try {
    const rows = await supabaseRest(filter(id), { method: "DELETE", returnRepresentation: true });
    if (firstRow(rows) === undefined) return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);
    return new Response(null, { status: 204 });
  } catch (error) {
    return internalError(error, "DELETE /api/reminders/{id}");
  }
}
