// On-demand weekly summary of the user's own logs (owner scope change, 2026-11-15).
// Same order and checks as a chat turn (AI_SAFETY_SPEC.md §2): deterministic
// safety rules first, then the model, then the same output validation, one
// repair attempt, and the same server-built assessment (dated history from cited
// log ids, curated sources only, disclaimer). No I/O except injected deps.
import type { HealthLog, Profile, SafetyResult } from "@/lib/validations";

import { selectReferences, type CuratedReference } from "../health/references.ts";
import { extractTerms, selectRecentMeasurementLogs } from "../health/retrieve-history.ts";
import { PROMPT_ASSISTANT_NOTE, PROMPT_NEXT_STEP, type SafetyEvaluation } from "../health/safety-rules.ts";
import { isSymptomEntry } from "../health/trends.ts";
import { recordedFactsFor } from "../health/analytics.ts";
import { parseModelOutput, toContractAssessment } from "./output.ts";
import { SYSTEM_PROMPT, WEEKLY_REQUEST, buildRepairInstruction, buildUserContent } from "./prompts.ts";
import { AiUnavailableError, type LlmProvider, type ModelContext } from "./types.ts";
import type { WeeklySummaryResponse } from "@/lib/validations";

export const WEEKLY_DAYS = 7;
/** Upper bound on logs sent to the model (a log a day, plus a few extra). */
export const MAX_WEEKLY_LOGS = 14;

export const NO_DATA_MESSAGE =
  "You have no health logs from the last 7 days yet. Add a daily log, then generate the summary again.";
export const WEEKLY_URGENT_MESSAGE =
  "One of this week's logs mentions a warning sign, so MediMate will not summarise it. Please read the urgent safety guidance and get help now if it applies to you.";

const ROUTINE: SafetyResult = { level: "routine", triggered: false, message: null };

export type WeeklySummaryInput = {
  /** Recent logs; anything outside the last 7 days is ignored here. */
  logs: readonly HealthLog[];
  profile: Profile;
  now?: number;
};

export type WeeklySummaryDeps = {
  provider: LlmProvider;
  evaluateSafety: (userTexts: readonly string[]) => SafetyEvaluation;
  references?: readonly CuratedReference[];
};

export type WeeklySummaryResult = WeeklySummaryResponse & { safetyRuleId: string | null };

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function runWeeklySummary(
  input: WeeklySummaryInput,
  deps: WeeklySummaryDeps,
): Promise<WeeklySummaryResult> {
  const now = input.now ?? Date.now();
  const since = now - WEEKLY_DAYS * 24 * 60 * 60 * 1000;
  const week = { weekStart: isoDate(since), weekEnd: isoDate(now) };

  const weekLogs = input.logs
    .filter((log) => {
      const at = Date.parse(log.loggedAt);
      return at >= since && at <= now;
    })
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, MAX_WEEKLY_LOGS);

  if (weekLogs.length === 0) {
    return {
      status: "no_data",
      ...week,
      logCount: 0,
      safety: ROUTINE,
      assistantMessage: NO_DATA_MESSAGE,
      assessment: null,
      safetyRuleId: null,
    };
  }

  // Deterministic safety first, over everything the user wrote in this week's logs.
  const loggedTexts = weekLogs.map((log) => [log.symptoms, log.painLocation, log.notes].filter(Boolean).join(". "));
  const safety = deps.evaluateSafety(loggedTexts);
  if (safety.result.level === "urgent" && safety.result.triggered && safety.result.message) {
    return {
      status: "urgent",
      ...week,
      logCount: weekLogs.length,
      safety: safety.result,
      assistantMessage: WEEKLY_URGENT_MESSAGE,
      assessment: null,
      safetyRuleId: safety.ruleId,
    };
  }

  const symptomLogs = weekLogs.filter(isSymptomEntry);
  const measurementLogs = selectRecentMeasurementLogs(weekLogs, new Set(symptomLogs.map((log) => log.id)), now);
  const queryText = symptomLogs.map((log) => [log.symptoms, log.painLocation, log.notes].filter(Boolean).join(". ")).join("\n");
  const references = selectReferences(extractTerms(queryText), deps.references);
  const hasReferences = references.length > 0;
  const isPrompt = safety.result.level === "prompt" && safety.result.triggered;

  const recordedPatterns = recordedFactsFor(weekLogs, null, 7, now);
  const context: ModelContext = {
    currentMessage: WEEKLY_REQUEST,
    priorMessages: [],
    priorUserMessageCount: 0,
    profile: input.profile,
    relevantLogs: symptomLogs,
    recentMeasurementLogs: measurementLogs,
    recordedPatterns,
    references,
    mustAssess: true,
    isRepair: false,
    promptSign: isPrompt ? (safety.sign ?? "an NHS urgent-GP / 111 warning sign") : null,
    mode: "weekly",
  };
  const user = buildUserContent(context);

  let parsed = parseModelOutput(
    await deps.provider.complete({ system: SYSTEM_PROMPT, user, context }),
    { mustAssess: true, hasReferences },
  );
  if (!parsed.ok) {
    parsed = parseModelOutput(
      await deps.provider.complete({
        system: SYSTEM_PROMPT,
        user: user + buildRepairInstruction(parsed.problems, parsed.quotes),
        context: { ...context, isRepair: true },
      }),
      { mustAssess: true, hasReferences },
    );
    if (!parsed.ok) throw new AiUnavailableError(`invalid weekly output after repair (${parsed.problems.join("; ")})`);
  }

  const { output } = parsed;
  if (output.status !== "assessment" || !output.assessment) {
    throw new AiUnavailableError("weekly output was not an assessment");
  }
  const assessment = toContractAssessment(output.assessment, symptomLogs, references, measurementLogs, queryText, {
    recordedFacts: recordedPatterns,
  });

  return {
    status: "summary",
    ...week,
    logCount: weekLogs.length,
    safety: safety.result,
    assistantMessage: isPrompt ? `${output.assistantMessage} ${PROMPT_ASSISTANT_NOTE}` : output.assistantMessage,
    assessment: isPrompt ? { ...assessment, nextSteps: [PROMPT_NEXT_STEP, ...assessment.nextSteps] } : assessment,
    safetyRuleId: isPrompt ? safety.ruleId : null,
  };
}
