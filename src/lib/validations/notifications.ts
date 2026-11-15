import { z } from "zod";

// Medicine-reminder notifications (contract §3f). A medication reminder creates a
// "dose" each time it becomes due. The user is notified up to 3 times, 5 minutes
// apart, until they confirm they took it; then the dose is "missed" but can still
// be confirmed until 1 hour after it was due. MediMate only repeats the user's own
// reminder wording and never advises on medicines, timing or doses.

export const DOSE_STATUSES = ["pending", "taken", "missed"] as const;
export const MAX_DOSE_NOTIFICATIONS = 3;
export const DOSE_NOTIFICATION_GAP_MINUTES = 5;
export const DOSE_CONFIRM_WINDOW_MINUTES = 60;

/** One due occurrence of a medication reminder. */
export const reminderDoseSchema = z.strictObject({
  id: z.uuid(),
  reminderId: z.uuid(),
  title: z.string(),
  dueAt: z.iso.datetime({ offset: true }),
  status: z.enum(DOSE_STATUSES),
  /** How many notifications have been sent so far (0–3). */
  notificationsSent: z.number().int().min(0).max(MAX_DOSE_NOTIFICATIONS),
  confirmedAt: z.iso.datetime({ offset: true }).nullable(),
  /** Last moment the dose can be confirmed (dueAt + 1 hour). */
  confirmBy: z.iso.datetime({ offset: true }),
  /** True while the dose is pending or missed and confirmBy has not passed. */
  canConfirm: z.boolean(),
});

export const doseIdSchema = z.uuid();

/** GET /api/reminders/doses?hours=24 */
export const doseListQuerySchema = z.strictObject({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

/** GET /api/reminders/doses response, newest first (max 50). */
export const doseListResponseSchema = z.strictObject({
  doses: z.array(reminderDoseSchema),
});

/** POST /api/reminders/doses/{id}/confirm response. */
export const doseResponseSchema = z.strictObject({
  dose: reminderDoseSchema,
});

/** GET /api/notifications/config response. */
export const notificationConfigSchema = z.strictObject({
  /** Web push is set up on the server; the browser may subscribe with vapidPublicKey. */
  pushAvailable: z.boolean(),
  vapidPublicKey: z.string().nullable(),
  /** Email is set up on the server (used when no device is subscribed or push fails). */
  emailAvailable: z.boolean(),
  /** Devices this user has subscribed (any browser). */
  subscribedDevices: z.number().int().min(0),
});

/** A browser PushSubscription, as `subscription.toJSON()` returns it. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** POST (201) and DELETE (200) /api/notifications/subscriptions response. */
export const pushSubscriptionResultSchema = z.strictObject({
  subscribed: z.boolean(),
});

/** DELETE /api/notifications/subscriptions body. */
export const pushUnsubscribeSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
});

/**
 * POST /api/notifications/dispatch body. Sent only by the database job
 * (migration 0006) with the shared secret; never called by the browser.
 */
export const dispatchRequestSchema = z.strictObject({
  notifications: z
    .array(
      z.strictObject({
        doseId: z.uuid(),
        title: z.string().min(1).max(120),
        notes: z.string().max(500).nullable(),
        dueAt: z.iso.datetime({ offset: true }),
        attempt: z.number().int().min(1).max(MAX_DOSE_NOTIFICATIONS),
        email: z.email().max(320).nullable(),
        subscriptions: z
          .array(
            z.strictObject({
              endpoint: z.url({ protocol: /^https$/ }).max(1000),
              p256dh: z.string().min(1).max(200),
              auth: z.string().min(1).max(100),
            }),
          )
          .max(10),
      }),
    )
    .max(200),
});

/** The JSON payload inside each web push (read by public/sw.js). */
export const pushPayloadSchema = z.strictObject({
  type: z.literal("medication-reminder"),
  doseId: z.uuid(),
  title: z.string(),
  body: z.string(),
  attempt: z.number().int(),
  url: z.string(),
});

export type DoseStatus = (typeof DOSE_STATUSES)[number];
export type ReminderDose = z.infer<typeof reminderDoseSchema>;
export type DoseListResponse = z.infer<typeof doseListResponseSchema>;
export type DoseResponse = z.infer<typeof doseResponseSchema>;
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type PushSubscriptionResult = z.infer<typeof pushSubscriptionResultSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type DispatchRequest = z.infer<typeof dispatchRequestSchema>;
export type PushPayload = z.infer<typeof pushPayloadSchema>;
