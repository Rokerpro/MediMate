import { authenticate } from "@/app/api/_lib/auth";
import { internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import { supabaseRest } from "@/lib/supabase/server";
import { pushSubscriptionResultSchema, pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validations";

/** POST /api/notifications/subscriptions — save this browser's push subscription (contract §3f). */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate("POST /api/notifications/subscriptions");
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = pushSubscriptionSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await supabaseRest("rpc/save_push_subscription", {
      accessToken: auth.ctx.accessToken,
      method: "POST",
      body: { p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.keys.p256dh, p_auth: parsed.data.keys.auth },
    });
    return Response.json(pushSubscriptionResultSchema.parse({ subscribed: true }), { status: 201 });
  } catch (error) {
    return internalError(error, "POST /api/notifications/subscriptions");
  }
}

/** DELETE /api/notifications/subscriptions — forget this browser's subscription (200 even if unknown). */
export async function DELETE(request: Request): Promise<Response> {
  const auth = await authenticate("DELETE /api/notifications/subscriptions");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = pushUnsubscribeSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await supabaseRest(
      `push_subscriptions?profile_id=eq.${profileId}&endpoint=eq.${encodeURIComponent(parsed.data.endpoint)}`,
      { accessToken, method: "DELETE" },
    );
    return Response.json(pushSubscriptionResultSchema.parse({ subscribed: false }));
  } catch (error) {
    return internalError(error, "DELETE /api/notifications/subscriptions");
  }
}
