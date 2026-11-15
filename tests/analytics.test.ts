// Deterministic analytics and history ranking (contract §3e). Synthetic data only.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeAnalytics, describeTopic, recordedFactsFor } from "../src/lib/health/analytics.ts";
import { rankRelevantLogs, topicTerms } from "../src/lib/health/retrieve-history.ts";
import { analyticsQuerySchema, analyticsResponseSchema } from "../src/lib/validations/analytics.ts";
import type { HealthLog } from "../src/lib/validations/health-log.ts";

const NOW = Date.parse("2026-03-30T12:00:00Z");
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

const back = (date: string, pain: number | null, extra: Partial<HealthLog> = {}) =>
  log(date, { symptoms: "Mild lower back discomfort", painLocation: "Lower back", painLevel: pain, ...extra });

describe("topicTerms", () => {
  it("drops generic words and folds synonyms into one body area", () => {
    assert.deepEqual([...topicTerms({ symptoms: "Lower back discomfort", painLocation: "Lower back" })], ["back"]);
    assert.deepEqual([...topicTerms({ symptoms: "Headache and nausea", painLocation: null })].sort(), ["head", "nausea"]);
  });
});

describe("rankRelevantLogs", () => {
  it("drops unrelated logs and reports the matched terms", () => {
    const ranked = rankRelevantLogs([back("2026-03-28", 3), log("2026-03-29", { symptoms: "Sore throat" })], "my back hurts", { now: NOW });
    assert.equal(ranked.length, 1);
    assert.deepEqual(ranked[0]!.matchedTerms, ["back"]);
  });

  it("collapses duplicates (same day, same text) to the highest recorded pain", () => {
    const low = back("2026-03-28", 2);
    const high = back("2026-03-28", 5);
    const ranked = rankRelevantLogs([low, high], "back pain", { now: NOW });
    assert.deepEqual(ranked.map((r) => r.log.id), [high.id]);
  });

  it("ranks more shared terms first; recency and pain only break ties", () => {
    const oldButClose = log("2026-03-05", { symptoms: "Back stiffness", painLocation: "Lower back", painLevel: 1 });
    const recentLoose = log("2026-03-29", { symptoms: "Back twinge", painLevel: 9 });
    const ranked = rankRelevantLogs([recentLoose, oldButClose], "stiffness in my back", { max: 1, now: NOW });
    assert.equal(ranked[0]!.log.id, oldButClose.id);
    const tieOld = back("2026-03-05", 3);
    const tieNew = back("2026-03-25", 3, { symptoms: "Lower back discomfort again" });
    assert.equal(rankRelevantLogs([tieOld, tieNew], "back", { max: 1, now: NOW })[0]!.log.id, tieNew.id);
  });

  it("returns at most max entries, newest first", () => {
    const logs = ["2026-03-20", "2026-03-22", "2026-03-24", "2026-03-26"].map((d) => back(d, 3));
    const dates = rankRelevantLogs(logs, "back", { max: 3, now: NOW }).map((r) => r.log.loggedAt.slice(0, 10));
    assert.deepEqual(dates, ["2026-03-26", "2026-03-24", "2026-03-22"]);
  });
});

describe("computeAnalytics", () => {
  const logs = [
    back("2026-03-02", 2, { sleepDurationMinutes: 360 }),
    back("2026-03-03", 2, { sleepDurationMinutes: 360 }),
    back("2026-03-20", 4, { sleepDurationMinutes: 420 }),
    back("2026-03-27", 5),
    back("2026-03-28", 4),
    log("2026-03-10", { sleepDurationMinutes: 480 }),
    log("2026-03-11", { sleepDurationMinutes: 480 }),
    log("2026-03-29", { symptoms: "Headache", painLevel: 3 }),
    log("2026-01-01", { symptoms: "Back ache", painLevel: 9 }), // outside the window
  ];
  const result = computeAnalytics(logs, 30, NOW);

  it("matches the contract schema", () => {
    assert.doesNotThrow(() => analyticsResponseSchema.parse(result));
    assert.equal(result.windowStart, "2026-03-01");
    assert.equal(result.windowEnd, "2026-03-30");
    assert.equal(result.daily.length, 30);
  });

  it("counts symptom frequency per topic, most frequent first, within the window only", () => {
    assert.deepEqual(result.symptoms.map((s) => [s.topic, s.logCount, s.dayCount]), [["back", 5, 5], ["head", 1, 1]]);
    assert.equal(result.logCount, 8);
    assert.equal(result.symptomLogCount, 6);
  });

  it("calculates recorded severity and its change between the two halves", () => {
    const backTopic = result.symptoms[0]!;
    assert.deepEqual(backTopic.severity, { recordedCount: 5, average: 3.4, lowest: 2, highest: 5 });
    assert.deepEqual(backTopic.severityChange, { earlierAverage: 2, laterAverage: 4.3, direction: "higher" });
    assert.equal(result.symptoms[1]!.severityChange.direction, "not_enough_data");
  });

  it("groups consecutive days into recurrence episodes", () => {
    assert.deepEqual(result.symptoms[0]!.recurrence, {
      episodes: 3,
      longestEpisodeDays: 2,
      firstDate: "2026-03-02",
      lastDate: "2026-03-28",
    });
  });

  it("never invents daily values", () => {
    const empty = result.daily.find((d) => d.date === "2026-03-15")!;
    assert.deepEqual(empty, { date: "2026-03-15", painLevel: null, sleepHours: null, sleepQuality: null, waterMl: null, activityMinutes: null, logIds: [] });
  });

  it("compares measures on topic days vs other days only with at least 2 days each side", () => {
    const sleep = result.associations.find((a) => a.topic === "back" && a.measure === "sleepHours");
    assert.deepEqual(
      sleep && { ...sleep, evidenceLogIds: sleep.evidenceLogIds.length },
      { topic: "back", measure: "sleepHours", daysWithTopic: 3, averageWithTopic: 6.3, daysWithout: 2, averageWithout: 8, evidenceLogIds: 3 },
    );
    assert.equal(result.associations.some((a) => a.measure === "waterMl"), false);
  });

  it("handles no logs", () => {
    const none = computeAnalytics([], 7, NOW);
    assert.equal(none.symptoms.length, 0);
    assert.equal(none.associations.length, 0);
    assert.equal(none.daily.every((d) => d.painLevel === null), true);
  });
});

describe("recorded facts", () => {
  it("states only calculated figures, for the topics in the concern", () => {
    const logs = [back("2026-03-27", 2), back("2026-03-28", 4), log("2026-03-29", { symptoms: "Headache", painLevel: 3 })];
    const facts = recordedFactsFor(logs, "my lower back hurts", 30, NOW);
    assert.deepEqual(facts, [
      'Logs mentioning "back": 2 logs on 2 days in the last 30 days, between 2026-03-27 and 2026-03-28.',
      "Recorded pain on those logs: 2–4/10, average 3/10 (2 logs with a pain level).",
    ]);
    assert.deepEqual(recordedFactsFor(logs, "a sore throat", 30, NOW), []);
    assert.equal(recordedFactsFor(logs, null, 30, NOW).length, 4); // every topic: 2 facts each
  });

  it("describes associations as recorded together, not as causes", () => {
    const [fact] = describeTopic(
      {
        topic: "back", logCount: 2, dayCount: 2,
        severity: { recordedCount: 0, average: null, lowest: null, highest: null },
        severityChange: { earlierAverage: null, laterAverage: null, direction: "not_enough_data" },
        recurrence: { episodes: 1, longestEpisodeDays: 2, firstDate: "2026-03-27", lastDate: "2026-03-28" },
        evidenceLogIds: [],
      },
      [{ topic: "back", measure: "sleepHours", daysWithTopic: 2, averageWithTopic: 6, daysWithout: 3, averageWithout: 8, evidenceLogIds: [] }],
      30,
    ).slice(-1);
    assert.match(fact!, /not a cause/);
    assert.doesNotMatch(fact!, /because|caused|due to/);
  });
});

describe("analyticsQuerySchema", () => {
  it("defaults to 30 and only accepts 7, 14 or 30", () => {
    assert.equal(analyticsQuerySchema.parse({}).days, 30);
    assert.equal(analyticsQuerySchema.parse({ days: "14" }).days, 14);
    assert.equal(analyticsQuerySchema.safeParse({ days: "10" }).success, false);
    assert.equal(analyticsQuerySchema.safeParse({ days: "30", extra: "1" }).success, false);
  });
});
