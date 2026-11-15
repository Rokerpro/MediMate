// Relevant-history retrieval (CLAUDE.md §7, AI_SAFETY_SPEC.md §2 step 3).
// Plain keyword overlap over a bounded recent window — no vector database.
// Pure function: the caller loads candidate logs; this selects the relevant ones.
import type { HealthLog } from "@/lib/validations";

/** Recent window and caps for what is loaded and what may reach the model. */
export const HISTORY_WINDOW_DAYS = 30;
export const HISTORY_CANDIDATE_LIMIT = 60;
export const MAX_RELEVANT_LOGS = 5;
/** Routine measurements (sleep, fluids, activity, mood) offered as separate context. */
export const RECENT_MEASUREMENT_DAYS = 7;
export const MAX_RECENT_MEASUREMENT_LOGS = 7;

// Words that carry no symptom meaning, plus generic severity/side modifiers that
// would otherwise create false matches (e.g. "mild headache" vs "mild back discomfort").
const STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "any", "are", "around", "bad", "been",
  "before", "being", "bit", "but", "can", "could", "day", "days", "did", "does",
  "doing", "feel", "feeling", "feels", "for", "from", "get", "getting", "got",
  "had", "has", "have", "having", "hours", "how", "into", "its", "just", "last",
  "left", "like", "little", "lot", "lower", "mild", "moderate", "more", "much",
  "not", "now", "only", "over", "really", "reported", "right", "severe", "since",
  "slight", "some", "specific", "started", "still", "symptom", "symptoms", "than",
  "that", "the", "them", "then", "there", "this", "today", "too", "upper", "very",
  "was", "week", "weeks", "were", "what", "when", "which", "while", "with", "would",
  "yesterday", "you", "your",
]);

/**
 * Everyday words for the same body area, mapped to one term so "backache" or
 * "lumbar pain" finds logs about the "lower back". Body areas only: no symptom
 * or condition synonyms, so matching stays literal and explainable.
 */
const BODY_AREA_SYNONYMS: Readonly<Record<string, string>> = {
  backache: "back",
  lumbar: "back",
  spine: "back",
  spinal: "back",
  headache: "head",
  tummy: "stomach",
  belly: "stomach",
  abdomen: "stomach",
  abdominal: "stomach",
};

/** Lowercase content words (length >= 3), with a simple plural strip and body-area synonyms. */
export function extractTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    const singular = raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw;
    if (STOPWORDS.has(singular)) continue;
    terms.add(singular);
    const area = BODY_AREA_SYNONYMS[singular];
    if (area) terms.add(area);
  }
  return terms;
}

/**
 * Removes negated phrases ("no swelling", "without numbness") up to the end of the
 * clause, so symptoms the user ruled out do not pull in history about them.
 */
export function stripNegatedPhrases(text: string): string {
  return text.replace(/\b(no|not|without|never|denies)\b(?:(?!\b(?:but|and|although|however)\b)[^,.;!?\n])*/gi, " ");
}

/** A retrieved log with the words it shares with the user's concern and its ranking score. */
export type RankedLog = { log: HealthLog; score: number; matchedTerms: string[] };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Recency and recorded pain only break ties: together they stay below one shared term. */
const RECENCY_WEIGHT = 0.5;
const SEVERITY_WEIGHT = 0.25;

/** Same calendar day and same symptom text (case and spacing ignored). */
const duplicateKey = (log: HealthLog): string =>
  `${log.loggedAt.slice(0, 10)}|${log.symptoms.trim().toLowerCase().replace(/\s+/g, " ")}`;

/**
 * Ranks logs against the user's concern (CLAUDE.md §7). Each log scores one point per
 * shared term, plus one more when the term is in its recorded pain location; recency
 * (linear over HISTORY_WINDOW_DAYS) and recorded pain level add less than one point in
 * total, so they only order logs that match equally well. Logs that share no term are
 * dropped, and duplicates (same day, same symptom text) keep the entry with the highest
 * recorded pain. Returns the top `max`, newest first.
 */
export function rankRelevantLogs(
  logs: readonly HealthLog[],
  queryText: string,
  { max = MAX_RELEVANT_LOGS, now = Date.now() }: { max?: number; now?: number } = {},
): RankedLog[] {
  const queryTerms = extractTerms(stripNegatedPhrases(queryText));
  if (queryTerms.size === 0) return [];

  const best = new Map<string, RankedLog>();
  for (const log of logs) {
    const symptomTerms = extractTerms(log.symptoms);
    const locationTerms = extractTerms(log.painLocation ?? "");
    const matchedTerms = [...new Set([...symptomTerms, ...locationTerms])].filter((term) => queryTerms.has(term)).sort();
    if (matchedTerms.length === 0) continue;

    const ageDays = Math.max(0, (now - Date.parse(log.loggedAt)) / DAY_MS);
    const recency = Math.max(0, 1 - ageDays / HISTORY_WINDOW_DAYS);
    const severity = log.painLevel === null ? 0 : log.painLevel / 10;
    const score =
      matchedTerms.length +
      matchedTerms.filter((term) => locationTerms.has(term)).length +
      RECENCY_WEIGHT * recency +
      SEVERITY_WEIGHT * severity;

    const key = duplicateKey(log);
    const existing = best.get(key);
    const keep =
      !existing ||
      (log.painLevel ?? -1) > (existing.log.painLevel ?? -1) ||
      ((log.painLevel ?? -1) === (existing.log.painLevel ?? -1) && log.loggedAt > existing.log.loggedAt);
    if (keep) best.set(key, { log, score, matchedTerms });
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score || b.log.loggedAt.localeCompare(a.log.loggedAt))
    .slice(0, max)
    .sort((a, b) => b.log.loggedAt.localeCompare(a.log.loggedAt));
}

/** The relevant logs only (see rankRelevantLogs), newest first. */
export function selectRelevantLogs(
  logs: readonly HealthLog[],
  queryText: string,
  max: number = MAX_RELEVANT_LOGS,
  now: number = Date.now(),
): HealthLog[] {
  return rankRelevantLogs(logs, queryText, { max, now }).map((entry) => entry.log);
}

/** Generic symptom words that say nothing about where or what (used for analytics topics). */
const GENERIC_SYMPTOM_WORDS = new Set([
  "ache", "aching", "achy", "discomfort", "hurt", "hurting", "hurt", "issue", "pain", "painful",
  "problem", "sore", "soreness", "feel", "felt", "long", "period", "sitting", "after", "noticed",
]);

/**
 * Symptom topics of a log for analytics: content words from its symptoms and pain
 * location, with generic words ("pain", "discomfort") removed and everyday synonyms
 * folded into one body area ("headache" counts as "head").
 */
export function topicTerms(log: Pick<HealthLog, "symptoms" | "painLocation">): Set<string> {
  const topics = new Set<string>();
  for (const term of extractTerms(`${log.symptoms} ${log.painLocation ?? ""}`)) {
    if (GENERIC_SYMPTOM_WORDS.has(term) || BODY_AREA_SYNONYMS[term]) continue;
    topics.add(term);
  }
  return topics;
}

const hasMeasurements = (log: HealthLog): boolean =>
  log.sleepDurationMinutes !== null ||
  log.sleepQuality !== null ||
  log.waterMl !== null ||
  log.activityMinutes !== null ||
  Boolean(log.mood);

/**
 * Logs from the last RECENT_MEASUREMENT_DAYS that record sleep, fluids, activity
 * or mood, newest first, excluding logs already selected as symptom matches.
 * Symptom keywords alone miss these (e.g. poor sleep logged on a no-symptom day).
 */
export function selectRecentMeasurementLogs(
  logs: readonly HealthLog[],
  excludeIds: ReadonlySet<string>,
  now: number = Date.now(),
): HealthLog[] {
  const since = now - RECENT_MEASUREMENT_DAYS * 24 * 60 * 60 * 1000;
  return logs
    .filter((log) => !excludeIds.has(log.id) && Date.parse(log.loggedAt) >= since && hasMeasurements(log))
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, MAX_RECENT_MEASUREMENT_LOGS);
}

function formatSleep(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `sleep ${hours}h${rest ? ` ${rest}m` : ""}`;
}

/** Measurements only (no symptoms or notes), for the recent-measurements prompt section. */
export function describeMeasurements(log: HealthLog): string {
  const parts: string[] = [];
  if (log.sleepDurationMinutes !== null) parts.push(formatSleep(log.sleepDurationMinutes));
  if (log.sleepQuality !== null) parts.push(`sleep quality ${log.sleepQuality}/5`);
  if (log.waterMl !== null) parts.push(`water ${log.waterMl} ml`);
  if (log.activityMinutes !== null) parts.push(`activity ${log.activityMinutes} min`);
  if (log.mood) parts.push(`mood: ${log.mood}`);
  return parts.join("; ");
}

/** One-line factual description of a log for prompts and supporting history. */
export function describeLog(log: HealthLog): string {
  const parts = [`symptoms: "${log.symptoms}"`];
  if (log.painLocation) parts.push(`pain location: ${log.painLocation}`);
  if (log.painLevel !== null) parts.push(`pain level ${log.painLevel}/10`);
  if (log.sleepDurationMinutes !== null) parts.push(formatSleep(log.sleepDurationMinutes));
  if (log.sleepQuality !== null) parts.push(`sleep quality ${log.sleepQuality}/5`);
  if (log.mood) parts.push(`mood: ${log.mood}`);
  if (log.activityMinutes !== null) parts.push(`activity ${log.activityMinutes} min`);
  if (log.waterMl !== null) parts.push(`water ${log.waterMl} ml`);
  if (log.notes) parts.push(`notes: "${log.notes}"`);
  return parts.join("; ");
}

/** Calendar date (YYYY-MM-DD, UTC) of a log. */
export function logDate(log: HealthLog): string {
  return log.loggedAt.slice(0, 10);
}
