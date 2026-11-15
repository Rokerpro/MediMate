// "Save to my log" prefill: only the user's own words, never AI text.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { draftLogFromUserMessages } from "../src/lib/health/log-draft.ts";

describe("draftLogFromUserMessages", () => {
  it("uses the user's messages as symptoms and finds the body area they typed", () => {
    const draft = draftLogFromUserMessages(["i am having a knee pain since sunday", "sunday at 9:34 AM and it has been worse since"]);
    assert.equal(draft.symptoms, "i am having a knee pain since sunday / sunday at 9:34 AM and it has been worse since");
    assert.equal(draft.painLocation, "Knee");
    assert.equal(draft.painLevel, null);
  });

  it("prefers a specific area and takes the last pain score the user gave", () => {
    const draft = draftLogFromUserMessages(["My lower back hurts, about 3 out of 10.", "Now it is 5/10 after sitting."]);
    assert.equal(draft.painLocation, "Lower back");
    assert.equal(draft.painLevel, 5);
  });

  it("maps a headache to Head and leaves unknown fields empty", () => {
    assert.deepEqual(draftLogFromUserMessages(["I have a headache since this morning."]), {
      symptoms: "I have a headache since this morning.",
      painLocation: "Head",
      painLevel: null,
    });
    assert.equal(draftLogFromUserMessages(["I feel tired."]).painLocation, null);
  });

  it("ignores numbers that are not a score out of 10 and keeps symptoms within the schema limit", () => {
    assert.equal(draftLogFromUserMessages(["Knee pain for 12 days, 2 of them bad."]).painLevel, null);
    assert.equal(draftLogFromUserMessages(["Pain 10/10 in my knee"]).painLevel, 10);
    assert.ok(draftLogFromUserMessages(["x".repeat(1500)]).symptoms.length <= 1000);
  });
});
