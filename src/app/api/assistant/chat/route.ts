import { authenticate } from "@/app/api/_lib/auth";
import { apiError, internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import { runAssistantTurn, type ChatTurnResult } from "@/lib/ai/assistant";
import { getLlmProvider } from "@/lib/ai/client";
import { RateLimitedError, checkAssistantRateLimit, clientKey, withRateLimit } from "@/lib/ai/rate-limit";
import { AiUnavailableError } from "@/lib/ai/types";
import { HISTORY_CANDIDATE_LIMIT, HISTORY_WINDOW_DAYS } from "@/lib/health/retrieve-history";
import { evaluateSafety } from "@/lib/health/safety-rules";
import {
  appendTurn,
  completeSession,
  createSession,
  getProfile,
  listRecentLogs,
  listRecentMessages,
  sessionExists,
} from "@/lib/supabase/assistant-store";
import { chatRequestSchema, chatResponseSchema } from "@/lib/validations";

/** Plain-text form of the assistant turn stored in symptom_messages. */
function storedAssistantText(turn: ChatTurnResult): string {
  if (turn.status === "follow_up") {
    return [turn.assistantMessage, ...turn.followUpQuestions.map((q) => `- ${q}`)].join("\n");
  }
  if (turn.status === "assessment" && turn.assessment) {
    return `${turn.assistantMessage}\n${turn.assessment.summary}`;
  }
  return turn.assistantMessage;
}

/**
 * POST /api/assistant/chat — one conversation turn.
 * Nothing is persisted until the turn succeeds, so a 503 can be retried with
 * the same request without leaving half-written sessions behind.
 */
export async function POST(request: Request): Promise<Response> {
  // Auth first: no database read, rate-limit slot or AI call for anonymous requests.
  const auth = await authenticate("POST /api/assistant/chat");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = chatRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);
  const { sessionId: requestedSessionId, message } = parsed.data;

  try {
    if (requestedSessionId !== null && !(await sessionExists(ctx, requestedSessionId))) {
      return apiError("NOT_FOUND", "This conversation was not found. Please start a new one.");
    }

    const [profile, candidateLogs, priorMessages] = await Promise.all([
      getProfile(ctx),
      listRecentLogs(ctx, HISTORY_WINDOW_DAYS, HISTORY_CANDIDATE_LIMIT),
      requestedSessionId ? listRecentMessages(ctx, requestedSessionId) : Promise.resolve([]),
    ]);
    if (!profile) return apiError("NOT_FOUND", "Your profile was not found.");

    const turn = await runAssistantTurn(
      { message, priorMessages, profile, candidateLogs },
      {
        provider: withRateLimit(getLlmProvider(), () => checkAssistantRateLimit(clientKey(request.headers))),
        evaluateSafety,
      },
    );

    const sessionId = requestedSessionId ?? (await createSession(ctx, message));
    await appendTurn(ctx, sessionId, message, storedAssistantText(turn));
    if (turn.status !== "follow_up") {
      await completeSession(ctx, sessionId, turn.assessment, turn.safety.level);
    }

    const { safetyRuleId, ...result } = turn;
    if (safetyRuleId) console.info(`[api] POST /api/assistant/chat: safety rule ${safetyRuleId} triggered`);
    return Response.json(chatResponseSchema.parse({ sessionId, ...result }));
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
      console.error(`[api] POST /api/assistant/chat: ${error.reason}`);
      return apiError(
        "AI_UNAVAILABLE",
        "The assistant is temporarily unavailable. Please try again in a moment.",
      );
    }
    return internalError(error, "POST /api/assistant/chat");
  }
}
