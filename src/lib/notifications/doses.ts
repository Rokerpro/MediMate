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

/** Escapes user text for HTML email bodies. */
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export type ReminderEmail = { subject: string; text: string; html: string };

const SAFETY_LINE =
  "MediMate only repeats the reminder you wrote. It does not give advice about medicines or doses; ask your pharmacist or doctor if you are unsure.";
const STOP_LINE = "To stop these emails, pause or delete the reminder in MediMate.";

/**
 * Email for when no device is subscribed or every push failed: a minimal HTML
 * version (inline styles, table layout, for email clients) plus plain text.
 * User text is escaped; the only link is the dose's own confirm page.
 */
export function buildEmail(notification: Notification, origin: string): ReminderEmail {
  const link = `${origin}${dosePath(notification.doseId)}`;
  const title = oneLine(notification.title);
  const notes = notification.notes ? oneLine(notification.notes) : null;
  // Relative, so it reads right in any time zone (the server does not know the user's).
  const minutesLate = (notification.attempt - 1) * 5;
  const due = minutesLate === 0 ? "due now" : `due ${minutesLate} minutes ago`;
  const last = notification.attempt >= MAX_DOSE_NOTIFICATIONS;
  const counter = `Reminder ${notification.attempt} of ${MAX_DOSE_NOTIFICATIONS}`;
  const nextLine = last
    ? "This is the last reminder for this dose. After this it will be marked as missed; you can still confirm it for up to an hour after it was due."
    : `You will be reminded again in 5 minutes (up to ${MAX_DOSE_NOTIFICATIONS} times) until you confirm.`;

  const text = [
    `This is the medicine reminder you set in MediMate: "${title}" (${due}).`,
    notes ? `Your note: ${notes}` : null,
    "",
    `Confirm you have taken it: ${link}`,
    "",
    nextLine,
    "",
    SAFETY_LINE,
    STOP_LINE,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(`Medicine reminder: ${title}`)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f5ed;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(`${title}: ${due}. Tap to confirm once you have taken it.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5ed;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e5da;border-radius:16px;">
<tr><td style="padding:28px 28px 0;${font}">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.04em;color:#254a38;">MediMate</p>
<p style="margin:20px 0 4px;font-size:13px;color:#6b776f;">${escapeHtml(`Medicine reminder · ${counter} · ${due}`)}</p>
<h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;color:#243b30;">${escapeHtml(title)}</h1>
${notes ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#40564a;">${escapeHtml(notes)}</p>` : ""}
</td></tr>
<tr><td style="padding:24px 28px;${font}">
<a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#254a38;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">I took it</a>
<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#5b6b61;">${escapeHtml(nextLine)}</p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #eef0e8;${font}">
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b776f;">${escapeHtml(SAFETY_LINE)}</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#6b776f;">${escapeHtml(STOP_LINE)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: `Medicine reminder: ${title}`.slice(0, 160), text, html };
}

export type PushTarget = Notification["subscriptions"][number];
/** Sends one web push. `gone` = the push service says this device no longer exists (404/410). */
export type PushSender = (target: PushTarget, payload: string) => Promise<{ ok: boolean; gone: boolean }>;
/** Sends one email; true when the mail server accepted it. */
export type EmailSender = (to: string, email: ReminderEmail) => Promise<boolean>;

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
        delivered = await sendEmail(notification.email, buildEmail(notification, origin)).catch(() => false);
        if (delivered) result.emailed += 1;
      }
      if (!delivered) result.failed += 1;
    }),
  );
  return result;
}
