import type { NextRequest } from "next/server";

import { authenticate } from "@/app/api/_lib/auth";
import { internalError, validationError } from "@/app/api/_lib/responses";
import { computeAnalytics } from "@/lib/health/analytics";
import { listRecentLogs } from "@/lib/supabase/assistant-store";
import { analyticsQuerySchema, analyticsResponseSchema } from "@/lib/validations";

/** Enough rows for 30 days with several logs per day. */
const MAX_ANALYTICS_LOGS = 200;

/**
 * GET /api/insights/analytics?days=30 — deterministic figures from the signed-in
 * user's own logs (contract §3e): symptom frequency, recorded pain, change over
 * time, recurrence and measures recorded on the same days. No AI is involved.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticate("GET /api/insights/analytics");
  if (!auth.ok) return auth.response;

  const query = analyticsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return validationError(query.error);
  const days = query.data.days as 7 | 14 | 30;

  try {
    const logs = await listRecentLogs(auth.ctx, days + 1, MAX_ANALYTICS_LOGS);
    return Response.json(analyticsResponseSchema.parse(computeAnalytics(logs, days)));
  } catch (error) {
    return internalError(error, "GET /api/insights/analytics");
  }
}
