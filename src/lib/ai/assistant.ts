// One assistant turn, in the order required by AI_SAFETY_SPEC.md §2.
// No I/O except through injected dependencies, so it is fully unit-testable.
import type { ChatResponse, HealthLog, Profile } from "@/lib/validations";

import { selectReferences, type CuratedReference } from "../health/references.ts";
import { extractTerms, selectRecentMeasurementLogs, selectRelevantLogs } from "../health/retrieve-history.ts";
import { PROMPT_ASSISTANT_NOTE, PROMPT_NEXT_STEP, type SafetyEvaluation } from "../health/safety-rules.ts";
import { parseModelOutput, toContractAssessment } from "./output.ts";
import { SYSTEM_PROMPT, buildRepairInstruction, buildUserContent } from "./prompts.ts";
import { AiUnavailableError, type ChatMessage, type LlmProvider, type ModelContext } from "./types.ts";

/**
 * After this many earlier user messages, the model must return an assessment.
 * One round of up to 3 questions keeps the demo within the spec's target of
 * about 3–4 questions before a preliminary summary (AI_SAFETY_SPEC.md §4).
 */
export const MAX_FOLLOW_UP_ROUNDS = 1;

export type ChatTurnInput = {
  message: string;
  /** Bounded recent messages of this session, oldest first. */
  priorMessages: readonly ChatMessage[];
  profile: Profile;
  /** Recent logs in the history window; relevance filtering happens here. */
  candidateLogs: readonly HealthLog[];
  /** Clock for the recent-measurements window (tests pass a fixed value). */
  now?: number;
};

export type ChatTurnDeps = {
  provider: LlmProvider;
  evaluateSafety: (userTexts: readonly string[]) => SafetyEvaluation;
  references?: readonly CuratedReference[];
};

/** Chat reply for an urgent result. No reassurance and no medical content of its own. */
export const URGENT_ASSISTANT_MESSAGE =
  "I can't continue with an educational summary here. Please read the urgent safety guidance and get help now.";

export type ChatTurnResult = Omit<ChatResponse, "sessionId"> & { safetyRuleId: string | null };

export async function runAssistantTurn(input: ChatTurnInput, deps: ChatTurnDeps): Promise<ChatTurnResult> {
  const priorUserTexts = input.priorMessages.filter((m) => m.role === "user").map((m) => m.content);

  // Deterministic safety first. A triggered rule returns immediately; the LLM is never called.
  const safety = deps.evaluateSafety([input.message, ...priorUserTexts]);
  if (safety.result.level === "urgent" && safety.result.triggered && safety.result.message) {
    return {
      status: "urgent",
      // Fixed short reply; the reviewed safety wording is shown once, from safety.message.
      assistantMessage: URGENT_ASSISTANT_MESSAGE,
      followUpQuestions: [],
      safety: safety.result,
      assessment: null,
      safetyRuleId: safety.ruleId,
    };
  }

  const queryText = [input.message, ...priorUserTexts].join("\n");
  const relevantLogs = selectRelevantLogs(input.candidateLogs, queryText);
  const recentMeasurementLogs = selectRecentMeasurementLogs(
    input.candidateLogs,
    new Set(relevantLogs.map((log) => log.id)),
    input.now,
  );
  const references = selectReferences(extractTerms(queryText), deps.references);
  const mustAssess = priorUserTexts.length >= MAX_FOLLOW_UP_ROUNDS;
  const hasReferences = references.length > 0;

  const context: ModelContext = {
    currentMessage: input.message,
    priorMessages: input.priorMessages,
    priorUserMessageCount: priorUserTexts.length,
    profile: input.profile,
    relevantLogs,
    recentMeasurementLogs,
    references,
    mustAssess,
    isRepair: false,
    promptSign: safety.result.level === "prompt" ? (safety.sign ?? "an NHS urgent-GP / 111 warning sign") : null,
  };
  const user = buildUserContent(context);

  let parsed = parseModelOutput(
    await deps.provider.complete({ system: SYSTEM_PROMPT, user, context }),
    { mustAssess, hasReferences },
  );
  if (!parsed.ok) {
    // One constrained repair attempt; malformed output is never shown.
    parsed = parseModelOutput(
      await deps.provider.complete({
        system: SYSTEM_PROMPT,
        user: user + buildRepairInstruction(parsed.problems, parsed.quotes),
        context: { ...context, isRepair: true },
      }),
      { mustAssess, hasReferences },
    );
    // Problems are schema paths and rule labels only — no health content.
    if (!parsed.ok) throw new AiUnavailableError(`invalid model output after repair (${parsed.problems.join("; ")})`);
  }

  const { output } = parsed;
  const assessment =
    output.status === "assessment" && output.assessment
      ? toContractAssessment(output.assessment, relevantLogs, references, recentMeasurementLogs, queryText)
      : null;
  // Prompt level (NHS "urgent GP / 111" item): the model still answers, but the
  // fixed advice is added by the server so it never depends on the model.
  const isPrompt = safety.result.level === "prompt" && safety.result.triggered;
  return {
    status: output.status,
    assistantMessage: isPrompt ? `${output.assistantMessage} ${PROMPT_ASSISTANT_NOTE}` : output.assistantMessage,
    followUpQuestions: output.status === "follow_up" ? output.followUpQuestions : [],
    safety: safety.result,
    assessment:
      assessment && isPrompt ? { ...assessment, nextSteps: [PROMPT_NEXT_STEP, ...assessment.nextSteps] } : assessment,
    safetyRuleId: isPrompt ? safety.ruleId : null,
  };
}
