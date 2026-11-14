import { z } from "zod";

/** Fixed synthetic demo profile (matches supabase/migrations + seed.sql RLS). */
export const DEMO_PROFILE_ID = "00000000-0000-4000-8000-000000000001";

const shortText = z.string().trim().max(200);
const textList = z.array(z.string().trim().min(1).max(200)).max(30);

/** Fields a user may edit. Ranges mirror the database CHECK constraints. */
const editableProfileFields = {
  displayName: z.string().trim().min(1).max(100),
  age: z.int().min(1).max(120),
  // Optional; must never be used for unsupported inferences.
  gender: shortText.nullable(),
  heightCm: z.number().min(30).max(260).nullable(),
  weightKg: z.number().min(1).max(500).nullable(),
  conditions: textList,
  allergies: textList,
  // Free-text entries such as "Ibuprofen 200 mg as needed" (stored as a JSONB array).
  medications: textList,
  medicalHistory: z.string().trim().max(4000),
};

export const profileSchema = z.strictObject({
  id: z.uuid(),
  ...editableProfileFields,
});

/** GET /api/profile and PATCH /api/profile response. */
export const profileResponseSchema = z.strictObject({
  profile: profileSchema,
});

/** PATCH /api/profile body: any subset of editable fields, at least one. Unknown keys (e.g. id) are rejected. */
export const profileUpdateSchema = z
  .strictObject(editableProfileFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one profile field to update.",
  });

export type Profile = z.infer<typeof profileSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;
