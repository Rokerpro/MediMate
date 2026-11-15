import { createHash, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { apiError, internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import { dispatchNotifications } from "@/lib/notifications/doses";
import { createEmailSender, createPushSender } from "@/lib/notifications/senders";
import { supabaseAnonRpc } from "@/lib/supabase/server";
import { dispatchRequestSchema } from "@/lib/validations";

const MIN_SECRET_LENGTH = 32;

function secretMatches(header: string | null): boolean {
  const secret = process.env.REMINDER_DISPATCH_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH || !header?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice("Bearer ".length).trim()), digest(secret));
}

/**
 * POST /api/notifications/dispatch — called every minute by the database job
 * (migration 0006) with the shared secret, never by the browser. Sends each due
 * medicine reminder by web push, or by email when no device is subscribed or
 * every push failed. Logs counts only, never addresses or reminder text.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!secretMatches(request.headers.get("authorization"))) {
    return apiError("UNAUTHENTICATED", "Not allowed.");
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = dispatchRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await dispatchNotifications(parsed.data, {
      sendPush: createPushSender(),
      sendEmail: createEmailSender(),
      origin: request.nextUrl.origin,
    });
    if (result.goneEndpoints.length > 0) {
      await supabaseAnonRpc("prune_push_subscriptions", {
        p_secret: process.env.REMINDER_DISPATCH_SECRET?.trim(),
        p_endpoints: result.goneEndpoints,
      }).catch(() => console.error("[notifications] could not prune expired devices"));
    }
    console.info(
      `[notifications] pushed=${result.pushed} emailed=${result.emailed} failed=${result.failed} pruned=${result.goneEndpoints.length}`,
    );
    return Response.json({ pushed: result.pushed, emailed: result.emailed, failed: result.failed });
  } catch (error) {
    return internalError(error, "POST /api/notifications/dispatch");
  }
}
