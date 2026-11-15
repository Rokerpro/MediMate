// Pure helpers for medicine-reminder doses and notification wording (contract §3f).
// No I/O here so it can be unit-tested. The wording only repeats the user's own
// reminder text: no advice about medicines, timing or doses.
import { z } from "zod";

import {
  DOSE_CONFIRM_WINDOW_MINUTES,
  DOSE_STATUSES,
  MAX_DOSE_NOTIFICATIONS,
  reminderDoseSchema,
  type DispatchRequest,
  type PushPayload,
  type ReminderDose,
} from "../validations/notifications.ts";

/** PostgREST select for a dose with its reminder title. */
export const DOSE_COLUMNS = "id,reminder_id,due_at,status,notify_count,confirmed_at,reminders(title)";

const doseRowSchema = z.object({
  id: z.string(),
  reminder_id: z.string(),
  due_at: z.string(),
  status: z.enum(DOSE_STATUSES),
  notify_count: z.number(),
  confirmed_at: z.string().nullable(),
  reminders: z.object({ title: z.string() }).nullable(),
});

const iso = (value: string | number): string => new Date(value).toISOString();

/** DB row -> contract ReminderDose, with confirmBy/canConfirm computed for `now`. */
export function rowToDose(row: unknown, now: number = Date.now()): ReminderDose {
  const r = doseRowSchema.parse(row);
  const dueMs = new Date(r.due_at).getTime();
  const confirmByMs = dueMs + DOSE_CONFIRM_WINDOW_MINUTES * 60_000;
  return reminderDoseSchema.parse({
    id: r.id,
    reminderId: r.reminder_id,
    title: r.reminders?.title ?? "Medicine reminder",
    dueAt: iso(dueMs),
    status: r.status,
    notificationsSent: Math.min(Math.max(r.notify_count, 0), MAX_DOSE_NOTIFICATIONS),
    confirmedAt: r.confirmed_at === null ? null : iso(r.confirmed_at),
    confirmBy: iso(confirmByMs),
    canConfirm: r.status !== "taken" && now <= confirmByMs,
  });
}

type Notification = DispatchRequest["notifications"][number];

/** Single line, no control characters (safe for email subjects and notification titles). */
export const oneLine = (text: string): string => text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

/** Page that shows the dose with a "I took it" confirm button. */
export const dosePath = (doseId: string): string => `/reminders?dose=${encodeURIComponent(doseId)}`;

function reminderLine(notification: Notification): string {
  const last = notification.attempt >= MAX_DOSE_NOTIFICATIONS;
  const prefix = notification.attempt > 1 ? `Reminder ${notification.attempt} of ${MAX_DOSE_NOTIFICATIONS}. ` : "";
  return `${prefix}Tap to confirm once you have taken it.${last ? " After this it will be marked as missed; you can still confirm it for up to an hour after it was due." : ""}`;
}

/** The JSON sent inside a web push; public/sw.js turns it into a notification. */
export function buildPushPayload(notification: Notification): PushPayload {
  const notes = notification.notes ? `${oneLine(notification.notes)}\n` : "";
  return {
    type: "medication-reminder",
    doseId: notification.doseId,
    title: oneLine(notification.title),
    body: `${notes}${reminderLine(notification)}`.slice(0, 400),
    attempt: notification.attempt,
    url: dosePath(notification.doseId),
  };
}

/** Plain-text email for when no device is subscribed or every push failed. */
export function buildEmail(notification: Notification, origin: string): { subject: string; text: string } {
  const link = `${origin}${dosePath(notification.doseId)}`;
  const due = new Date(notification.dueAt).toISOString().replace("T", " ").slice(0, 16);
  return {
    subject: `Medicine reminder: ${oneLine(notification.title)}`.slice(0, 160),
    text: [
      `This is the medicine reminder you set in MediMate: "${oneLine(notification.title)}" (due ${due} UTC).`,
      notification.notes ? `Your note: ${oneLine(notification.notes)}` : null,
      "",
      `Confirm you have taken it: ${link}`,
      "",
      notification.attempt >= MAX_DOSE_NOTIFICATIONS
        ? "This is the last reminder for this dose. After this it will be marked as missed; you can still confirm it for up to an hour after it was due."
        : `You will be reminded again in 5 minutes (up to ${MAX_DOSE_NOTIFICATIONS} times) until you confirm.`,
      "",
      "MediMate only repeats the reminder you wrote. It does not give advice about medicines or doses; ask your pharmacist or doctor if you are unsure.",
      "To stop these emails, pause or delete the reminder in MediMate.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  };
}

export type PushTarget = Notification["subscriptions"][number];
/** Sends one web push. `gone` = the push service says this device no longer exists (404/410). */
export type PushSender = (target: PushTarget, payload: string) => Promise<{ ok: boolean; gone: boolean }>;
/** Sends one email; true when the mail server accepted it. */
export type EmailSender = (to: string, subject: string, text: string) => Promise<boolean>;

export type DispatchResult = {
  /** Notifications delivered to at least one device. */
  pushed: number;
  /** Notifications sent by email (no device, or every push failed). */
  emailed: number;
  /** Notifications that reached nobody. */
  failed: number;
  /** Devices to forget. */
  goneEndpoints: string[];
};

/**
 * Push to every subscribed device; if none is subscribed or every push failed,
 * fall back to email. A sender of null means that channel is not configured.
 * Senders must not throw; any throw is counted as a failure.
 */
export async function dispatchNotifications(
  request: DispatchRequest,
  { sendPush, sendEmail, origin }: { sendPush: PushSender | null; sendEmail: EmailSender | null; origin: string },
): Promise<DispatchResult> {
  const result: DispatchResult = { pushed: 0, emailed: 0, failed: 0, goneEndpoints: [] };

  await Promise.all(
    request.notifications.map(async (notification) => {
      let delivered = false;
      if (sendPush && notification.subscriptions.length > 0) {
        const payload = JSON.stringify(buildPushPayload(notification));
        const outcomes = await Promise.all(
          notification.subscriptions.map((target) =>
            sendPush(target, payload).catch(() => ({ ok: false, gone: false })),
          ),
        );
        outcomes.forEach((outcome, index) => {
          if (outcome.gone) result.goneEndpoints.push(notification.subscriptions[index]!.endpoint);
        });
        delivered = outcomes.some((outcome) => outcome.ok);
        if (delivered) result.pushed += 1;
      }
      if (!delivered && sendEmail && notification.email) {
        const { subject, text } = buildEmail(notification, origin);
        delivered = await sendEmail(notification.email, subject, text).catch(() => false);
        if (delivered) result.emailed += 1;
      }
      if (!delivered) result.failed += 1;
    }),
  );
  return result;
}
