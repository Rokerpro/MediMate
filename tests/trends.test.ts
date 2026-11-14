// Trend helpers: daily series never invent values, window is UTC calendar days.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HealthLog } from "../src/lib/validations/health-log.ts";
import { dailySeries, logsInWindow, recurringSymptoms, summaryFigures } from "../src/lib/health/trends.ts";

const NOW = Date.parse("2026-03-15T12:00:00Z");
let counter = 0;
function log(date: string, overrides: Partial<HealthLog> = {}): HealthLog {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    loggedAt: `${date}T09:00:00+00:00`,
    symptoms: "No specific symptom reported",
    painLevel: null,
    painLocation: null,
    sleepDurationMinutes: null,
    sleepQuality: null,
    waterMl: null,
    activityMinutes: null,
    mood: null,
    notes: null,
    ...overrides,
  };
}

describe("logsInWindow", () => {
  it("keeps the last N calendar days, newest first", () => {
    const logs = [log("2026-03-01"), log("2026-03-02"), log("2026-03-15"), log("2026-03-16")];
    const result = logsInWindow(logs, 14, NOW).map((l) => l.loggedAt.slice(0, 10));
    assert.deepEqual(result, ["2026-03-15", "2026-03-02"]);
  });
});

describe("dailySeries", () => {
  it("returns one point per day with nulls for unrecorded days", () => {
    const points = dailySeries([log("2026-03-14", { painLevel: 3, sleepDurationMinutes: 450 })], 3, NOW);
    assert.deepEqual(points, [
      { date: "2026-03-13", painLevel: null, sleepHours: null },
      { date: "2026-03-14", painLevel: 3, sleepHours: 7.5 },
      { date: "2026-03-15", painLevel: null, sleepHours: null },
    ]);
  });

  it("uses the highest pain recorded on a day and treats 0 as recorded", () => {
    const points = dailySeries([log("2026-03-15", { painLevel: 2 }), log("2026-03-15", { painLevel: 6 }), log("2026-03-14", { painLevel: 0 })], 2, NOW);
    assert.equal(points[0]!.painLevel, 0);
    assert.equal(points[1]!.painLevel, 6);
  });
});

describe("summaryFigures", () => {
  it("counts logs, averages recorded sleep and finds the highest pain", () => {
    const figures = summaryFigures([
      log("2026-03-15", { painLevel: 4, sleepDurationMinutes: 420 }),
      log("2026-03-14", { painLevel: 7, sleepDurationMinutes: 360 }),
      log("2026-03-13"),
    ]);
    assert.deepEqual(figures, { logCount: 3, averageSleepHours: 6.5, daysWithPainRecorded: 2, highestPain: { level: 7, date: "2026-03-14" } });
  });

  it("returns nulls when nothing was measured", () => {
    assert.deepEqual(summaryFigures([]), { logCount: 0, averageSleepHours: null, daysWithPainRecorded: 0, highestPain: null });
  });
});

describe("recurringSymptoms", () => {
  it("groups identical text only, ignores placeholders and single entries", () => {
    const result = recurringSymptoms([
      log("2026-03-15", { symptoms: "Lower back discomfort" }),
      log("2026-03-10", { symptoms: "lower back discomfort " }),
      log("2026-03-12", { symptoms: "Headache" }),
      log("2026-03-11"),
      log("2026-03-09"),
    ]);
    assert.deepEqual(result, [{ symptom: "Lower back discomfort", count: 2, firstDate: "2026-03-10", lastDate: "2026-03-15" }]);
  });
});
