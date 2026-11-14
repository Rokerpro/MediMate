// Deterministic warning-sign rules (AI_SAFETY_SPEC.md §2 step 4, §5, §9).
//
// Every rule below implements one item from an NHS "Call 999 or go to A&E if"
// list, recorded with its URL and review date in docs/AI_SAFETY_SPEC.md §9.
// Do not add rules without a recorded authoritative source and tests.
//
// Limits (must not be hidden): matching is keyword-based, so unusual wording
// can be missed. "No rule matched" is NOT medical clearance and must never be
// shown as "safe". These rules are not comprehensive emergency detection.
import type { SafetyResult } from "@/lib/validations";

export type SafetyRule = {
  id: string;
  /** Returns true when the combined, lowercased user text matches this warning sign. */
  matches: (normalizedText: string) => boolean;
  /** Fixed escalation wording shown to the user. */
  message: string;
  /** Source register entry in docs/AI_SAFETY_SPEC.md §9. */
  sourceUrl: string;
  reviewedOn: string;
};

export const NHS_BACK_PAIN_URL = "https://www.nhs.uk/conditions/back-pain/";
export const NHS_HEADACHES_URL = "https://www.nhs.uk/conditions/headaches/";
export const NHS_CHEST_PAIN_URL = "https://www.nhs.uk/conditions/chest-pain/";
const BACK_REVIEWED = "2026-03-05"; // "Page last reviewed: 05 March 2026"
const HEADACHE_REVIEWED = "2024-04-17"; // "Page last reviewed: 17 April 2024"
const CHEST_REVIEWED = "2023-08-08"; // "Page last reviewed: 08 August 2023"

// ---------------------------------------------------------------------------
// Matching helpers

/** Negation words that cancel a symptom mention in the same clause. */
const NEGATION = /\b(no|not|never|without|denies|deny|none|nor)\b|n't\b/;
/** Words allowed between two parts of a "near" match: anything except a negation or sentence end. */
const GAP = String.raw`(?:(?!\bno\b|\bnot\b|n't\b|\bnever\b|\bwithout\b|\bbut\b)[^.!?;]){0,40}`;

/** True if the clause before `index` (up to 40 chars, cut at , ; . ! ? but however although) contains a negation. */
function precededByNegation(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 40), index);
  const clauses = window.split(/[.,;!?]|\bbut\b|\bhowever\b|\balthough\b/);
  return NEGATION.test(clauses[clauses.length - 1] ?? "");
}

/** True if `pattern` matches somewhere that is not negated ("no numbness", "not confused"). */
export function hasUnnegated(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  for (const match of text.matchAll(new RegExp(pattern.source, flags))) {
    if (!precededByNegation(text, match.index)) return true;
  }
  return false;
}

/** `a` and `b` within ~40 characters of each other, either order, with no negation between. */
function near(a: string, b: string): RegExp {
  return new RegExp(`(?:${a})${GAP}(?:${b})|(?:${b})${GAP}(?:${a})`, "i");
}

const BACK_CONTEXT = /\b(back|backache|spine|spinal|lumbar)\b/;
const CHEST_CONTEXT =
  /\b(chest pains?|pains? in (my |the )?chest|chest (hurts|is (hurting|sore))|chest discomfort|discomfort in (my |the )?chest)\b/;
const HEADACHE_CONTEXT =
  /\b(headaches?|head ?aches?|migraines?|head pain|head (hurts|is (hurting|pounding|throbbing)))\b/;

type RuleContext = "back" | "headache" | "chest";

const CONTEXTS: Record<RuleContext, { pattern: RegExp; page: string; url: string; reviewed: string; noun: string }> = {
  back: { pattern: BACK_CONTEXT, page: "Back pain", url: NHS_BACK_PAIN_URL, reviewed: BACK_REVIEWED, noun: "back pain" },
  headache: { pattern: HEADACHE_CONTEXT, page: "Headaches", url: NHS_HEADACHES_URL, reviewed: HEADACHE_REVIEWED, noun: "headache" },
  chest: { pattern: CHEST_CONTEXT, page: "Chest pain", url: NHS_CHEST_PAIN_URL, reviewed: CHEST_REVIEWED, noun: "chest pain" },
};

function rule(id: string, context: RuleContext, nhsItem: string, signs: readonly RegExp[]): SafetyRule {
  const { pattern: contextPattern, page, url: sourceUrl, reviewed, noun } = CONTEXTS[context];
  return {
    id,
    // Every sign pattern must match, un-negated, alongside the symptom context.
    matches: (text) => contextPattern.test(text) && signs.every((sign) => hasUnnegated(text, sign)),
    message:
      `Some of what you described is listed by the NHS as a reason to get emergency help ` +
      `(${noun} with ${nhsItem}). ` +
      `Call your local emergency number or go to the nearest emergency department now. ` +
      `MediMate cannot assess emergencies and this is not a diagnosis. ` +
      `Source: NHS, "${page}" (${sourceUrl}).`,
    sourceUrl,
    reviewedOn: reviewed,
  };
}

// ---------------------------------------------------------------------------
// Rules — NHS "Back pain": "Call 999 or go to A&E if you have back pain and: ..."

// "pain" is only counted in explicit leg phrases, so "back pain ... legs" alone does not fire.
const LEG_SYMPTOM = String.raw`\b(tingl\w*|weak\w*|numb\w*|pins and needles)\b`;
const LEG_PAIN = /\bpain\w*( is| has been| keeps)? (in|down|into|going down|goes down|spreading to|spreads to) (both (of )?)?(my )?legs\b/;

export const SAFETY_RULES: readonly SafetyRule[] = [
  {
    // Same NHS item, two phrasings: a leg symptom near "legs", or explicit pain in the legs.
    ...rule("back-both-legs", "back", "pain, tingling, weakness or numbness in both legs", []),
    matches: (text) =>
      BACK_CONTEXT.test(text) &&
      (hasUnnegated(text, near(LEG_SYMPTOM, String.raw`\b(both (of my )?legs|legs)\b`)) ||
        hasUnnegated(text, LEG_PAIN)),
  },
  rule("back-saddle-numbness", "back", "a loss of feeling around the genitals or anus", [
    near(
      String.raw`\b(numb\w*|no feeling|loss of feeling|lost (the )?feeling|can'?t feel|cannot feel)\b`,
      String.raw`\b(genital\w*|groin|anus|bottom|buttocks|saddle area|private (parts|area))\b`,
    ),
  ]),
  rule("back-bladder-bowel", "back", "changes in the bladder or bowels", [
    new RegExp(
      [
        String.raw`\b(can'?t|cannot|unable to|difficult\w*|trouble|struggling to)\s+(\w+\s+)?(pee|wee|urinate|peeing|urinating)\b`,
        String.raw`\b(peed|pooed|pooped|wet|soiled) (myself|my pants|the bed)\b`,
        String.raw`\b(lost|losing|loss of) (control of )?(my )?(bladder|bowels?)\b`,
        String.raw`\bincontinen\w*\b`,
        String.raw`\bchanges? (in|to) (my )?(bladder|bowels?)\b`,
      ].join("|"),
    ),
  ]),
  rule("back-sexual-function", "back", "changes in sexual sensation or function", [
    new RegExp(
      [
        String.raw`\b(can'?t|cannot|unable to) (get|keep) an erection\b`,
        String.raw`\berectile\b`,
        String.raw`\b(can'?t|cannot|unable to) (orgasm|climax)\b`,
        String.raw`\bchanges? in how (my )?(penis|vagina) feels\b`,
      ].join("|"),
    ),
  ]),
  rule("back-chest-pain", "back", "chest pain", [
    /\bchest pain\b|\bpain in (my )?chest\b|\bchest (hurts|is hurting)\b/,
  ]),
  rule("back-serious-accident", "back", "pain that started after a serious accident", [
    /\b(car|road|traffic|motorbike|motorcycle) (accident|crash|collision)\b|\bserious (accident|crash)\b|\bhit by a (car|vehicle)\b/,
  ]),

  // -------------------------------------------------------------------------
  // Rules — NHS "Headaches": "Call 999 or go to A&E if you or a child has a headache and: ..."

  rule("headache-seizure", "headache", "a seizure (fit)", [
    /\b(seizures?|convulsions?|convulsing|had a fit|having (a )?fits?)\b/,
  ]),
  rule("headache-numbness-weakness", "headache", "numbness or weakness in the body or face", [
    near(String.raw`\b(numb\w*|weak\w*)\b`, String.raw`\b(face|arms?|legs?|hands?|body|one side)\b`),
  ]),
  rule("headache-sudden-severe", "headache", "a headache that started suddenly and is extremely painful", [
    /\b(sudden\w*|all of a sudden|out of nowhere)\b/,
    /\b(extreme\w*|severe|worst|unbearable|excruciating|agoni\w*|10 ?\/ ?10|10 out of 10)\b/,
  ]),
  rule("headache-head-injury", "headache", "a recent head injury", [
    /\b(hit|bumped|banged|injured|hurt) my head\b|\bhead injury\b|\bconcussion\b|\bfell\b[^.!?;]{0,30}\bhead\b/,
  ]),
  rule("headache-speech-balance-memory", "headache", "difficulty speaking, balancing, walking or remembering", [
    /\b(difficult\w*|trouble|hard|struggl\w*|can'?t|cannot|unable to)\b[^.!?;]{0,20}\b(speak\w*|talk\w*|balanc\w*|walk\w*|remember\w*)\b|\bslurr\w*\b/,
  ]),
  rule("headache-drowsy-confused", "headache", "drowsiness or confusion", [
    /\b(drowsy|drowsiness|confused|confusion|disoriented)\b/,
  ]),
  rule("headache-vision-loss", "headache", "loss of vision", [
    /\b(loss of (vision|sight)|lost (my )?(vision|sight)|losing (my )?(vision|sight)|can'?t see|cannot see|(went|gone|going) blind)\b/,
  ]),
  rule("headache-non-fading-rash", "headache", "a rash that does not fade when a glass is rolled over it", [
    /\brash\b[^.!?;]{0,60}\b(doesn'?t|does not|won'?t|didn'?t|did not) fade\b|\bnon-?blanching\b|\brash\b[^.!?;]{0,40}\bglass\b/,
  ]),
  rule("headache-fever-stiff-neck-light", "headache", "a very high temperature, a stiff neck, or bright lights bothering you", [
    /\b(very high|high) (temperature|fever)\b|\bstiff neck\b|\bneck (is |feels )?stiff\b|\blights? (are |is )?(bothering|hurting|hurts|hurt)\b|\bsensitiv\w* to (bright )?light\b/,
  ]),

  // -------------------------------------------------------------------------
  // Rules — NHS "Chest pain": "Call 999 if: ..." (chest pain alone is not on the
  // list: "Most chest pain is not a sign of anything serious"; GP if it comes and goes).

  rule("chest-sudden-persistent", "chest", "sudden pain that does not go away", [
    /\b(sudden\w*|all of a sudden|out of nowhere)\b/,
    /\b(does ?n[o']t|did ?n[o']t|won'?t|will not|has ?n[o']t|have ?n[o']t|is ?n[o']t) (go|gone|going|went) away\b|\b(constant|persistent|still there)\b/,
  ]),
  rule("chest-squeezing-pressure", "chest", "pain that feels like squeezing or pressure, burning or indigestion", [
    /\b(squeez\w*|pressure|burning|indigestion)\b/,
  ]),
  rule("chest-spreading", "chest", "pain that spreads to your arm, neck, jaw, stomach or back", [
    near(
      String.raw`\b(spread\w*|radiat\w*|going (down|into|to)|goes (down|into|to)|moving (down|into|to)|moves (down|into|to))\b`,
      String.raw`\b(arms?|neck|jaw|stomach|back)\b`,
    ),
  ]),
  rule("chest-with-symptoms", "chest", "feeling sweaty, sick, light-headed or short of breath", [
    /\b(sweat\w*|clammy|sick|nause\w*|light[- ]?headed\w*|dizzy|faint|short of breath|shortness of breath|breathless\w*|out of breath|(trouble|difficulty|struggling|hard) breathing|can'?t (catch my )?breathe?)\b/,
  ]),
];

// ---------------------------------------------------------------------------

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
  const normalized = userTexts.join("\n").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  for (const candidate of rules) {
    if (candidate.matches(normalized)) {
      return {
        result: { level: "urgent", triggered: true, message: candidate.message },
        ruleId: candidate.id,
      };
    }
  }
  return { result: NO_RULE_MATCHED, ruleId: null };
}
