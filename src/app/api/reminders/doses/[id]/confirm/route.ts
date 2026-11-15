import { authenticate } from "@/app/api/_lib/auth";
import { apiError, internalError } from "@/app/api/_lib/responses";
import { DOSE_COLUMNS, rowToDose } from "@/lib/notifications/doses";
import { SupabaseRequestError, supabaseRest } from "@/lib/supabase/server";
import { doseIdSchema, doseResponseSchema } from "@/lib/validations";

const NOT_FOUND_MESSAGE = "This medicine reminder was not found.";
const WINDOW_CLOSED_MESSAGE = "This dose can no longer be confirmed: it was due more than an hour ago.";

/**
 * POST /api/reminders/doses/{id}/confirm — the user confirms they took this dose
 * (contract §3f). Stops further notifications. Allowed while pending or missed,
 * up to 1 hour after it was due; confirming twice is fine.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/reminders/doses/[id]/confirm">,
): Promise<Response> {
  const auth = await authenticate("POST /api/reminders/doses/{id}/confirm");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  const id = doseIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);

  try {
    await supabaseRest("rpc/confirm_reminder_dose", { accessToken, method: "POST", body: { p_dose_id: id.data } });
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.code === "P0002") return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);
    if (error instanceof SupabaseRequestError && error.code === "P0001") return apiError("CONFLICT", WINDOW_CLOSED_MESSAGE);
    return internalError(error, "POST /api/reminders/doses/{id}/confirm");
  }

  try {
    const rows = await supabaseRest(
      `reminder_doses?select=${DOSE_COLUMNS}&id=eq.${id.data}&profile_id=eq.${profileId}&limit=1`,
      { accessToken },
    );
    if (!Array.isArray(rows) || rows.length === 0) return apiError("NOT_FOUND", NOT_FOUND_MESSAGE);
    return Response.json(doseResponseSchema.parse({ dose: rowToDose(rows[0]) }));
  } catch (error) {
    return internalError(error, "POST /api/reminders/doses/{id}/confirm");
  }
}
