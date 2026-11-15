import { z } from "zod";

/** GET /api/insights/analytics (docs/API_CONTRACTS.md §3e). Deterministic: no AI involved. */
export const ANALYTICS_WINDOWS = [7, 14, 30] as const;

export const ANALYTICS_NOTE =
  "Calculated from your own logs. Figures show what was recorded together, not causes, and are not a diagnosis.";

export const analyticsQuerySchema = z.strictObject({
  days: z.coerce
    .number()
    .int()
    .refine((value) => (ANALYTICS_WINDOWS as readonly number[]).includes(value), "days must be 7, 14 or 30.")
    .default(30),
});

const date = z.iso.date();
const average = z.number().min(0).nullable();
const logIds = z.array(z.uuid()).max(30);

export const analyticsMeasureSchema = z.enum(["sleepHours", "sleepQuality", "activityMinutes", "waterMl"]);

export const symptomAnalyticsSchema = z.strictObject({
  /** A symptom or body-area keyword from the user's own log text, e.g. "back" or "head". */
  topic: z.string().min(1).max(40),
  logCount: z.int().min(1),
  dayCount: z.int().min(1),
  /** Recorded pain levels (0–10) on logs with this topic; null fields when none were recorded. */
  severity: z.strictObject({
    recordedCount: z.int().min(0),
    average: average,
    lowest: z.int().min(0).max(10).nullable(),
    highest: z.int().min(0).max(10).nullable(),
  }),
  /** First half of the window vs second half; needs at least 2 recorded pain levels in each half. */
  severityChange: z.strictObject({
    earlierAverage: average,
    laterAverage: average,
    direction: z.enum(["higher", "lower", "about_the_same", "not_enough_data"]),
  }),
  /** An episode is a run of consecutive calendar days with this topic logged. */
  recurrence: z.strictObject({
    episodes: z.int().min(1),
    longestEpisodeDays: z.int().min(1),
    firstDate: date,
    lastDate: date,
  }),
  evidenceLogIds: logIds,
});

export const dailyAnalyticsSchema = z.strictObject({
  date,
  /** Highest pain recorded that day, or null. Never interpolated. */
  painLevel: z.int().min(0).max(10).nullable(),
  sleepHours: z.number().min(0).nullable(),
  sleepQuality: z.number().min(1).max(5).nullable(),
  waterMl: z.number().min(0).nullable(),
  activityMinutes: z.number().min(0).nullable(),
  logIds,
});

/** Average of a measure on days with the topic vs other days. Association only, never a cause. */
export const associationSchema = z.strictObject({
  topic: z.string().min(1).max(40),
  measure: analyticsMeasureSchema,
  daysWithTopic: z.int().min(2),
  averageWithTopic: z.number().min(0),
  daysWithout: z.int().min(2),
  averageWithout: z.number().min(0),
  evidenceLogIds: logIds,
});

export const analyticsResponseSchema = z.strictObject({
  windowDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  windowStart: date,
  windowEnd: date,
  logCount: z.int().min(0),
  symptomLogCount: z.int().min(0),
  /** Most frequent first, at most 8. */
  symptoms: z.array(symptomAnalyticsSchema).max(8),
  /** One entry per calendar day, oldest first. */
  daily: z.array(dailyAnalyticsSchema).max(30),
  associations: z.array(associationSchema).max(32),
  note: z.literal(ANALYTICS_NOTE),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type AnalyticsMeasure = z.infer<typeof analyticsMeasureSchema>;
export type SymptomAnalytics = z.infer<typeof symptomAnalyticsSchema>;
export type DailyAnalytics = z.infer<typeof dailyAnalyticsSchema>;
export type Association = z.infer<typeof associationSchema>;
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
