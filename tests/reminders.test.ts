// Reminders: contract schemas, row mapping and next-due scheduling (synthetic data, no network).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextDueAt } from "../src/lib/reminders/schedule.ts";
import { reminderCreateToRow, reminderUpdateToRow, rowToReminder, sortReminders } from "../src/lib/supabase/mappers.ts";
import { DEMO_PROFILE_ID } from "../src/lib/validations/profile.ts";
import {
  reminderCreateSchema,
  reminderListQuerySchema,
  reminderUpdateSchema,
} from "../src/lib/validations/reminder.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-14T12:00:00Z");

const row = {
  id: "00000000-0000-4000-8000-0000000000a1",
  title: "Fill in daily health log",
  category: "health_log",
  notes: null,
  remind_at: "2026-11-10T20:00:00+00:00",
  repeat: "daily",
  active: true,
  created_at: "2026-11-10T08:00:00+00:00",
};

describe("nextDueAt", () => {
  it("returns a future one-off time unchanged", () => {
    assert.equal(nextDueAt(NOW + HOUR, "none", true, NOW), NOW + HOUR);
  });
  it("keeps a past one-off time (overdue)", () => {
    assert.equal(nextDueAt(NOW - DAY, "none", true, NOW), NOW - DAY);
  });
  it("rolls daily and weekly reminders forward to the next occurrence", () => {
    assert.equal(nextDueAt(NOW - 2 * DAY - HOUR, "daily", true, NOW), NOW + 23 * HOUR);
    assert.equal(nextDueAt(NOW - 8 * DAY, "weekly", true, NOW), NOW + 6 * DAY);
  });
  it("treats an occurrence exactly now as due now", () => {
    assert.equal(nextDueAt(NOW - DAY, "daily", true, NOW), NOW);
  });
  it("returns null when inactive", () => {
    assert.equal(nextDueAt(NOW + HOUR, "none", false, NOW), null);
  });
});

describe("reminder schemas", () => {
  const valid = { title: "Take evening tablet as prescribed", remindAt: "2026-11-15T19:00:00Z", userConfirmed: true };

  it("accepts a confirmed reminder and applies defaults", () => {
    const parsed = reminderCreateSchema.parse(valid);
    assert.equal(parsed.category, "other");
    assert.equal(parsed.repeat, "none");
  });
  it("rejects a reminder without user confirmation", () => {
    assert.equal(reminderCreateSchema.safeParse({ ...valid, userConfirmed: undefined }).success, false);
    assert.equal(reminderCreateSchema.safeParse({ ...valid, userConfirmed: false }).success, false);
  });
  it("rejects blank titles, unknown fields, bad dates and unknown categories", () => {
    assert.equal(reminderCreateSchema.safeParse({ ...valid, title: "   " }).success, false);
    assert.equal(reminderCreateSchema.safeParse({ ...valid, profileId: DEMO_PROFILE_ID }).success, false);
    assert.equal(reminderCreateSchema.safeParse({ ...valid, remindAt: "tomorrow" }).success, false);
    assert.equal(reminderCreateSchema.safeParse({ ...valid, category: "dose" }).success, false);
    assert.equal(reminderCreateSchema.safeParse({ ...valid, repeat: "hourly" }).success, false);
  });
  it("requires at least one field on update", () => {
    assert.equal(reminderUpdateSchema.safeParse({}).success, false);
    assert.equal(reminderUpdateSchema.safeParse({ active: false }).success, true);
  });
  it("parses includeInactive as a boolean", () => {
    assert.equal(reminderListQuerySchema.parse({}).includeInactive, false);
    assert.equal(reminderListQuerySchema.parse({ includeInactive: "true" }).includeInactive, true);
    assert.equal(reminderListQuerySchema.safeParse({ includeInactive: "yes" }).success, false);
  });
});

describe("reminder mapping", () => {
  it("maps a row and computes nextDueAt", () => {
    const reminder = rowToReminder(row, NOW);
    assert.equal(reminder.remindAt, "2026-11-10T20:00:00.000Z");
    assert.equal(reminder.nextDueAt, "2026-11-14T20:00:00.000Z");
    assert.equal(reminder.category, "health_log");
  });
  it("rejects rows that break the contract", () => {
    assert.throws(() => rowToReminder({ ...row, repeat: "hourly" }, NOW));
  });
  it("sorts active by next due time, inactive last", () => {
    const later = rowToReminder({ ...row, id: "00000000-0000-4000-8000-0000000000a2", repeat: "none", remind_at: "2026-11-20T10:00:00Z" }, NOW);
    const paused = rowToReminder({ ...row, id: "00000000-0000-4000-8000-0000000000a3", active: false, remind_at: "2026-11-01T10:00:00Z" }, NOW);
    const daily = rowToReminder(row, NOW);
    assert.deepEqual(sortReminders([paused, later, daily]).map((r) => r.id), [daily.id, later.id, paused.id]);
  });
  it("builds insert rows with the server profile id and blank notes as null", () => {
    const input = reminderCreateSchema.parse({ title: "GP appointment", remindAt: "2026-11-20T10:00:00Z", notes: "  ", userConfirmed: true });
    assert.deepEqual(reminderCreateToRow(input, DEMO_PROFILE_ID), {
      profile_id: DEMO_PROFILE_ID,
      title: "GP appointment",
      category: "other",
      notes: null,
      remind_at: "2026-11-20T10:00:00Z",
      repeat: "none",
    });
  });
  it("writes only provided fields on update", () => {
    const now = new Date(NOW);
    assert.deepEqual(reminderUpdateToRow({ active: false }, now), { active: false, updated_at: now.toISOString() });
  });
});
