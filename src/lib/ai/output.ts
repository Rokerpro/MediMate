// Validation of raw model output and conversion to the API contract
// (AI_SAFETY_SPEC.md §2 steps 8–9, §4). Pure functions.
import { z } from "zod";

import type { Assessment, HealthLog, Source } from "@/lib/validations";

import { ASSESSMENT_DISCLAIMER } from "../validations/assistant.ts";
import { describeLog, logDate } from "../health/retrieve-history.ts";

const text = (max: number) => z.string().trim().min(1).max(max);

/** What the model is asked to return. Sources and dated history are added by the server. */
export const modelOutputSchema = z
  .object({
    status: z.enum(["follow_up", "assessment"]),
    assistantMessage: text(1500),
    followUpQuestions: z.array(text(300)).max(3),
    assessment: z
      .object({
        summary: text(2000),
        possibleExplanations: z
          .array(
            z.object({
              title: text(200),
              whyItMayBeRelevant: text(1000),
              supportingLogIds: z.array(z.string()).max(5),
              unknowns: z.array(text(300)).min(1).max(6),
            }),
          )
          .max(4),
        nextSteps: z.array(text(400)).min(1).max(6),
      })
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "follow_up" && (value.followUpQuestions.length === 0 || value.assessment !== null)) {
      ctx.addIssue({ code: "custom", message: "follow_up needs 1-3 questions and a null assessment" });
    }
    if (value.status === "assessment" && value.assessment === null) {
      ctx.addIssue({ code: "custom", message: "assessment status needs an assessment object" });
    }
  });

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/**
 * Wording the model must never produce (medical-safety skill §1, §5). A match
 * makes the output invalid, which triggers one repair attempt.
 */
const BANNED_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\b\d{1,3}(\.\d+)?\s?%/, label: "a percentage" },
  { pattern: /\bAI doctor\b/i, label: '"AI doctor"' },
  { pattern: /\bdiagnosed with\b/i, label: '"diagnosed with"' },
  { pattern: /\bmost likely\b/i, label: '"most likely"' },
  {
    pattern: /\b(consistent with|indicative of|suggestive of|typical(ly)? (of|for)|(suggests|indicates|points to) (a|an))\b/i,
    label: '"consistent with"-style diagnostic framing',
  },
  { pattern: /\bnothing to worry about\b/i, label: '"nothing to worry about"' },
  { pattern: /\byou are (safe|fine)\b/i, label: '"you are safe/fine"' },
  { pattern: /\brul(e|es|ed|ing) out\b/i, label: '"rule out"' },
  { pattern: /\bconfirm(s|ed)? (that )?you have\b/i, label: '"confirms you have"' },
  { pattern: /https?:\/\/|www\./i, label: "a URL" },
  {
    pattern: /\b(higher|increas\w*|doubl\w*|lower|reduc\w*|decreas\w*|adjust\w*|chang\w*)\s+(the\s+|your\s+|a\s+)?(dose|dosage)\b|\b(dose|dosage)\b[^.]{0,40}\b(sufficient|insufficient|enough|too (high|low))\b/i,
    label: "a dose-change suggestion",
  },
  { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, label: "a raw record id in text" },
];

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, out));
}

export function findBannedWording(output: ModelOutput): string[] {
  const strings: string[] = [];
  collectStrings(
    {
      ...output,
      assessment: output.assessment && {
        ...output.assessment,
        possibleExplanations: output.assessment.possibleExplanations.map((e) => ({
          title: e.title,
          whyItMayBeRelevant: e.whyItMayBeRelevant,
          unknowns: e.unknowns,
        })),
      },
    },
    strings,
  );
  const joined = strings.join("\n");
  return BANNED_PATTERNS.filter(({ pattern }) => pattern.test(joined)).map(({ label }) => label);
}

/** Pulls the first {...} block, tolerating markdown fences around it. */
function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export type ParseResult = { ok: true; output: ModelOutput } | { ok: false; problems: string[] };

export function parseModelOutput(raw: string, { mustAssess }: { mustAssess: boolean }): ParseResult {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    return { ok: false, problems: ["the reply was not valid JSON"] };
  }

  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 4)
      .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message));
    return { ok: false, problems };
  }

  const problems: string[] = [];
  if (mustAssess && parsed.data.status !== "assessment") problems.push('status must be "assessment" this turn');
  const banned = findBannedWording(parsed.data);
  if (banned.length) problems.push(`it used disallowed wording (${banned.join(", ")})`);

  return problems.length ? { ok: false, problems } : { ok: true, output: parsed.data };
}

/**
 * Builds the contract assessment. Supporting history comes only from logs the
 * server retrieved (unknown IDs are dropped), sources only from the curated set,
 * and the disclaimer is always the fixed server text.
 */
export function toContractAssessment(
  output: NonNullable<ModelOutput["assessment"]>,
  relevantLogs: readonly HealthLog[],
  sources: readonly Source[],
): Assessment {
  const logsById = new Map(relevantLogs.map((log) => [log.id, log]));
  return {
    summary: output.summary,
    possibleExplanations: output.possibleExplanations.map((explanation) => ({
      title: explanation.title,
      whyItMayBeRelevant: explanation.whyItMayBeRelevant,
      supportingHistory: [...new Set(explanation.supportingLogIds)]
        .map((id) => logsById.get(id))
        .filter((log): log is HealthLog => log !== undefined)
        .map((log) => ({ logId: log.id, date: logDate(log), observation: describeLog(log) })),
      unknowns: explanation.unknowns,
    })),
    nextSteps: output.nextSteps,
    sources: sources.map(({ title, publisher, url }) => ({ title, publisher, url })),
    disclaimer: ASSESSMENT_DISCLAIMER,
  };
}
