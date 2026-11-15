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
              supportingLogIds: z.array(z.string()).max(14), // unknown ids are dropped later; weekly may cite a week of logs
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
  {
    // "lower than your personal needs", "less than you need", "may not meet your fluid needs".
    pattern: /\b(lower|less|below|higher|more|above|under|over|short of|meets?|meeting|cover(s|ing)?|exceed(s|ing)?)\s+(than\s+)?(what\s+)?(you|your(\s+(body's|personal|individual|own|daily))?)\s+((fluid|water|hydration|sleep|activity|daily)\s+)?(needs?|needed|requirements?|requires?)\b/i,
    label: "a judgement of the user's personal needs (no source supplies one)",
  },
  {
    // "your water intake was too low", "sleep may be insufficient".
    pattern: /\b(water|fluids?|hydration|sleep|activity)(\s+(intake|levels?|amounts?|duration))?\s+(is|was|were|may be|might be|could be|seems?|appears?|looks?)\s+(\w+\s+)?(insufficient|inadequate|too (low|little|short)|not enough|low|lower)\b/i,
    label: "a judgement that a recorded amount is too low (no source supplies one)",
  },
  {
    // "low activity levels", "limited recorded activity", "poor hydration" (sleep quality is a user score, so not included).
    pattern: /\b(low|lower|limited|little|poor|inadequate|insufficient|reduced)\s+(recorded\s+)?(activity|exercise|water|fluids?|fluid intake|water intake|hydration)\b/i,
    label: "a judgement that a recorded amount is too low (no source supplies one)",
  },
  { pattern: /\bnothing to worry about\b/i, label: '"nothing to worry about"' },
  { pattern: /\byou are (safe|fine)\b/i, label: '"you are safe/fine"' },
  { pattern: /\brul(e|es|ed|ing) out\b/i, label: '"rule out"' },
  { pattern: /\bconfirm(s|ed)? (that )?you have\b/i, label: '"confirms you have"' },
  {
    // "You have sciatica", "you may have a muscle strain", "you've got a migraine".
    // Only a condition-type word after it, so "you have logged back pain" is still fine.
    pattern:
      /\b(you|you've|you're)\s+(may |might |could |probably |likely |possibly )?(have|got|have got|are suffering from|suffering from|are experiencing (a|an))\s+(a |an |some )?(mild |minor |acute |chronic |possible |tension[- ])?(\w+\s)?(sciatica|strain|sprain|migraine|infection|hernia|slipped disc|herniated disc|disc|arthritis|syndrome|disorder|disease|condition|injury|dehydration|insomnia|anxiety|depression|\w+itis|\w+osis|\w+algia|\w+pathy)\b/i,
    label: '"you have <condition>" (a diagnosis)',
  },
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

/**
 * Starting, stopping or pausing a medicine (AI_SAFETY_SPEC.md §4). Allowed only
 * in a sentence that sends the user to a professional, e.g. "Ask your GP before
 * stopping any medicine".
 */
const MEDICATION_CHANGE =
  /\b(stop|stopping|start|starting|quit|quitting|skip|skipping|pause|pausing|come off|coming off|cut down on|discontinu\w*)\s+(taking\s+|using\s+)?(your\s+|the\s+|any\s+|this\s+|that\s+|a\s+)?(\w+\s+)?(medications?|medicines?|tablets?|pills?|prescriptions?|painkillers?|antidepressants?|inhalers?)\b/i;
const MEDICATION_CHANGE_LABEL = "a medication start/stop instruction";

function changesMedication(text: string): boolean {
  return text
    .split(/(?<=[.!?\n])\s*/)
    .some((sentence) => MEDICATION_CHANGE.test(sentence) && !PROFESSIONAL.test(sentence));
}

/** The same banned-wording and medication-change checks, over plain text (used by the medicine explainer). */
export function findBannedInText(text: string): string[] {
  const found = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
  if (changesMedication(text)) found.push(MEDICATION_CHANGE_LABEL);
  return found;
}

export function findBannedWording(output: ModelOutput): string[] {
  const joined = bannedSearchText(output);
  const found = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(joined)).map(({ label }) => label);
  if (changesMedication(joined)) found.push(MEDICATION_CHANGE_LABEL);
  return found;
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
  new RegExp(String.raw`\b${FACTOR}\s+(is |was |may be |might be |could be |can be )?(caus\w*|trigger\w*|leading to|led to|contribut\w*)\b`, "i"),
  // "water intake ... which could contribute to headache": a recorded factor, then a hedged causal verb in the same sentence.
  new RegExp(String.raw`\b${FACTOR}\b[^.;]{0,150}\b(could|may|might|can|would|will|likely)\s+(\w+\s+)?(contribut\w*|lead\w* to|caus\w*)\b`, "i"),
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
const MENTIONS_NO_HISTORY = /\bno (prior |previous |past |earlier )?(relevant|related|matching|prior|previous)\b[^.]{0,40}\b(history|logs?|records?|entries)\b/i;

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
/** Follow-up questions about medicine amounts or frequency (AI_SAFETY_SPEC.md §4: no dose discussion). */
const DOSE_QUESTION =
  /\b(mg|milligrams?|doses?|dosage|how (much|many|often)\b[^?]{0,60}\b(medicines?|medications?|tablets?|pills?|painkillers?|ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|codeine))\b/i;

/**
 * What the model may state as recorded data: dates of the logs it was given, and the
 * numbers that appear in those logs, the server's recorded facts or the user's own words.
 */
export type ClaimEvidence = {
  dates: ReadonlySet<string>;
  numbers: ReadonlySet<string>;
};

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", twenty: "20", thirty: "30",
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NUMBER = /\d+(?:\.\d+)?/g;

const normaliseNumber = (value: string): string => String(Number(NUMBER_WORDS[value.toLowerCase()] ?? value));

/** Builds the evidence set from everything the model was given. */
export function claimEvidence(
  logs: readonly HealthLog[],
  texts: readonly string[],
  now: number = Date.now(),
): ClaimEvidence {
  const dates = new Set(logs.map(logDate));
  dates.add(new Date(now).toISOString().slice(0, 10));
  const numbers = new Set<string>();
  const sources = [...logs.map(describeLog), ...texts];
  for (const source of sources) {
    // Dates are checked separately; their parts ("2026", "11") must not count as recorded figures.
    for (const match of source.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").match(NUMBER) ?? []) {
      numbers.add(normaliseNumber(match));
    }
    for (const word of source.toLowerCase().match(/\b[a-z]+\b/g) ?? []) {
      if (NUMBER_WORDS[word]) numbers.add(NUMBER_WORDS[word]!);
    }
    for (const iso of source.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []) dates.add(iso);
  }
  // How many records were provided is a supported count; per-topic day counts come from the recorded facts.
  numbers.add(String(logs.length));
  return { dates, numbers };
}

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const MONTH_NAME = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
const MONTH_DAY = new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi");
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_NAME}\\b`, "gi");
const PAIN_SCORE = /\b(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*10\b/gi;
const COUNT_WORD = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty)";
const COUNT = new RegExp(
  `\\b(?:on|in|across|over|for|from)\\s+${COUNT_WORD}\\s+(?:separate\\s+|different\\s+|recent\\s+)?(?:days|logs|entries|occasions|records|nights)\\b|\\b${COUNT_WORD}\\s+times\\b`,
  "gi",
);

/**
 * Dates, pain scores and counts the model states that are not in the data it was
 * given (AI_SAFETY_SPEC.md: never invent history, dates or measurements).
 * Returns the offending phrases.
 */
export function findUnsupportedClaims(output: ModelOutput, evidence: ClaimEvidence): string[] {
  const text = bannedSearchText(output);
  const monthDays = new Set([...evidence.dates].map((date) => date.slice(5)));
  const found: string[] = [];
  for (const match of text.matchAll(ISO_DATE)) if (!evidence.dates.has(match[0])) found.push(match[0]);
  const checkMonthDay = (phrase: string, month: string, day: string) => {
    const key = `${String(MONTHS.indexOf(month.slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (!monthDays.has(key)) found.push(phrase);
  };
  for (const match of text.matchAll(MONTH_DAY)) checkMonthDay(match[0], match[1]!, match[2]!);
  for (const match of text.matchAll(DAY_MONTH)) checkMonthDay(match[0], match[2]!, match[1]!);
  for (const match of text.matchAll(PAIN_SCORE)) {
    if (!evidence.numbers.has(normaliseNumber(match[1]!))) found.push(match[0]);
  }
  for (const match of text.matchAll(COUNT)) {
    const value = match[1] ?? match[2]!;
    if (!evidence.numbers.has(normaliseNumber(value))) found.push(match[0]);
  }
  return [...new Set(found)];
}

export type ParseResult = { ok: true; output: ModelOutput } | { ok: false; problems: string[]; quotes: string[] };

export function parseModelOutput(
  raw: string,
  {
    mustAssess,
    hasReferences = true,
    evidence,
  }: { mustAssess: boolean; hasReferences?: boolean; evidence?: ClaimEvidence },
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
  if (output.followUpQuestions.some((q) => DOSE_QUESTION.test(q))) {
    problems.push("a follow-up question asked about a medicine dose or how often it is taken; leave medicine questions to a pharmacist or prescriber");
  }
  if (makesCausalClaim(output)) {
    problems.push("it presented something the user recorded or reported as the cause; describe it as something recorded around the same time instead");
  }
  if (output.assessment) {
    problems.push(...findUnsourcedSelfCare(output.assessment.nextSteps));
    if (!hasReferences && namesConditionWithoutReference(output.assessment)) {
      problems.push("it named a specific condition although no medical reference covers this topic");
    }
  }

  const unsupported = evidence ? findUnsupportedClaims(output, evidence) : [];
  if (unsupported.length) {
    problems.push(
      "it mentioned a date, pain level or count that is not in the provided records; use only figures from RELEVANT_HISTORY, RECENT_DAILY_MEASUREMENTS or RECORDED_PATTERNS",
    );
  }

  if (!problems.length) return { ok: true, output };
  const quotes = [
    ...quoteMatches([bannedSearchText(output)], BANNED_PATTERNS.map(({ pattern }) => pattern)),
    ...quoteMatches(causalSearchTexts(output), CAUSAL_CLAIM),
    ...unsupported,
  ];
  return { ok: false, problems, quotes };
}

/**
 * Builds the contract assessment. Supporting history comes only from logs the
 * server retrieved (unknown IDs are dropped), sources only from the curated set,
 * and the disclaimer is always the fixed server text.
 */
/** Added by the server when the user mentioned a medicine and the model did not refer them to a professional. */
export const MEDICINE_NEXT_STEP =
  "For any question about your medicines, including whether to keep taking them, ask a pharmacist or your prescriber.";
const USER_MENTIONS_MEDICINE =
  /\b(medications?|medicines?|meds|tablets?|pills?|prescriptions?|doses?|dosage|painkillers?|ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|codeine)\b/i;
const REFERS_TO_PHARMACIST = /\b(pharmacist|prescriber|prescribing)\b/i;

/** Server-calculated grounding added to the assessment (never written by the model). */
export type Grounding = {
  /** Terms each retrieved log shares with the user's concern, by log id. */
  matchedTerms?: ReadonlyMap<string, readonly string[]>;
  /** Recorded facts from src/lib/health/analytics.ts. */
  recordedFacts?: readonly string[];
};

export function toContractAssessment(
  output: NonNullable<ModelOutput["assessment"]>,
  relevantLogs: readonly HealthLog[],
  sources: readonly Source[],
  recentMeasurementLogs: readonly HealthLog[] = [],
  userText = "",
  grounding: Grounding = {},
): Assessment {
  const logsById = new Map([...relevantLogs, ...recentMeasurementLogs].map((log) => [log.id, log]));
  const termsOf = (id: string): string[] => [...(grounding.matchedTerms?.get(id) ?? [])];
  const possibleExplanations = output.possibleExplanations.map((explanation) => ({
    title: explanation.title,
    whyItMayBeRelevant: explanation.whyItMayBeRelevant,
    supportingHistory: [...new Set(explanation.supportingLogIds)]
      .map((id) => logsById.get(id))
      .filter((log): log is HealthLog => log !== undefined)
      .map((log) => ({ logId: log.id, date: logDate(log), observation: describeLog(log), matchedTerms: termsOf(log.id) })),
    unknowns: explanation.unknowns,
  }));
  const citedIds = new Set(possibleExplanations.flatMap((e) => e.supportingHistory.map((h) => h.logId)));
  const relevantIds = new Set(relevantLogs.map((log) => log.id));
  const historyConsidered = [...logsById.values()]
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .map((log) => ({
      logId: log.id,
      date: logDate(log),
      observation: describeLog(log),
      matchedTerms: termsOf(log.id),
      reason: relevantIds.has(log.id) ? ("symptom_match" as const) : ("recent_measurement" as const),
      cited: citedIds.has(log.id),
    }))
    .slice(0, 20);
  const citedAnyHistory = possibleExplanations.some((e) => e.supportingHistory.length > 0);
  const summary =
    relevantLogs.length === 0 && !citedAnyHistory && !MENTIONS_NO_HISTORY.test(output.summary)
      ? `${output.summary} ${NO_HISTORY_NOTE}`
      : output.summary;
  return {
    summary,
    possibleExplanations,
    nextSteps:
      USER_MENTIONS_MEDICINE.test(userText) && !output.nextSteps.some((step) => REFERS_TO_PHARMACIST.test(step))
        ? [...output.nextSteps, MEDICINE_NEXT_STEP]
        : output.nextSteps,
    sources: sources.map(({ title, publisher, url }) => ({ title, publisher, url })),
    disclaimer: ASSESSMENT_DISCLAIMER,
    recordedFacts: [...(grounding.recordedFacts ?? [])].slice(0, 10),
    historyConsidered,
  };
}
