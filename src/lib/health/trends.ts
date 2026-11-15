// Pure helpers that turn health logs into daily series and plain summary
// figures for charts and the doctor-ready summary. No interpretation: every
// value here is a recorded, user-reported measurement.
import type { HealthLog } from "@/lib/validations";

export const TREND_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DailyPoint = {
  /** Calendar date, YYYY-MM-DD (UTC). */
  date: string;
  /** Highest pain level recorded that day (0–10), or null if none recorded. */
  painLevel: number | null;
  /** Sleep recorded that day in hours (one decimal), or null if none recorded. */
  sleepHours: number | null;
};

const utcDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Logs whose date falls within the last `days` calendar days (UTC), newest first. */
export function logsInWindow(logs: readonly HealthLog[], days: number = TREND_DAYS, now: number = Date.now()): HealthLog[] {
  const first = utcDate(now - (days - 1) * DAY_MS);
  const last = utcDate(now);
  return logs
    .filter((log) => {
      const date = log.loggedAt.slice(0, 10);
      return date >= first && date <= last;
    })
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

/** One point per calendar day, oldest first; days without a measurement stay null (never invented). */
export function dailySeries(logs: readonly HealthLog[], days: number = TREND_DAYS, now: number = Date.now()): DailyPoint[] {
  const points: DailyPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = utcDate(now - offset * DAY_MS);
    const sameDay = logs.filter((log) => log.loggedAt.slice(0, 10) === date);
    const pains = sameDay.map((log) => log.painLevel).filter((value): value is number => value !== null);
    const sleeps = sameDay.map((log) => log.sleepDurationMinutes).filter((value): value is number => value !== null);
    points.push({
      date,
      painLevel: pains.length ? Math.max(...pains) : null,
      sleepHours: sleeps.length ? Math.round((Math.max(...sleeps) / 60) * 10) / 10 : null,
    });
  }
  return points;
}

export type SummaryFigures = {
  logCount: number;
  /** Average recorded sleep in hours (one decimal), or null if no sleep was recorded. */
  averageSleepHours: number | null;
  /** Days in the window with any pain level recorded. */
  daysWithPainRecorded: number;
  highestPain: { level: number; date: string } | null;
};

export function summaryFigures(windowLogs: readonly HealthLog[]): SummaryFigures {
  const sleeps = windowLogs.map((log) => log.sleepDurationMinutes).filter((value): value is number => value !== null);
  const pains = windowLogs.filter((log): log is HealthLog & { painLevel: number } => log.painLevel !== null);
  const highest = pains.reduce<(HealthLog & { painLevel: number }) | null>(
    (best, log) => (!best || log.painLevel > best.painLevel ? log : best),
    null,
  );
  return {
    logCount: windowLogs.length,
    averageSleepHours: sleeps.length
      ? Math.round((sleeps.reduce((sum, value) => sum + value, 0) / sleeps.length / 60) * 10) / 10
      : null,
    daysWithPainRecorded: new Set(pains.map((log) => log.loggedAt.slice(0, 10))).size,
    highestPain: highest ? { level: highest.painLevel, date: highest.loggedAt.slice(0, 10) } : null,
  };
}

/** Logs whose symptom text is not a "nothing reported" placeholder. */
export const isSymptomEntry = (log: HealthLog): boolean => !/^no (specific )?symptoms?( reported)?\.?$/i.test(log.symptoms.trim());

export type RecurringSymptom = { symptom: string; count: number; firstDate: string; lastDate: string };

/**
 * Symptom descriptions recorded more than once in the window, most frequent first.
 * Grouped by exact text (case-insensitive) so nothing is merged by guesswork.
 */
export function recurringSymptoms(windowLogs: readonly HealthLog[]): RecurringSymptom[] {
  const groups = new Map<string, HealthLog[]>();
  for (const log of windowLogs.filter(isSymptomEntry)) {
    const key = log.symptoms.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const dates = group.map((log) => log.loggedAt.slice(0, 10)).sort();
      return { symptom: group[0]!.symptoms.trim(), count: group.length, firstDate: dates[0]!, lastDate: dates[dates.length - 1]! };
    })
    .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
}
