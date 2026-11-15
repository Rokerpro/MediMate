import "server-only";

import nodemailer from "nodemailer";
import webpush from "web-push";

import type { EmailSender, PushSender } from "./doses";

// Real senders for medicine-reminder notifications. Keys come from server-only
// env vars and are never sent to the browser (except the VAPID *public* key,
// which browsers need to subscribe). Errors are reduced to a status; provider
// bodies, addresses and reminder text are never logged.

const PUSH_TTL_SECONDS = 5 * 60;

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/** VAPID keys for web push, or null when not configured. */
export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

function gmailConfig(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  return user && pass ? { user, pass } : null;
}

export const emailConfigured = (): boolean => gmailConfig() !== null;

export function createPushSender(): PushSender | null {
  const config = vapidConfig();
  if (!config) return null;
  return async (target, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        {
          vapidDetails: config,
          TTL: PUSH_TTL_SECONDS,
          urgency: "high",
          timeout: 8000,
        },
      );
      return { ok: true, gone: false };
    } catch (error) {
      const status = error instanceof webpush.WebPushError ? error.statusCode : 0;
      console.error(`[notifications] push failed (${status || "network"})`);
      return { ok: false, gone: status === 404 || status === 410 };
    }
  };
}

export function createEmailSender(): EmailSender | null {
  const config = gmailConfig();
  if (!config) return null;
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });
  return async (to, { subject, text, html }) => {
    try {
      await transport.sendMail({ from: `MediMate reminders <${config.user}>`, to, subject, text, html });
      return true;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code).slice(0, 32) : "unknown";
      console.error(`[notifications] email failed (${code})`);
      return false;
    }
  };
}
