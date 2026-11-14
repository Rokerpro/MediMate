import { z } from "zod";

// Reminders are created and confirmed by the user. MediMate stores the user's own
// wording and never generates, suggests or checks reminder content, timing or doses.

export const REMINDER_CATEGORIES = ["medication", "appointment", "health_log", "other"] as const;
export const REMINDER_REPEATS = ["none", "daily", "weekly"] as const;

const reminderFields = {
  title: z.string().trim().min(1).max(120),
  category: z.enum(REMINDER_CATEGORIES),
  notes: z.string().trim().max(500).nullable(),
  /** First (or only) time the reminder is due, ISO 8601 with offset. */
  remindAt: z.iso.datetime({ offset: true }),
  repeat: z.enum(REMINDER_REPEATS),
  active: z.boolean(),
};

export const reminderSchema = z.strictObject({
  id: z.uuid(),
  ...reminderFields,
  /** Next time the reminder is due (UTC ISO). Equals remindAt for one-off reminders, even if past; null when inactive. */
  nextDueAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const reminderIdSchema = z.uuid();

/** GET /api/reminders?includeInactive=false */
export const reminderListQuerySchema = z.strictObject({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

/** GET /api/reminders response, ordered by nextDueAt (inactive last). */
export const reminderListResponseSchema = z.strictObject({
  reminders: z.array(reminderSchema),
});

/**
 * POST /api/reminders body. `userConfirmed: true` is required: a reminder is only
 * saved after the user has reviewed and confirmed it in the UI.
 */
export const reminderCreateSchema = z.strictObject({
  title: reminderFields.title,
  category: reminderFields.category.default("other"),
  notes: reminderFields.notes.optional(),
  remindAt: reminderFields.remindAt,
  repeat: reminderFields.repeat.default("none"),
  userConfirmed: z.literal(true, { error: "The user must confirm the reminder before it is saved." }),
});

/** PATCH /api/reminders/{id} body: any subset of fields, at least one. */
export const reminderUpdateSchema = z
  .strictObject({
    title: reminderFields.title.optional(),
    category: reminderFields.category.optional(),
    notes: reminderFields.notes.optional(),
    remindAt: reminderFields.remindAt.optional(),
    repeat: reminderFields.repeat.optional(),
    active: reminderFields.active.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one reminder field to update.",
  });

/** POST (201) and PATCH (200) response. DELETE returns 204 with no body. */
export const reminderResponseSchema = z.strictObject({
  reminder: reminderSchema,
});

export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number];
export type ReminderRepeat = (typeof REMINDER_REPEATS)[number];
export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderListQuery = z.infer<typeof reminderListQuerySchema>;
export type ReminderListResponse = z.infer<typeof reminderListResponseSchema>;
export type ReminderCreateRequest = z.infer<typeof reminderCreateSchema>;
export type ReminderUpdateRequest = z.infer<typeof reminderUpdateSchema>;
export type ReminderResponse = z.infer<typeof reminderResponseSchema>;
