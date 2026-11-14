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
  profileSchema,
  type Profile,
  type ProfileUpdateRequest,
} from "../validations/profile.ts";

export const PROFILE_COLUMNS =
  "id,display_name,age,gender,height_cm,weight_kg,conditions,allergies,medications,medical_history";

export const HEALTH_LOG_COLUMNS =
  "id,logged_at,symptoms,pain_location,pain_level,sleep_duration_minutes,sleep_quality,mood,water_ml,activity_minutes,notes";

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
