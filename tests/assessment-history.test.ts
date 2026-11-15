// Past assessments for the health summary: row mapping and query validation (synthetic data, no network).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rowToPastAssessment } from "../src/lib/supabase/mappers.ts";
import { assessmentHistoryQuerySchema } from "../src/lib/validations/assessment-history.ts";
import { ASSESSMENT_DISCLAIMER } from "../src/lib/validations/assistant.ts";

const assessment = {
  summary: "Synthetic summary of lower-back discomfort reported over several days.",
  possibleExplanations: [
    {
      title: "Back discomfort to discuss with a clinician",
      whyItMayBeRelevant: "Discomfort was logged on several recent days.",
      supportingHistory: [
        { logId: "00000000-0000-4000-8000-000000000101", date: "2026-11-10", observation: "Lower back stiffness." },
      ],
      unknowns: ["Whether the discomfort is changing over time."],
    },
  ],
  nextSteps: ["Consider discussing persistent symptoms with a GP."],
  sources: [{ title: "Back pain", publisher: "NHS", url: "https://www.nhs.uk/conditions/back-pain/" }],
  disclaimer: ASSESSMENT_DISCLAIMER,
};

const row = {
  id: "00000000-0000-4000-8000-0000000000c1",
  initial_symptom: "Synthetic test: my lower back hurts",
  assessment,
  urgency_level: "routine",
  created_at: "2026-11-14T09:00:00+00:00",
  updated_at: "2026-11-14T09:02:30.123+00:00",
};

describe("rowToPastAssessment", () => {
  it("maps a completed routine session with its stored assessment", () => {
    const past = rowToPastAssessment(row);
    assert.equal(past.sessionId, row.id);
    assert.equal(past.initialConcern, row.initial_symptom);
    assert.equal(past.startedAt, "2026-11-14T09:00:00.000Z");
    assert.equal(past.completedAt, "2026-11-14T09:02:30.123Z");
    assert.equal(past.urgencyLevel, "routine");
    // Assessments saved before 2026-11-15 gain the new grounded fields as empty lists.
    assert.deepEqual(past.assessment, {
      ...assessment,
      possibleExplanations: assessment.possibleExplanations.map((e) => ({
        ...e,
        supportingHistory: e.supportingHistory.map((h) => ({ ...h, matchedTerms: [] })),
      })),
      recordedFacts: [],
      historyConsidered: [],
    });
  });

  it("returns no assessment for an urgent session", () => {
    const past = rowToPastAssessment({ ...row, assessment: null, urgency_level: "urgent" });
    assert.equal(past.urgencyLevel, "urgent");
    assert.equal(past.assessment, null);
  });

  it("never pairs an urgent level with an assessment", () => {
    assert.equal(rowToPastAssessment({ ...row, urgency_level: "urgent" }).assessment, null);
  });

  it("drops a stored assessment that no longer matches the contract", () => {
    const past = rowToPastAssessment({ ...row, assessment: { summary: "partial" } });
    assert.equal(past.assessment, null);
  });

  it("treats a missing or unknown urgency level as routine", () => {
    assert.equal(rowToPastAssessment({ ...row, urgency_level: null }).urgencyLevel, "routine");
    assert.equal(rowToPastAssessment({ ...row, urgency_level: "odd" }).urgencyLevel, "routine");
  });

  it("rejects a row without an id", () => {
    assert.throws(() => rowToPastAssessment({ ...row, id: undefined }));
  });
});

describe("assessmentHistoryQuerySchema", () => {
  it("defaults to 5", () => {
    assert.equal(assessmentHistoryQuerySchema.parse({}).limit, 5);
  });
  it("accepts 1–20 and rejects others", () => {
    assert.equal(assessmentHistoryQuerySchema.parse({ limit: "20" }).limit, 20);
    for (const limit of ["0", "21", "abc", "2.5"]) {
      assert.equal(assessmentHistoryQuerySchema.safeParse({ limit }).success, false, limit);
    }
  });
  it("rejects unknown query keys", () => {
    assert.equal(assessmentHistoryQuerySchema.safeParse({ profileId: "x" }).success, false);
  });
});
