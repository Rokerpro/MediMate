// Medicine-reminder notifications (contract §3f). Synthetic data only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildEmail,
  buildPushPayload,
  dispatchNotifications,
  oneLine,
  rowToDose,
  type PushSender,
} from "../src/lib/notifications/doses.ts";
import {
  dispatchRequestSchema,
  doseListQuerySchema,
  notificationConfigSchema,
  pushPayloadSchema,
  pushSubscriptionSchema,
  type DispatchRequest,
} from "../src/lib/validations/notifications.ts";

const DOSE = "00000000-0000-4000-8000-0000000000d1";
const REMINDER = "00000000-0000-4000-8000-0000000000a9";
const DUE = "2026-11-15T08:00:00.000Z";
const DUE_MS = Date.parse(DUE);

const row = (overrides: Record<string, unknown> = {}) => ({
  id: DOSE,
  reminder_id: REMINDER,
  due_at: "2026-11-15T08:00:00+00:00",
  status: "pending",
  notify_count: 1,
  confirmed_at: null,
  reminders: { title: "Synthetic tablet" },
  ...overrides,
});

type Item = DispatchRequest["notifications"][number];
const item = (overrides: Partial<Item> = {}): Item => ({
  doseId: DOSE,
  title: "Synthetic tablet",
  notes: "With water",
  dueAt: DUE,
  attempt: 1,
  email: "demo@example.com",
  subscriptions: [{ endpoint: "https://push.example.com/a", p256dh: "key", auth: "auth" }],
  ...overrides,
});

describe("rowToDose", () => {
  it("maps a row and allows confirming until 1 hour after it was due", () => {
    const dose = rowToDose(row(), DUE_MS + 30 * 60_000);
    assert.equal(dose.title, "Synthetic tablet");
    assert.equal(dose.confirmBy, "2026-11-15T09:00:00.000Z");
    assert.equal(dose.canConfirm, true);
    assert.equal(rowToDose(row({ status: "missed", notify_count: 3 }), DUE_MS + 59 * 60_000).canConfirm, true);
    assert.equal(rowToDose(row({ status: "missed" }), DUE_MS + 61 * 60_000).canConfirm, false);
  });

  it("cannot confirm a dose twice", () => {
    const dose = rowToDose(row({ status: "taken", confirmed_at: "2026-11-15T08:03:00+00:00" }), DUE_MS);
    assert.equal(dose.canConfirm, false);
    assert.equal(dose.confirmedAt, "2026-11-15T08:03:00.000Z");
  });
});

describe("notification wording", () => {
  it("repeats only the user's own reminder and links to the dose", () => {
    const payload = pushPayloadSchema.parse(buildPushPayload(item()));
    assert.equal(payload.title, "Synthetic tablet");
    assert.equal(payload.url, `/reminders?dose=${DOSE}`);
    assert.match(payload.body, /^With water\nTap to confirm/);
    assert.match(buildPushPayload(item({ attempt: 3 })).body, /Reminder 3 of 3\..*marked as missed/);
  });

  it("builds a plain email with a confirm link and no medical advice", () => {
    const { subject, text } = buildEmail(item({ attempt: 2 }), "https://app.example.com");
    assert.equal(subject, "Medicine reminder: Synthetic tablet");
    assert.match(text, /https:\/\/app\.example\.com\/reminders\?dose=/);
    assert.match(text, /does not give advice about medicines or doses/);
    assert.doesNotMatch(text, /you should (take|stop|increase|reduce)/i);
    assert.match(text, /\(due 5 minutes ago\)/);
    assert.doesNotMatch(text, /UTC/);
    assert.match(buildEmail(item(), "https://x.example").text, /\(due now\)/);
  });

  it("strips line breaks from titles (no email header injection)", () => {
    assert.equal(oneLine("Tablet\r\nBcc: someone@example.com"), "Tablet Bcc: someone@example.com");
    assert.doesNotMatch(buildEmail(item({ title: "A\r\nB" }), "https://x.example").subject, /[\r\n]/);
  });
});

describe("dispatchNotifications", () => {
  const ok: PushSender = async () => ({ ok: true, gone: false });
  const gone: PushSender = async () => ({ ok: false, gone: true });
  const emails: string[] = [];
  const sendEmail = async (to: string) => {
    emails.push(to);
    return true;
  };

  it("pushes to subscribed devices and does not email", async () => {
    emails.length = 0;
    const result = await dispatchNotifications({ notifications: [item()] }, { sendPush: ok, sendEmail, origin: "https://x.example" });
    assert.deepEqual(result, { pushed: 1, emailed: 0, failed: 0, goneEndpoints: [] });
    assert.equal(emails.length, 0);
  });

  it("emails when no device is subscribed, or every push failed, and reports expired devices", async () => {
    emails.length = 0;
    const result = await dispatchNotifications(
      { notifications: [item({ subscriptions: [] }), item()] },
      { sendPush: gone, sendEmail, origin: "https://x.example" },
    );
    assert.deepEqual(result, { pushed: 0, emailed: 2, failed: 0, goneEndpoints: ["https://push.example.com/a"] });
  });

  it("emails when push is not configured; counts failures when nothing works", async () => {
    const viaEmail = await dispatchNotifications({ notifications: [item()] }, { sendPush: null, sendEmail, origin: "https://x.example" });
    assert.equal(viaEmail.emailed, 1);
    const throwing: PushSender = async () => {
      throw new Error("boom");
    };
    const nothing = await dispatchNotifications(
      { notifications: [item({ email: null })] },
      { sendPush: throwing, sendEmail: null, origin: "https://x.example" },
    );
    assert.deepEqual(nothing, { pushed: 0, emailed: 0, failed: 1, goneEndpoints: [] });
  });
});

describe("schemas", () => {
  it("only accepts https push endpoints and strict dispatch bodies", () => {
    assert.equal(pushSubscriptionSchema.safeParse({ endpoint: "http://push.example.com/a", keys: { p256dh: "k", auth: "a" } }).success, false);
    assert.equal(pushSubscriptionSchema.safeParse({ endpoint: "https://push.example.com/a", expirationTime: null, keys: { p256dh: "k", auth: "a" } }).success, true);
    assert.equal(dispatchRequestSchema.safeParse({ notifications: [item({ attempt: 4 })] }).success, false);
    assert.equal(dispatchRequestSchema.safeParse({ notifications: [{ ...item(), profileId: REMINDER }] }).success, false);
    assert.equal(doseListQuerySchema.parse({}).hours, 24);
    assert.equal(doseListQuerySchema.safeParse({ hours: "500" }).success, false);
    assert.equal(notificationConfigSchema.safeParse({ pushAvailable: true, vapidPublicKey: "k", emailAvailable: false, subscribedDevices: 0, vapidPrivateKey: "x" }).success, false);
  });
});

describe("migration 0006 access rules", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0006_reminder_notifications.sql", import.meta.url), "utf8");

  it("enables RLS on the new tables with own-profile read policies only", () => {
    for (const table of ["push_subscriptions", "reminder_doses"]) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    }
    assert.doesNotMatch(sql, /on public\.reminder_doses for (insert|update|all)/);
    assert.doesNotMatch(sql, /on public\.push_subscriptions for (insert|update|all)/);
  });

  it("keeps the dispatch job off the API and checks the secret before pruning", () => {
    assert.match(sql, /revoke all on function public\.medimate_dispatch_reminders\(\) from public, anon, authenticated/);
    assert.match(sql, /p_secret is distinct from expected/);
    assert.match(sql, /now\(\) > dose\.due_at \+ interval '1 hour'/);
    assert.match(sql, /notify_count < 3/);
    assert.doesNotMatch(sql, /service_role/);
  });
});
