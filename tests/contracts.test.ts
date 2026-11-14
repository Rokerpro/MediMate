// Contract tests: shared schemas accept contract-shaped payloads and reject invalid ones.
// Runs on Node's built-in test runner with native TypeScript type stripping (no extra deps).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  API_ERROR_STATUS,
  apiErrorResponseSchema,
} from "../src/lib/validations/api-error.ts";
import {
  ASSESSMENT_DISCLAIMER,
  chatRequestSchema,
  chatResponseSchema,
} from "../src/lib/validations/assistant.ts";
import {
  healthLogCreateResponseSchema,
  healthLogCreateSchema,
  healthLogListQuerySchema,
  healthLogListResponseSchema,
} from "../src/lib/validations/health-log.ts";
import {
  DEMO_PROFILE_ID,
  profileResponseSchema,
  profileUpdateSchema,
} from "../src/lib/validations/profile.ts";
import * as fixtures from "../src/lib/mocks/api-fixtures.ts";

describe("mock fixtures match the contract", () => {
  it("profile", () => {
    assert.ok(profileResponseSchema.safeParse(fixtures.mockProfileResponse).success);
    assert.equal(fixtures.mockProfileResponse.profile.id, DEMO_PROFILE_ID);
  });
  it("health logs", () => {
    assert.ok(healthLogListResponseSchema.safeParse(fixtures.mockHealthLogListResponse).success);
    assert.ok(healthLogListResponseSchema.safeParse(fixtures.mockHealthLogEmptyListResponse).success);
    assert.ok(healthLogCreateResponseSchema.safeParse(fixtures.mockHealthLogCreateResponse).success);
  });
  it("chat responses", () => {
    for (const r of [
      fixtures.mockChatFollowUpResponse,
      fixtures.mockChatAssessmentResponse,
      fixtures.mockChatUrgentResponse,
    ]) {
      assert.ok(chatResponseSchema.safeParse(r).success, r.status);
    }
    assert.equal(fixtures.mockChatAssessmentResponse.assessment?.disclaimer, ASSESSMENT_DISCLAIMER);
  });
  it("error envelope", () => {
    assert.ok(apiErrorResponseSchema.safeParse(fixtures.mockAiUnavailableError).success);
    assert.equal(API_ERROR_STATUS.AI_UNAVAILABLE, 503);
  });
});

describe("profile validation", () => {
  it("accepts a partial update", () => {
    assert.ok(profileUpdateSchema.safeParse({ age: 25, gender: null }).success);
  });
  it("rejects empty, out-of-range and non-editable fields", () => {
    assert.equal(profileUpdateSchema.safeParse({}).success, false);
    assert.equal(profileUpdateSchema.safeParse({ age: 0 }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ age: 24.5 }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ heightCm: 900 }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ id: DEMO_PROFILE_ID }).success, false);
  });
});

describe("health log validation", () => {
  it("accepts a minimal create body", () => {
    assert.ok(healthLogCreateSchema.safeParse({ symptoms: "Mild headache" }).success);
  });
  it("enforces ranges", () => {
    const base = { symptoms: "x" };
    assert.equal(healthLogCreateSchema.safeParse({ ...base, painLevel: 11 }).success, false);
    assert.equal(healthLogCreateSchema.safeParse({ ...base, sleepQuality: 0 }).success, false);
    assert.equal(healthLogCreateSchema.safeParse({ ...base, waterMl: -1 }).success, false);
    assert.equal(healthLogCreateSchema.safeParse({ ...base, activityMinutes: -5 }).success, false);
    assert.equal(healthLogCreateSchema.safeParse({ symptoms: "   " }).success, false);
    assert.equal(healthLogCreateSchema.safeParse({ ...base, id: "x" }).success, false);
  });
  it("defaults and bounds the list limit", () => {
    assert.equal(healthLogListQuerySchema.parse({}).limit, 30);
    assert.equal(healthLogListQuerySchema.parse({ limit: "10" }).limit, 10);
    assert.equal(healthLogListQuerySchema.safeParse({ limit: "0" }).success, false);
    assert.equal(healthLogListQuerySchema.safeParse({ limit: "500" }).success, false);
  });
});

describe("chat validation", () => {
  it("accepts new and continuing sessions", () => {
    assert.ok(chatRequestSchema.safeParse({ sessionId: null, message: "My back hurts." }).success);
    assert.ok(
      chatRequestSchema.safeParse({ sessionId: fixtures.mockChatFollowUpResponse.sessionId, message: "Yes" })
        .success,
    );
  });
  it("rejects empty or oversized messages and bad session IDs", () => {
    assert.equal(chatRequestSchema.safeParse({ sessionId: null, message: "  " }).success, false);
    assert.equal(chatRequestSchema.safeParse({ sessionId: null, message: "a".repeat(2001) }).success, false);
    assert.equal(chatRequestSchema.safeParse({ sessionId: "abc", message: "hi" }).success, false);
    assert.equal(chatRequestSchema.safeParse({ message: "hi" }).success, false);
  });
  it("enforces status/safety/assessment consistency", () => {
    const followUp = fixtures.mockChatFollowUpResponse;
    const assessment = fixtures.mockChatAssessmentResponse;
    const urgent = fixtures.mockChatUrgentResponse;
    // follow_up with no questions
    assert.equal(chatResponseSchema.safeParse({ ...followUp, followUpQuestions: [] }).success, false);
    // assessment status without an assessment
    assert.equal(chatResponseSchema.safeParse({ ...assessment, assessment: null }).success, false);
    // urgent must not carry an ordinary assessment
    assert.equal(chatResponseSchema.safeParse({ ...urgent, assessment: assessment.assessment }).success, false);
    // urgent must be a triggered urgent safety result
    assert.equal(
      chatResponseSchema.safeParse({ ...urgent, safety: { level: "routine", triggered: false, message: null } })
        .success,
      false,
    );
    // triggered safety needs a message
    assert.equal(
      chatResponseSchema.safeParse({ ...urgent, safety: { level: "urgent", triggered: true, message: null } })
        .success,
      false,
    );
  });
  it("rejects non-http source URLs and malformed history dates", () => {
    const a = fixtures.mockChatAssessmentResponse.assessment;
    assert.ok(a);
    const badSource = { ...a, sources: [{ title: "t", publisher: "p", url: "javascript:alert(1)" }] };
    assert.equal(
      chatResponseSchema.safeParse({ ...fixtures.mockChatAssessmentResponse, assessment: badSource }).success,
      false,
    );
    const [first] = a.possibleExplanations;
    assert.ok(first);
    const badDate = {
      ...a,
      possibleExplanations: [
        { ...first, supportingHistory: [{ logId: first.supportingHistory[0]?.logId, date: "13/11/2026", observation: "x" }] },
      ],
    };
    assert.equal(
      chatResponseSchema.safeParse({ ...fixtures.mockChatAssessmentResponse, assessment: badDate }).success,
      false,
    );
  });
});
