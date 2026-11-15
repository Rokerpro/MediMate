// Draft a health log from the user's OWN chat messages ("Save to my log").
// Never reads AI text: the log must stay a user-reported record. The user
// reviews and edits every field and confirms before anything is saved.

export type LogDraft = { symptoms: string; painLocation: string | null; painLevel: number | null };

const SYMPTOMS_MAX = 1000;

/** Body areas, most specific first. The matched words are shown as the user typed them. */
const BODY_AREAS: readonly { pattern: RegExp; label?: string }[] = [
  { pattern: /\b(lower|upper|middle) back\b/i },
  { pattern: /\b(left|right) (knee|hip|ankle|wrist|shoulder|elbow|foot|hand|leg|arm)\b/i },
  { pattern: /\b(back|neck|shoulder|knee|hip|ankle|wrist|elbow|foot|feet|hand|leg|arm|chest|stomach|jaw)\b/i },
  { pattern: /\b(headaches?|head)\b/i, label: "Head" },
];

/** "4 out of 10", "4/10", "pain 4 of 10". The last mention wins (the user may have updated it). */
const PAIN_LEVEL = /\b(10|[0-9])\s*(?:\/|out of|of)\s*10\b/gi;

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function draftLogFromUserMessages(userTexts: readonly string[]): LogDraft {
  const texts = userTexts.map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean);
  const joined = texts.join(" ");

  let symptoms = texts.join(" / ");
  if (symptoms.length > SYMPTOMS_MAX) symptoms = `${symptoms.slice(0, SYMPTOMS_MAX - 1).trimEnd()}…`;

  let painLocation: string | null = null;
  for (const area of BODY_AREAS) {
    const match = area.pattern.exec(joined);
    if (match) {
      painLocation = area.label ?? capitalise(match[0]);
      break;
    }
  }

  const levels = [...joined.matchAll(PAIN_LEVEL)].map((m) => Number(m[1]));
  const painLevel = levels.length ? (levels[levels.length - 1] ?? null) : null;

  return { symptoms, painLocation, painLevel };
}
