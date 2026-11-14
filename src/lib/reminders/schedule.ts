// Pure scheduling helper for user-created reminders. Repeats are fixed UTC
// intervals (24 h / 7 days); daylight-saving shifts are not handled in this demo.
import type { ReminderRepeat } from "../validations/reminder.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const STEP_MS: Record<Exclude<ReminderRepeat, "none">, number> = { daily: DAY_MS, weekly: 7 * DAY_MS };

/**
 * Next due time (ms) for a reminder. One-off reminders return `remindAt` even
 * when it has passed (the UI shows them as overdue). Repeating reminders return
 * the first occurrence at or after `now`. Inactive reminders return null.
 */
export function nextDueAt(remindAt: number, repeat: ReminderRepeat, active: boolean, now: number): number | null {
  if (!active) return null;
  if (repeat === "none" || remindAt >= now) return remindAt;
  const step = STEP_MS[repeat];
  return remindAt + Math.ceil((now - remindAt) / step) * step;
}
