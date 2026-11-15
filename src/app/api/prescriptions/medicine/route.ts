import { authenticate } from "@/app/api/_lib/auth";
import { apiError, internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import { getLlmProvider } from "@/lib/ai/client";
import { runMedicineExplainer } from "@/lib/ai/medicine-explainer";
import { RateLimitedError, checkAssistantRateLimit, clientKey, withRateLimit } from "@/lib/ai/rate-limit";
import { AiUnavailableError } from "@/lib/ai/types";
import { evaluateSafety } from "@/lib/health/safety-rules";
import { medicineExplainRequestSchema, medicineExplainResponseSchema } from "@/lib/validations";

/**
 * POST /api/prescriptions/medicine — general, educational information about a
 * medicine the user names or describes (contract §3b2). Signed-in users only,
 * shares the assistant rate limit. The text is not stored or logged.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate("POST /api/prescriptions/medicine");
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = medicineExplainRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await runMedicineExplainer(parsed.data.query, {
      provider: withRateLimit(getLlmProvider(), () => checkAssistantRateLimit(clientKey(request.headers))),
      evaluateSafety,
    });
    const { safetyRuleId, ...response } = result;
    if (safetyRuleId) console.info(`[api] POST /api/prescriptions/medicine: safety rule ${safetyRuleId} triggered`);
    return Response.json(medicineExplainResponseSchema.parse(response));
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
      console.error(`[api] POST /api/prescriptions/medicine: ${error.reason}`);
      return apiError("AI_UNAVAILABLE", "The medicine explainer is temporarily unavailable. Please try again in a moment.");
    }
    return internalError(error, "POST /api/prescriptions/medicine");
  }
}
