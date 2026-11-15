// Weekly AI summary: safety first, same output validation as chat, server-built assessment.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mockProvider } from "../src/lib/ai/mock-provider.ts";
import { AiUnavailableError, type LlmProvider, type ModelRequest } from "../src/lib/ai/types.ts";
import { NO_DATA_MESSAGE, WEEKLY_URGENT_MESSAGE, runWeeklySummary } from "../src/lib/ai/weekly-summary.ts";
import { PROMPT_NEXT_STEP, evaluateSafety } from "../src/lib/health/safety-rules.ts";
import { ASSESSMENT_DISCLAIMER } from "../src/lib/validations/assistant.ts";
import type { HealthLog, Profile } from "../src/lib/validations/index.ts";
import { weeklySummaryResponseSchema } from "../src/lib/validations/weekly-summary.ts";
import { UNSAFE_OUTPUTS } from "./fixtures/safety-cases.ts";

const NOW = Date.parse("2026-11-15T12:00:00Z");

const profile: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Weekly Test",
  age: null,
  gender: null,
  heightCm: null,
  weightKg: null,
  conditions: [],
  allergies: [],
  medications: [],
  medicalHistory: "",
};

function log(n: number, day: string, symptoms: string, extra: Partial<HealthLog> = {}): HealthLog {
  return {
    id: `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, "0")}`,
    loggedAt: `2026-11-${day}T09:00:00.000Z`,
    symptoms,
    painLocation: null,
    painLevel: null,
    sleepDurationMinutes: null,
    sleepQuality: null,
    mood: null,
    waterMl: null,
    activityMinutes: null,
    notes: null,
    ...extra,
  };
}

const BACK_A = log(1, "14", "Mild lower back discomfort", { painLocation: "Lower back", painLevel: 3 });
const BACK_B = log(2, "12", "Mild lower back discomfort", { painLocation: "Lower back", painLevel: 2 });
const SLEEP = log(3, "13", "No specific symptom reported", { sleepDurationMinutes: 360, mood: "tired" });
const OLD = log(4, "01", "Mild lower back discomfort");

function scripted(...replies: string[]): LlmProvider & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  return {
    name: "scripted",
    calls,
    complete(request) {
      calls.push(request);
      return Promise.resolve(replies[Math.min(calls.length - 1, replies.length - 1)]!);
    },
  };
}

function reply(summary: string, supportingLogIds: string[] = []): string {
  return JSON.stringify({
    status: "assessment",
    assistantMessage: "Here is your weekly summary.",
    followUpQuestions: [],
    assessment: {
      summary,
      possibleExplanations: [
        {
          title: "Back discomfort recorded on several days",
          whyItMayBeRelevant: "Your logs recorded back discomfort on more than one day this week.",
          supportingLogIds,
          unknowns: ["Whether it is changing over time"],
        },
      ],
      nextSteps: ["Speak to a GP if it continues or gets worse."],
    },
  });
}

const deps = (provider: LlmProvider) => ({ provider, evaluateSafety });

describe("runWeeklySummary", () => {
  it("returns no_data without calling the model when there are no logs this week", async () => {
    const provider = scripted("{}");
    const result = await runWeeklySummary({ logs: [OLD], profile, now: NOW }, deps(provider));
    assert.equal(result.status, "no_data");
    assert.equal(result.assistantMessage, NO_DATA_MESSAGE);
    assert.equal(result.logCount, 0);
    assert.equal(provider.calls.length, 0);
    assert.equal(result.weekStart, "2026-11-08");
    assert.equal(result.weekEnd, "2026-11-15");
  });

  it("escalates an urgent warning sign in a log and never calls the model", async () => {
    const provider = scripted(reply("Nothing to worry about."));
    const urgent = log(5, "13", "Back pain", { notes: "numbness around my bottom and genitals" });
    const result = await runWeeklySummary({ logs: [BACK_A, urgent], profile, now: NOW }, deps(provider));
    assert.equal(result.status, "urgent");
    assert.equal(result.assistantMessage, WEEKLY_URGENT_MESSAGE);
    assert.equal(result.assessment, null);
    assert.equal(result.safety.level, "urgent");
    assert.ok(result.safetyRuleId);
    assert.equal(provider.calls.length, 0);
  });

  it("sends only this week's logs, as data, in the weekly mode", async () => {
    const provider = scripted(reply("Your logs recorded back discomfort on 2026-11-12 and 2026-11-14."));
    await runWeeklySummary({ logs: [BACK_A, BACK_B, SLEEP, OLD], profile, now: NOW }, deps(provider));
    const request = provider.calls[0]!;
    assert.equal(request.context.mode, "weekly");
    assert.equal(request.context.mustAssess, true);
    assert.deepEqual(request.context.relevantLogs.map((l) => l.id), [BACK_A.id, BACK_B.id]);
    assert.deepEqual(request.context.recentMeasurementLogs.map((l) => l.id), [SLEEP.id]);
    assert.doesNotMatch(request.user, new RegExp(OLD.id));
    assert.match(request.user, /last 7 days/);
  });

  it("turns cited log ids into dated history, adds curated sources and the disclaimer", async () => {
    const provider = scripted(reply("Your logs recorded back discomfort on two days.", [BACK_A.id, "not-a-real-id"]));
    const result = await runWeeklySummary({ logs: [BACK_A, BACK_B, SLEEP], profile, now: NOW }, deps(provider));
    assert.equal(result.status, "summary");
    assert.equal(result.logCount, 3);
    const history = result.assessment!.possibleExplanations[0]!.supportingHistory;
    assert.deepEqual(history.map((h) => [h.logId, h.date]), [[BACK_A.id, "2026-11-14"]]);
    assert.equal(result.assessment!.disclaimer, ASSESSMENT_DISCLAIMER);
    assert.ok(result.assessment!.sources.every((s) => s.url.startsWith("https://www.nhs.uk/")));
    const response: Record<string, unknown> = { ...result };
    delete response.safetyRuleId;
    assert.ok(weeklySummaryResponseSchema.safeParse(response).success);
  });

  it("repairs once, then refuses unsafe model output (same checks as chat)", async () => {
    for (const unsafe of UNSAFE_OUTPUTS.filter((c) => c.field === "summary")) {
      const provider = scripted(reply(unsafe.text));
      await assert.rejects(
        runWeeklySummary({ logs: [BACK_A], profile, now: NOW }, deps(provider)),
        AiUnavailableError,
        unsafe.text,
      );
      assert.equal(provider.calls.length, 2, unsafe.text);
    }
  });

  it("uses a valid repaired reply", async () => {
    const provider = scripted(reply("You have sciatica."), reply("Your logs recorded back discomfort this week."));
    const result = await runWeeklySummary({ logs: [BACK_A], profile, now: NOW }, deps(provider));
    assert.equal(result.status, "summary");
    assert.equal(provider.calls.length, 2);
  });

  it("adds the fixed GP / 111 step when a log matches a prompt-level rule", async () => {
    const fever = log(6, "14", "Back pain", { notes: "back pain and I have a high temperature" });
    const provider = scripted(reply("Your logs recorded back pain this week."));
    const result = await runWeeklySummary({ logs: [fever], profile, now: NOW }, deps(provider));
    assert.equal(result.status, "summary");
    assert.equal(result.safety.level, "prompt");
    assert.equal(result.assessment!.nextSteps[0], PROMPT_NEXT_STEP);
    assert.match(result.assistantMessage, /NHS 111/);
  });

  it("works with the offline mock provider", async () => {
    const result = await runWeeklySummary({ logs: [BACK_A, SLEEP], profile, now: NOW }, deps(mockProvider));
    assert.equal(result.status, "summary");
  });
});

describe("weeklySummaryResponseSchema", () => {
  const base = {
    weekStart: "2026-11-08",
    weekEnd: "2026-11-15",
    assistantMessage: "x",
  };
  it("rejects inconsistent shapes", () => {
    assert.equal(
      weeklySummaryResponseSchema.safeParse({ ...base, status: "summary", logCount: 2, safety: { level: "routine", triggered: false, message: null }, assessment: null }).success,
      false,
    );
    assert.equal(
      weeklySummaryResponseSchema.safeParse({ ...base, status: "no_data", logCount: 3, safety: { level: "routine", triggered: false, message: null }, assessment: null }).success,
      false,
    );
    assert.equal(
      weeklySummaryResponseSchema.safeParse({ ...base, status: "urgent", logCount: 1, safety: { level: "routine", triggered: false, message: null }, assessment: null }).success,
      false,
    );
  });
  it("accepts no_data", () => {
    assert.ok(
      weeklySummaryResponseSchema.safeParse({ ...base, status: "no_data", logCount: 0, safety: { level: "routine", triggered: false, message: null }, assessment: null }).success,
    );
  });
});
