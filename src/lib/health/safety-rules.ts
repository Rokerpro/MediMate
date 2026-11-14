// Deterministic warning-sign rules (AI_SAFETY_SPEC.md §2 step 4, §5).
//
// BLOCKED: no rules are implemented yet. Every rule must be based on an
// authoritative medical source whose URL and review date are recorded in
// docs/AI_SAFETY_SPEC.md §9, with positive/negative/ambiguous tests. Do not add
// rules from intuition. Until then, SAFETY_RULES is empty and every message
// returns "no rule matched" — which is NOT medical clearance and must never be
// shown to the user as "safe".
import type { SafetyResult } from "@/lib/validations";

export type SafetyRule = {
  id: string;
  /** Returns true when the combined user text matches this warning sign. */
  matches: (normalizedText: string) => boolean;
  /** Reviewed escalation wording from the safety spec. */
  message: string;
  /** Source register entry in docs/AI_SAFETY_SPEC.md §9. */
  sourceUrl: string;
  reviewedOn: string;
};

export const SAFETY_RULES: readonly SafetyRule[] = [];

export type SafetyEvaluation = { result: SafetyResult; ruleId: string | null };

const NO_RULE_MATCHED: SafetyResult = { level: "routine", triggered: false, message: null };

/**
 * Evaluates the current message plus earlier user messages in the session.
 * The first matching rule wins; the LLM never sees or changes this decision.
 */
export function evaluateSafety(
  userTexts: readonly string[],
  rules: readonly SafetyRule[] = SAFETY_RULES,
): SafetyEvaluation {
  const normalized = userTexts.join("\n").toLowerCase().replace(/\s+/g, " ");
  for (const rule of rules) {
    if (rule.matches(normalized)) {
      return {
        result: { level: "urgent", triggered: true, message: rule.message },
        ruleId: rule.id,
      };
    }
  }
  return { result: NO_RULE_MATCHED, ruleId: null };
}
