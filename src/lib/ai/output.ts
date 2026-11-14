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
  {
    pattern: /\b(common|classic|usual) (pattern|presentation|picture|sign)s? (for|of)\b/i,
    label: '"common pattern for"-style diagnostic framing',
  },
  {
    pattern: /\b(match(es|ed|ing)?|fits?|resembles?|aligns? with|in line with)\s+(a |an |the )?(common|typical|classic|usual)\b/i,
    label: '"matches common X"-style diagnostic framing',
  },
  {
    pattern: /\b(lower|less|below|higher|more|above|under|over)\s+(than\s+)?(the\s+)?(typical|recommended|normal|usual|average|healthy|ideal)\s+(daily\s+)?(needs?|intake|amounts?|levels?|ranges?|targets?|recommendations?|guidelines?)\b/i,
    label: "a comparison with a normal or recommended amount (no source supplies one)",
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

function bannedSearchText(output: ModelOutput): string {
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
  return strings.join("\n");
}

export function findBannedWording(output: ModelOutput): string[] {
  const joined = bannedSearchText(output);
  return BANNED_PATTERNS.filter(({ pattern }) => pattern.test(joined)).map(({ label }) => label);
}

/** The exact offending phrases, for the repair prompt only (never logged). */
function quoteMatches(texts: readonly string[], patterns: readonly RegExp[]): string[] {
  const quotes = new Set<string>();
  for (const text of texts) {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) quotes.add(match[0].slice(0, 80));
    }
  }
  return [...quotes];
}

/**
 * Self-care the curated NHS excerpts do not contain (AI_SAFETY_SPEC.md §4:
 * no treatments). Checked in nextSteps only, so a summary can still repeat
 * what the user reported doing.
 */
const UNSOURCED_SELF_CARE =
  /\b(compress(es)?|heat|heating pad|hot water bottle|ice( pack)?|cold pack|stretch\w*|massag\w*|supplements?|vitamins?|ointments?|creams?|gels?|balms?|foam roll\w*|brace|acupuncture|chiropract\w*|yoga|pilates)\b/i;
/** A medicine named in a next step is only allowed when the step sends the user to a professional. */
const MEDICINE = /\b(painkillers?|pain relief|ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|codeine|over[- ]the[- ]counter)\b/i;
const PROFESSIONAL = /\b(pharmacist|prescriber|doctor|gp|clinician)\b/i;

export function findUnsourcedSelfCare(nextSteps: readonly string[]): string[] {
  const problems = new Set<string>();
  for (const step of nextSteps) {
    if (UNSOURCED_SELF_CARE.test(step)) problems.add("self-care advice that is not in the medical references");
    if (MEDICINE.test(step) && !PROFESSIONAL.test(step)) problems.add("medicine advice without referring to a pharmacist or prescriber");
  }
  return [...problems];
}

/** Lines that are only a section label, e.g. "Possible explanations:" or "**Next steps**". */
const LABEL_LINE =
  /^[\s*#_-]*(possible explanations?|explanations?|next steps?|unknowns?|summary|assessment|follow[- ]up questions?|questions?|what you can do)[\s*_:-]*$/i;

/** Removes stray section labels from the chat reply; the UI shows those sections separately. */
export function tidyAssistantMessage(message: string): string {
  return message
    .split("\n")
    .filter((line) => !LABEL_LINE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Named conditions ("... syndrome", "... disease", "tendinitis"). Only allowed when
 * a curated reference matched the topic; otherwise possibilities stay general.
 */
const NAMED_CONDITION =
  /\b(syndromes?|diseases?|disorders?|[a-z]+itis)\b|\b((often|also|commonly|sometimes) (called|referred to as)|known as)\b|\b[a-z]+['’]s (knee|elbow|foot|disease)\b/i;

export function namesConditionWithoutReference(assessment: NonNullable<ModelOutput["assessment"]>): boolean {
  const texts = [assessment.summary, ...assessment.possibleExplanations.flatMap((e) => [e.title, e.whyItMayBeRelevant])];
  return texts.some((text) => NAMED_CONDITION.test(text));
}

/**
 * Causal claims about the user's own recorded or reported factors (CLAUDE.md §7:
 * correlation is not causation). "Back discomfort was logged on days with long
 * sitting" is fine; "strain from prolonged sitting" or "caused by poor sleep" is not.
 */
const FACTOR = String.raw`(sitting|posture|sleep|inactivity|activity|exercise|dehydration|water|fluids?|hydration|stress|screen time)`;
const CAUSAL_CLAIM: readonly RegExp[] = [
  new RegExp(String.raw`\b(caused by|due to|because of|as a result of|result(s|ed|ing)? from|triggered by|brought on by)\s+(\w+\s+){0,3}?${FACTOR}\b`, "i"),
  new RegExp(String.raw`\bfrom (prolonged|long|extended|lots of|too much|too little|lack of|poor|not enough|excessive|reduced|low)\s+(\w+\s+){0,2}?${FACTOR}\b`, "i"),
  new RegExp(String.raw`\b${FACTOR}\s+(is |was |may be |might be |could be |can be )?(caus\w*|trigger\w*|leading to|led to)\b`, "i"),
];

function causalSearchTexts(output: ModelOutput): string[] {
  const texts = [output.assistantMessage];
  if (output.assessment) {
    texts.push(
      output.assessment.summary,
      ...output.assessment.possibleExplanations.flatMap((e) => [e.title, e.whyItMayBeRelevant]),
    );
  }
  return texts;
}

export function makesCausalClaim(output: ModelOutput): boolean {
  return causalSearchTexts(output).some((text) => CAUSAL_CLAIM.some((pattern) => pattern.test(text)));
}

/** Added by the server when retrieval found nothing, so honesty does not depend on the model. */
export const NO_HISTORY_NOTE =
  "No related entries were found in your recent health logs, so this is based only on what you shared.";
const MENTIONS_NO_HISTORY = /\bno (relevant|related|matching)\b[^.]{0,40}\b(history|logs?|records?|entries)\b/i;

/** Pulls the first {...} block, tolerating markdown fences around it. */
function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

/**
 * `problems` are labels without health content (safe to log). `quotes` are the
 * exact offending phrases, used only in the repair prompt and never logged.
 */
export type ParseResult = { ok: true; output: ModelOutput } | { ok: false; problems: string[]; quotes: string[] };

export function parseModelOutput(
  raw: string,
  { mustAssess, hasReferences = true }: { mustAssess: boolean; hasReferences?: boolean },
): ParseResult {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    return { ok: false, problems: ["the reply was not valid JSON"], quotes: [] };
  }

  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 4)
      .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message));
    return { ok: false, problems, quotes: [] };
  }

  const output: ModelOutput = { ...parsed.data, assistantMessage: tidyAssistantMessage(parsed.data.assistantMessage) };
  const problems: string[] = [];
  if (!output.assistantMessage) problems.push("assistantMessage was empty");
  if (mustAssess && parsed.data.status !== "assessment") problems.push('status must be "assessment" this turn');
  const banned = findBannedWording(output);
  if (banned.length) problems.push(`it used disallowed wording (${banned.join(", ")})`);
  if (makesCausalClaim(output)) {
    problems.push("it presented something the user recorded or reported as the cause; describe it as something recorded around the same time instead");
  }
  if (output.assessment) {
    problems.push(...findUnsourcedSelfCare(output.assessment.nextSteps));
    if (!hasReferences && namesConditionWithoutReference(output.assessment)) {
      problems.push("it named a specific condition although no medical reference covers this topic");
    }
  }

  if (!problems.length) return { ok: true, output };
  const quotes = [
    ...quoteMatches([bannedSearchText(output)], BANNED_PATTERNS.map(({ pattern }) => pattern)),
    ...quoteMatches(causalSearchTexts(output), CAUSAL_CLAIM),
  ];
  return { ok: false, problems, quotes };
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
  recentMeasurementLogs: readonly HealthLog[] = [],
): Assessment {
  const logsById = new Map([...relevantLogs, ...recentMeasurementLogs].map((log) => [log.id, log]));
  const possibleExplanations = output.possibleExplanations.map((explanation) => ({
    title: explanation.title,
    whyItMayBeRelevant: explanation.whyItMayBeRelevant,
    supportingHistory: [...new Set(explanation.supportingLogIds)]
      .map((id) => logsById.get(id))
      .filter((log): log is HealthLog => log !== undefined)
      .map((log) => ({ logId: log.id, date: logDate(log), observation: describeLog(log) })),
    unknowns: explanation.unknowns,
  }));
  const citedAnyHistory = possibleExplanations.some((e) => e.supportingHistory.length > 0);
  const summary =
    relevantLogs.length === 0 && !citedAnyHistory && !MENTIONS_NO_HISTORY.test(output.summary)
      ? `${output.summary} ${NO_HISTORY_NOTE}`
      : output.summary;
  return {
    summary,
    possibleExplanations,
    nextSteps: output.nextSteps,
    sources: sources.map(({ title, publisher, url }) => ({ title, publisher, url })),
    disclaimer: ASSESSMENT_DISCLAIMER,
  };
}
