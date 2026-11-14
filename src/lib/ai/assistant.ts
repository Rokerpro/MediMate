// One assistant turn, in the order required by AI_SAFETY_SPEC.md §2.
// No I/O except through injected dependencies, so it is fully unit-testable.
import type { ChatResponse, HealthLog, Profile } from "@/lib/validations";

import { selectReferences, type CuratedReference } from "../health/references.ts";
import { extractTerms, selectRelevantLogs } from "../health/retrieve-history.ts";
import type { SafetyEvaluation } from "../health/safety-rules.ts";
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
};

export type ChatTurnDeps = {
  provider: LlmProvider;
  evaluateSafety: (userTexts: readonly string[]) => SafetyEvaluation;
  references?: readonly CuratedReference[];
};

export type ChatTurnResult = Omit<ChatResponse, "sessionId"> & { safetyRuleId: string | null };

export async function runAssistantTurn(input: ChatTurnInput, deps: ChatTurnDeps): Promise<ChatTurnResult> {
  const priorUserTexts = input.priorMessages.filter((m) => m.role === "user").map((m) => m.content);

  // Deterministic safety first. A triggered rule returns immediately; the LLM is never called.
  const safety = deps.evaluateSafety([input.message, ...priorUserTexts]);
  if (safety.result.triggered && safety.result.message) {
    return {
      status: "urgent",
      assistantMessage: safety.result.message,
      followUpQuestions: [],
      safety: safety.result,
      assessment: null,
      safetyRuleId: safety.ruleId,
    };
  }

  const queryText = [input.message, ...priorUserTexts].join("\n");
  const relevantLogs = selectRelevantLogs(input.candidateLogs, queryText);
  const references = selectReferences(extractTerms(queryText), deps.references);
  const mustAssess = priorUserTexts.length >= MAX_FOLLOW_UP_ROUNDS;
  const hasReferences = references.length > 0;

  const context: ModelContext = {
    currentMessage: input.message,
    priorMessages: input.priorMessages,
    priorUserMessageCount: priorUserTexts.length,
    profile: input.profile,
    relevantLogs,
    references,
    mustAssess,
    isRepair: false,
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
        user: user + buildRepairInstruction(parsed.problems),
        context: { ...context, isRepair: true },
      }),
      { mustAssess, hasReferences },
    );
    // Problems are schema paths and rule labels only — no health content.
    if (!parsed.ok) throw new AiUnavailableError(`invalid model output after repair (${parsed.problems.join("; ")})`);
  }

  const { output } = parsed;
  return {
    status: output.status,
    assistantMessage: output.assistantMessage,
    followUpQuestions: output.status === "follow_up" ? output.followUpQuestions : [],
    safety: safety.result,
    assessment:
      output.status === "assessment" && output.assessment
        ? toContractAssessment(output.assessment, relevantLogs, references)
        : null,
    safetyRuleId: null,
  };
}
