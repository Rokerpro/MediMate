import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable();

/** Log fields shared by responses and create requests. Ranges mirror DB CHECK constraints. */
const healthLogFields = {
  loggedAt: z.iso.datetime({ offset: true }),
  symptoms: z.string().trim().min(1).max(1000),
  painLocation: optionalText(200),
  painLevel: z.int().min(0).max(10).nullable(),
  sleepDurationMinutes: z.int().min(0).max(1440).nullable(),
  sleepQuality: z.int().min(1).max(5).nullable(),
  mood: optionalText(100),
  waterMl: z.int().min(0).max(20000).nullable(),
  activityMinutes: z.int().min(0).max(1440).nullable(),
  notes: optionalText(2000),
};

export const healthLogSchema = z.strictObject({
  id: z.uuid(),
  ...healthLogFields,
});

/** GET /api/health-logs?limit=30 query. */
export const healthLogListQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** GET /api/health-logs response (newest first). */
export const healthLogListResponseSchema = z.strictObject({
  logs: z.array(healthLogSchema),
});

/**
 * POST /api/health-logs body. `symptoms` is required; every other field may be
 * omitted or null. `loggedAt` defaults to the server's current time when omitted.
 */
export const healthLogCreateSchema = z.strictObject({
  symptoms: healthLogFields.symptoms,
  loggedAt: healthLogFields.loggedAt.optional(),
  painLocation: healthLogFields.painLocation.optional(),
  painLevel: healthLogFields.painLevel.optional(),
  sleepDurationMinutes: healthLogFields.sleepDurationMinutes.optional(),
  sleepQuality: healthLogFields.sleepQuality.optional(),
  mood: healthLogFields.mood.optional(),
  waterMl: healthLogFields.waterMl.optional(),
  activityMinutes: healthLogFields.activityMinutes.optional(),
  notes: healthLogFields.notes.optional(),
});

/** POST /api/health-logs response (HTTP 201). */
export const healthLogCreateResponseSchema = z.strictObject({
  log: healthLogSchema,
});

export type HealthLog = z.infer<typeof healthLogSchema>;
export type HealthLogListQuery = z.infer<typeof healthLogListQuerySchema>;
export type HealthLogListResponse = z.infer<typeof healthLogListResponseSchema>;
export type HealthLogCreateRequest = z.infer<typeof healthLogCreateSchema>;
export type HealthLogCreateResponse = z.infer<typeof healthLogCreateResponseSchema>;
