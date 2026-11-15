// Deterministic health analytics (contract §3e). The code calculates every figure;
// the AI model may only explain figures it is given. Pure functions, no I/O.
// Nothing here interprets or diagnoses: values are recorded, user-reported data.
import type { HealthLog } from "@/lib/validations";

import {
  ANALYTICS_NOTE,
  type AnalyticsMeasure,
  type AnalyticsResponse,
  type Association,
  type DailyAnalytics,
  type SymptomAnalytics,
} from "../validations/analytics.ts";

import { extractTerms, stripNegatedPhrases, topicTerms } from "./retrieve-history.ts";
import { isSymptomEntry, logsInWindow } from "./trends.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_TOPICS = 8;
/** Topics compared against measures in `associations`. */
const MAX_ASSOCIATION_TOPICS = 3;
/** Each side of an association, and each half of a severity change, needs this many values. */
export const MIN_VALUES = 2;
/** A change in average recorded pain smaller than this is "about the same". */
export const SEVERITY_CHANGE_THRESHOLD = 1;
const MAX_EVIDENCE = 30;

const utcDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const dateOf = (log: HealthLog): string => log.loggedAt.slice(0, 10);
const round1 = (value: number): number => Math.round(value * 10) / 10;
const mean = (values: readonly number[]): number | null =>
  values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const dayNumber = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

/** Runs of consecutive calendar days, from a sorted list of distinct dates. */
function episodes(sortedDates: readonly string[]): number[] {
  const runs: number[] = [];
  let previous: number | null = null;
  for (const date of sortedDates) {
    const day = dayNumber(date);
    if (previous !== null && day === previous + 1) runs[runs.length - 1]! += 1;
    else runs.push(1);
    previous = day;
  }
  return runs;
}

function dailyPoint(date: string, logs: readonly HealthLog[]): DailyAnalytics {
  const values = <T,>(pick: (log: HealthLog) => T | null): T[] =>
    logs.map(pick).filter((value): value is T => value !== null);
  const pains = values((log) => log.painLevel);
  const sleeps = values((log) => log.sleepDurationMinutes);
  const qualities = values((log) => log.sleepQuality);
  const water = values((log) => log.waterMl);
  const activity = values((log) => log.activityMinutes);
  return {
    date,
    painLevel: pains.length ? Math.max(...pains) : null,
    sleepHours: sleeps.length ? round1(Math.max(...sleeps) / 60) : null,
    sleepQuality: mean(qualities),
    waterMl: water.length ? water.reduce((sum, value) => sum + value, 0) : null,
    activityMinutes: activity.length ? activity.reduce((sum, value) => sum + value, 0) : null,
    logIds: logs.map((log) => log.id).slice(0, MAX_EVIDENCE),
  };
}

function symptomAnalytics(topic: string, logs: readonly HealthLog[], midpoint: string): SymptomAnalytics {
  const dates = [...new Set(logs.map(dateOf))].sort();
  const runs = episodes(dates);
  const pains = logs.map((log) => log.painLevel).filter((value): value is number => value !== null);
  const earlier = logs.filter((log) => dateOf(log) < midpoint && log.painLevel !== null).map((log) => log.painLevel!);
  const later = logs.filter((log) => dateOf(log) >= midpoint && log.painLevel !== null).map((log) => log.painLevel!);
  const earlierAverage = mean(earlier);
  const laterAverage = mean(later);
  let direction: SymptomAnalytics["severityChange"]["direction"] = "not_enough_data";
  if (earlier.length >= MIN_VALUES && later.length >= MIN_VALUES && earlierAverage !== null && laterAverage !== null) {
    const change = laterAverage - earlierAverage;
    direction =
      change >= SEVERITY_CHANGE_THRESHOLD ? "higher" : change <= -SEVERITY_CHANGE_THRESHOLD ? "lower" : "about_the_same";
  }
  return {
    topic,
    logCount: logs.length,
    dayCount: dates.length,
    severity: {
      recordedCount: pains.length,
      average: mean(pains),
      lowest: pains.length ? Math.min(...pains) : null,
      highest: pains.length ? Math.max(...pains) : null,
    },
    severityChange: { earlierAverage, laterAverage, direction },
    recurrence: {
      episodes: runs.length,
      longestEpisodeDays: Math.max(...runs),
      firstDate: dates[0]!,
      lastDate: dates[dates.length - 1]!,
    },
    evidenceLogIds: [...logs]
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
      .map((log) => log.id)
      .slice(0, MAX_EVIDENCE),
  };
}

const MEASURES: readonly AnalyticsMeasure[] = ["sleepHours", "sleepQuality", "activityMinutes", "waterMl"];

function associationsFor(
  topic: string,
  topicDates: ReadonlySet<string>,
  daily: readonly DailyAnalytics[],
): Association[] {
  const result: Association[] = [];
  for (const measure of MEASURES) {
    const withTopic = daily.filter((day) => topicDates.has(day.date) && day[measure] !== null);
    const without = daily.filter((day) => !topicDates.has(day.date) && day[measure] !== null);
    if (withTopic.length < MIN_VALUES || without.length < MIN_VALUES) continue;
    result.push({
      topic,
      measure,
      daysWithTopic: withTopic.length,
      averageWithTopic: mean(withTopic.map((day) => day[measure]!))!,
      daysWithout: without.length,
      averageWithout: mean(without.map((day) => day[measure]!))!,
      evidenceLogIds: withTopic.flatMap((day) => day.logIds).slice(0, MAX_EVIDENCE),
    });
  }
  return result;
}

/** Groups symptom logs by topic, most frequent first (ties: most recent, then alphabetical). */
function groupByTopic(logs: readonly HealthLog[]): Map<string, HealthLog[]> {
  const groups = new Map<string, HealthLog[]>();
  for (const log of logs.filter(isSymptomEntry)) {
    for (const topic of topicTerms(log)) groups.set(topic, [...(groups.get(topic) ?? []), log]);
  }
  const latest = (group: readonly HealthLog[]) => group.reduce((max, log) => (log.loggedAt > max ? log.loggedAt : max), "");
  return new Map(
    [...groups.entries()].sort(
      ([a, ga], [b, gb]) => gb.length - ga.length || latest(gb).localeCompare(latest(ga)) || a.localeCompare(b),
    ),
  );
}

/** Every figure for GET /api/insights/analytics, over the last `days` calendar days (UTC). */
export function computeAnalytics(
  logs: readonly HealthLog[],
  days: 7 | 14 | 30,
  now: number = Date.now(),
): AnalyticsResponse {
  const windowLogs = logsInWindow(logs, days, now);
  const windowStart = utcDate(now - (days - 1) * DAY_MS);
  const windowEnd = utcDate(now);
  const midpoint = utcDate(now - (Math.ceil(days / 2) - 1) * DAY_MS);

  const daily: DailyAnalytics[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = utcDate(now - offset * DAY_MS);
    daily.push(dailyPoint(date, windowLogs.filter((log) => dateOf(log) === date)));
  }

  const groups = [...groupByTopic(windowLogs).entries()].slice(0, MAX_TOPICS);
  const symptoms = groups.map(([topic, group]) => symptomAnalytics(topic, group, midpoint));
  const associations = groups
    .slice(0, MAX_ASSOCIATION_TOPICS)
    .flatMap(([topic, group]) => associationsFor(topic, new Set(group.map(dateOf)), daily));

  return {
    windowDays: days,
    windowStart,
    windowEnd,
    logCount: windowLogs.length,
    symptomLogCount: windowLogs.filter(isSymptomEntry).length,
    symptoms,
    daily,
    associations,
    note: ANALYTICS_NOTE,
  };
}

const MEASURE_LABEL: Record<AnalyticsMeasure, (value: number) => string> = {
  sleepHours: (value) => `${value} hours of sleep`,
  sleepQuality: (value) => `sleep quality ${value}/5`,
  activityMinutes: (value) => `${value} minutes of activity`,
  waterMl: (value) => `${value} ml of water`,
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Plain sentences stating the recorded figures for one topic. No interpretation. */
export function describeTopic(symptom: SymptomAnalytics, associations: readonly Association[], windowDays: number): string[] {
  const { topic, logCount, dayCount, severity, severityChange, recurrence } = symptom;
  const span =
    recurrence.firstDate === recurrence.lastDate
      ? `on ${recurrence.firstDate}`
      : `between ${recurrence.firstDate} and ${recurrence.lastDate}`;
  const facts = [
    `Logs mentioning "${topic}": ${plural(logCount, "log")} on ${plural(dayCount, "day")} in the last ${windowDays} days, ${span}` +
      (recurrence.episodes > 1
        ? ` (${plural(recurrence.episodes, "separate stretch")} of days; the longest was ${plural(recurrence.longestEpisodeDays, "day")} in a row).`
        : "."),
  ];
  if (severity.recordedCount > 0) {
    facts.push(
      `Recorded pain on those logs: ${severity.lowest === severity.highest ? `${severity.lowest}/10` : `${severity.lowest}–${severity.highest}/10`}` +
        `, average ${severity.average}/10 (${plural(severity.recordedCount, "log")} with a pain level).`,
    );
  }
  if (severityChange.direction !== "not_enough_data") {
    facts.push(
      `Average recorded pain was ${severityChange.earlierAverage}/10 in the first half of this period and ${severityChange.laterAverage}/10 in the second half.`,
    );
  }
  for (const association of associations.filter((a) => a.topic === topic)) {
    const label = MEASURE_LABEL[association.measure];
    facts.push(
      `On days with "${topic}" logged, the average recorded was ${label(association.averageWithTopic)} ` +
        `(${plural(association.daysWithTopic, "day")}), compared with ${label(association.averageWithout)} on other days ` +
        `(${plural(association.daysWithout, "day")}). This shows what was recorded together, not a cause.`,
    );
  }
  return facts;
}

/** At most this many server-written fact sentences per answer. */
export const MAX_RECORDED_FACTS = 6;

/**
 * Recorded facts about the topics in the user's concern (chat), or about every
 * topic when `queryText` is null (weekly summary). Calculated, never model-written.
 */
export function recordedFactsFor(
  logs: readonly HealthLog[],
  queryText: string | null,
  days: 7 | 14 | 30,
  now: number = Date.now(),
): string[] {
  const analytics = computeAnalytics(logs, days, now);
  const queryTerms = queryText === null ? null : extractTerms(stripNegatedPhrases(queryText));
  const symptoms = analytics.symptoms.filter((symptom) => queryTerms === null || queryTerms.has(symptom.topic));
  return symptoms
    .flatMap((symptom) => describeTopic(symptom, analytics.associations, days))
    .slice(0, MAX_RECORDED_FACTS);
}
