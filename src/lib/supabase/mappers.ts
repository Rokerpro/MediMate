// Pure mapping between database rows (snake_case) and the API contract (camelCase).
// No I/O here, so it is unit-tested directly in tests/supabase-mappers.test.ts.
// Relative `.ts` imports keep this file runnable under `node --test`.
import { z } from "zod";

import {
  healthLogSchema,
  type HealthLog,
  type HealthLogCreateRequest,
} from "../validations/health-log.ts";
import {
  reminderSchema,
  type Reminder,
  type ReminderCreateRequest,
  type ReminderUpdateRequest,
} from "../validations/reminder.ts";
import { nextDueAt } from "../reminders/schedule.ts";
import { assessmentSchema, safetyLevelSchema } from "../validations/assistant.ts";
import { pastAssessmentSchema, type PastAssessment } from "../validations/assessment-history.ts";
import {
  profileSchema,
  type Profile,
  type ProfileUpdateRequest,
} from "../validations/profile.ts";

export const PROFILE_COLUMNS =
  "id,display_name,age,gender,height_cm,weight_kg,conditions,allergies,medications,medical_history";

export const HEALTH_LOG_COLUMNS =
  "id,logged_at,symptoms,pain_location,pain_level,sleep_duration_minutes,sleep_quality,mood,water_ml,activity_minutes,notes";

export const REMINDER_COLUMNS = "id,title,category,notes,remind_at,repeat,active,created_at";

export const PAST_ASSESSMENT_COLUMNS = "id,initial_symptom,assessment,urgency_level,created_at,updated_at";

// Postgres `numeric` can arrive as a number or a numeric string depending on settings.
const numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);

const profileRowSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  age: z.number(),
  gender: z.string().nullable(),
  height_cm: numeric.nullable(),
  weight_kg: numeric.nullable(),
  conditions: z.array(z.string()),
  allergies: z.array(z.string()),
  medications: z.array(z.string()),
  medical_history: z.string().nullable(),
});

const healthLogRowSchema = z.object({
  id: z.string(),
  logged_at: z.string(),
  symptoms: z.string(),
  pain_location: z.string().nullable(),
  pain_level: z.number().nullable(),
  sleep_duration_minutes: z.number().nullable(),
  sleep_quality: z.number().nullable(),
  mood: z.string().nullable(),
  water_ml: z.number().nullable(),
  activity_minutes: z.number().nullable(),
  notes: z.string().nullable(),
});

const reminderRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  notes: z.string().nullable(),
  remind_at: z.string(),
  repeat: z.string(),
  active: z.boolean(),
  created_at: z.string(),
});

/** First element of a PostgREST array response, or undefined. */
export function firstRow(rows: unknown): unknown {
  return Array.isArray(rows) ? rows[0] : undefined;
}

/** DB row -> contract Profile. Throws if the row does not satisfy the contract. */
export function rowToProfile(row: unknown): Profile {
  const r = profileRowSchema.parse(row);
  return profileSchema.parse({
    id: r.id,
    displayName: r.display_name,
    age: r.age,
    gender: r.gender,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    conditions: r.conditions,
    allergies: r.allergies,
    medications: r.medications,
    medicalHistory: r.medical_history ?? "",
  });
}

/** DB row -> contract HealthLog, with `loggedAt` normalized to UTC ISO (`...Z`). */
export function rowToHealthLog(row: unknown): HealthLog {
  const r = healthLogRowSchema.parse(row);
  return healthLogSchema.parse({
    id: r.id,
    loggedAt: new Date(r.logged_at).toISOString(),
    symptoms: r.symptoms,
    painLocation: r.pain_location,
    painLevel: r.pain_level,
    sleepDurationMinutes: r.sleep_duration_minutes,
    sleepQuality: r.sleep_quality,
    mood: r.mood,
    waterMl: r.water_ml,
    activityMinutes: r.activity_minutes,
    notes: r.notes,
  });
}

const blankToNull = (value: string | null): string | null =>
  value === null || value.trim() === "" ? null : value;

/** Validated PATCH body -> DB update payload. Only provided fields are written. */
export function profileUpdateToRow(
  update: ProfileUpdateRequest,
  now: Date = new Date(),
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (update.displayName !== undefined) row.display_name = update.displayName;
  if (update.age !== undefined) row.age = update.age;
  if (update.gender !== undefined) row.gender = blankToNull(update.gender);
  if (update.heightCm !== undefined) row.height_cm = update.heightCm;
  if (update.weightKg !== undefined) row.weight_kg = update.weightKg;
  if (update.conditions !== undefined) row.conditions = update.conditions;
  if (update.allergies !== undefined) row.allergies = update.allergies;
  if (update.medications !== undefined) row.medications = update.medications;
  if (update.medicalHistory !== undefined) row.medical_history = update.medicalHistory;
  row.updated_at = now.toISOString();
  return row;
}

/**
 * Validated POST body -> DB insert payload. `profileId` always comes from the
 * server (DEMO_PROFILE_ID), never from the client. Omitted `loggedAt` lets the
 * database default to now().
 */
export function healthLogCreateToRow(
  input: HealthLogCreateRequest,
  profileId: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    profile_id: profileId,
    symptoms: input.symptoms,
  };
  if (input.loggedAt !== undefined) row.logged_at = input.loggedAt;
  if (input.painLocation !== undefined) row.pain_location = blankToNull(input.painLocation);
  if (input.painLevel !== undefined) row.pain_level = input.painLevel;
  if (input.sleepDurationMinutes !== undefined) row.sleep_duration_minutes = input.sleepDurationMinutes;
  if (input.sleepQuality !== undefined) row.sleep_quality = input.sleepQuality;
  if (input.mood !== undefined) row.mood = blankToNull(input.mood);
  if (input.waterMl !== undefined) row.water_ml = input.waterMl;
  if (input.activityMinutes !== undefined) row.activity_minutes = input.activityMinutes;
  if (input.notes !== undefined) row.notes = blankToNull(input.notes);
  return row;
}

/** DB row -> contract Reminder, with `nextDueAt` computed for `now`. Timestamps normalized to UTC ISO. */
export function rowToReminder(row: unknown, now: number = Date.now()): Reminder {
  const r = reminderRowSchema.parse(row);
  const remindAt = new Date(r.remind_at).getTime();
  const parsedRepeat = reminderSchema.shape.repeat.parse(r.repeat);
  const due = nextDueAt(remindAt, parsedRepeat, r.active, now);
  return reminderSchema.parse({
    id: r.id,
    title: r.title,
    category: r.category,
    notes: r.notes,
    remindAt: new Date(remindAt).toISOString(),
    repeat: parsedRepeat,
    active: r.active,
    nextDueAt: due === null ? null : new Date(due).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
  });
}

/** Active reminders by next due time, then inactive ones by remindAt. */
export function sortReminders(reminders: readonly Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.nextDueAt ?? a.remindAt).localeCompare(b.nextDueAt ?? b.remindAt);
  });
}

/** Validated POST body -> DB insert payload. `profileId` comes from the server only. */
export function reminderCreateToRow(input: ReminderCreateRequest, profileId: string): Record<string, unknown> {
  return {
    profile_id: profileId,
    title: input.title,
    category: input.category,
    notes: input.notes === undefined ? null : blankToNull(input.notes),
    remind_at: input.remindAt,
    repeat: input.repeat,
  };
}

/** Validated PATCH body -> DB update payload. Only provided fields are written. */
export function reminderUpdateToRow(update: ReminderUpdateRequest, now: Date = new Date()): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (update.title !== undefined) row.title = update.title;
  if (update.category !== undefined) row.category = update.category;
  if (update.notes !== undefined) row.notes = blankToNull(update.notes);
  if (update.remindAt !== undefined) row.remind_at = update.remindAt;
  if (update.repeat !== undefined) row.repeat = update.repeat;
  if (update.active !== undefined) row.active = update.active;
  row.updated_at = now.toISOString();
  return row;
}

const sessionRowSchema = z.object({
  id: z.string(),
  initial_symptom: z.string(),
  assessment: z.unknown(),
  urgency_level: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Completed symptom_sessions row -> contract PastAssessment.
 * A stored assessment that no longer matches the contract becomes null rather
 * than being shown unvalidated. A missing urgency level is treated as routine.
 */
export function rowToPastAssessment(row: unknown): PastAssessment {
  const r = sessionRowSchema.parse(row);
  const assessment = r.assessment === null ? null : assessmentSchema.safeParse(r.assessment);
  const urgency = safetyLevelSchema.safeParse(r.urgency_level);
  return pastAssessmentSchema.parse({
    sessionId: r.id,
    startedAt: new Date(r.created_at).toISOString(),
    completedAt: new Date(r.updated_at).toISOString(),
    initialConcern: r.initial_symptom,
    urgencyLevel: urgency.success ? urgency.data : "routine",
    assessment: assessment?.success && urgency.data !== "urgent" ? assessment.data : null,
  });
}
