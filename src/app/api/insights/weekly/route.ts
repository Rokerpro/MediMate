import { authenticate } from "@/app/api/_lib/auth";
import { apiError, internalError } from "@/app/api/_lib/responses";
import { getLlmProvider } from "@/lib/ai/client";
import { RateLimitedError, checkAssistantRateLimit, clientKey, withRateLimit } from "@/lib/ai/rate-limit";
import { AiUnavailableError } from "@/lib/ai/types";
import { MAX_WEEKLY_LOGS, WEEKLY_DAYS, runWeeklySummary } from "@/lib/ai/weekly-summary";
import { evaluateSafety } from "@/lib/health/safety-rules";
import { getProfile, listRecentLogs } from "@/lib/supabase/assistant-store";
import { weeklySummaryResponseSchema } from "@/lib/validations";

/**
 * POST /api/insights/weekly — on-demand educational summary of the signed-in
 * user's logs from the last 7 days. No request body; nothing is stored.
 * Same safety order and output checks as the chat (contract §3d).
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate("POST /api/insights/weekly");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  try {
    const [profile, logs] = await Promise.all([
      getProfile(ctx),
      listRecentLogs(ctx, WEEKLY_DAYS, MAX_WEEKLY_LOGS),
    ]);
    if (!profile) return apiError("NOT_FOUND", "Your profile was not found.");

    const result = await runWeeklySummary(
      { logs, profile },
      {
        provider: withRateLimit(getLlmProvider(), () => checkAssistantRateLimit(clientKey(request.headers))),
        evaluateSafety,
      },
    );

    const { safetyRuleId, ...response } = result;
    if (safetyRuleId) console.info(`[api] POST /api/insights/weekly: safety rule ${safetyRuleId} triggered`);
    return Response.json(weeklySummaryResponseSchema.parse(response));
  } catch (error) {
    if (error instanceof RateLimitedError) {
      const response = apiError(
        "RATE_LIMITED",
        `Too many assistant requests right now. Please wait about ${error.retryAfterSeconds} seconds and try again.`,
      );
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof AiUnavailableError) {
      console.error(`[api] POST /api/insights/weekly: ${error.reason}`);
      return apiError("AI_UNAVAILABLE", "The weekly summary is temporarily unavailable. Please try again in a moment.");
    }
    return internalError(error, "POST /api/insights/weekly");
  }
}
