import { authenticate } from "@/app/api/_lib/auth";
import { internalError } from "@/app/api/_lib/responses";
import { emailConfigured, vapidConfig } from "@/lib/notifications/senders";
import { supabaseRest } from "@/lib/supabase/server";
import { notificationConfigSchema } from "@/lib/validations";

/**
 * GET /api/notifications/config — what the browser needs to turn on medicine
 * reminder notifications (contract §3f). Only the VAPID *public* key is exposed.
 */
export async function GET(): Promise<Response> {
  const auth = await authenticate("GET /api/notifications/config");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  try {
    const rows = await supabaseRest(`push_subscriptions?select=id&profile_id=eq.${profileId}&limit=10`, { accessToken });
    const vapid = vapidConfig();
    return Response.json(
      notificationConfigSchema.parse({
        pushAvailable: vapid !== null,
        vapidPublicKey: vapid?.publicKey ?? null,
        emailAvailable: emailConfigured(),
        subscribedDevices: Array.isArray(rows) ? rows.length : 0,
      }),
    );
  } catch (error) {
    return internalError(error, "GET /api/notifications/config");
  }
}
