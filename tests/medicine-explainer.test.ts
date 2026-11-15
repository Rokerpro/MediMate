// Medicine explainer: safety order, output checks and fixed text.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MEDICINE_GUIDANCE,
  MEDICINE_SOURCE,
  checkMedicineReply,
  runMedicineExplainer,
} from "../src/lib/ai/medicine-explainer.ts";
import { mockProvider } from "../src/lib/ai/mock-provider.ts";
import { AiUnavailableError, type LlmProvider } from "../src/lib/ai/types.ts";
import { evaluateSafety } from "../src/lib/health/safety-rules.ts";
import { ASSESSMENT_DISCLAIMER } from "../src/lib/validations/assistant.ts";
import { medicineExplainResponseSchema } from "../src/lib/validations/medicine.ts";

const GOOD = {
  name: "Ibuprofen",
  alsoKnownAs: ["Nurofen"],
  medicineType: "Non-steroidal anti-inflammatory drug (NSAID)",
  whatItIsFor: "It is generally used to ease pain and reduce inflammation and fever.",
  commonUses: ["Headaches", "Period pain", "Muscle aches"],
  howItWorks: "It reduces substances in the body that cause pain and swelling.",
  questionsToAsk: ["Is it suitable with my other medicines?"],
};

const reply = (explanation: unknown, status = "explained") => JSON.stringify({ status, explanation });

function scripted(...replies: string[]): LlmProvider & { calls: number } {
  const provider = {
    name: "scripted",
    calls: 0,
    complete() {
      provider.calls += 1;
      return Promise.resolve(replies[Math.min(provider.calls - 1, replies.length - 1)]!);
    },
  };
  return provider;
}

describe("checkMedicineReply", () => {
  it("accepts general information", () => {
    assert.equal(checkMedicineReply(reply(GOOD)).ok, true);
  });

  it("accepts not_recognised with no explanation", () => {
    assert.equal(checkMedicineReply(reply(null, "not_recognised")).ok, true);
  });

  const unsafe: [string, Partial<typeof GOOD>][] = [
    ["a dose amount", { howItWorks: "Adults usually take 200mg." }],
    ["a schedule", { whatItIsFor: "Take it three times a day for pain." }],
    ["an hourly interval", { commonUses: ["Pain relief every 4 to 6 hours"] }],
    ["a maximum dose", { whatItIsFor: "Do not exceed the maximum daily dose." }],
    ["a personal instruction", { whatItIsFor: "You can take it for headaches." }],
    ["a safety reassurance", { howItWorks: "It is safe to take with food." }],
    ["a stop instruction", { questionsToAsk: ["Stop taking your tablets if you feel sick."] }],
    ["a URL", { whatItIsFor: "See https://example.com for details." }],
    ["a diagnosis", { whatItIsFor: "You may have arthritis if you need it." }],
    ["a percentage", { howItWorks: "It works for 80% of people." }],
  ];
  for (const [label, change] of unsafe) {
    it(`rejects ${label}`, () => {
      assert.equal(checkMedicineReply(reply({ ...GOOD, ...change })).ok, false);
    });
  }

  it("allows a strength in the name the user typed", () => {
    assert.equal(checkMedicineReply(reply({ ...GOOD, name: "Ibuprofen 200mg" })).ok, true);
  });

  it("rejects invalid JSON and mismatched status", () => {
    assert.equal(checkMedicineReply("not json").ok, false);
    assert.equal(checkMedicineReply(reply(GOOD, "not_recognised")).ok, false);
    assert.equal(checkMedicineReply(reply(null, "explained")).ok, false);
  });
});

describe("runMedicineExplainer", () => {
  it("returns a valid explained response with fixed guidance, disclaimer and source", async () => {
    const result = await runMedicineExplainer("ibuprofen", { provider: scripted(reply(GOOD)), evaluateSafety });
    const { safetyRuleId, ...response } = result;
    assert.equal(safetyRuleId, null);
    medicineExplainResponseSchema.parse(response);
    assert.equal(response.status, "explained");
    assert.equal(response.guidance, MEDICINE_GUIDANCE);
    assert.equal(response.disclaimer, ASSESSMENT_DISCLAIMER);
    assert.deepEqual(response.source, MEDICINE_SOURCE);
  });

  it("does not call the model when a warning sign is in the text", async () => {
    const provider = scripted(reply(GOOD));
    const result = await runMedicineExplainer("Headache tablets. Now I feel drowsy and confused.", {
      provider,
      evaluateSafety,
    });
    assert.equal(provider.calls, 0);
    assert.equal(result.status, "urgent");
    assert.equal(result.explanation, null);
    assert.equal(result.safety.triggered, true);
    const response: Record<string, unknown> = { ...result };
    delete response.safetyRuleId;
    medicineExplainResponseSchema.parse(response);
  });

  it("repairs once, then succeeds", async () => {
    const provider = scripted(reply({ ...GOOD, howItWorks: "Take 400 mg." }), reply(GOOD));
    const result = await runMedicineExplainer("ibuprofen", { provider, evaluateSafety });
    assert.equal(provider.calls, 2);
    assert.equal(result.status, "explained");
  });

  it("gives up after one failed repair", async () => {
    const bad = reply({ ...GOOD, howItWorks: "Take 400 mg." });
    await assert.rejects(
      runMedicineExplainer("ibuprofen", { provider: scripted(bad, bad), evaluateSafety }),
      AiUnavailableError,
    );
  });

  it("passes not_recognised through", async () => {
    const result = await runMedicineExplainer("pizza", { provider: scripted(reply(null, "not_recognised")), evaluateSafety });
    assert.equal(result.status, "not_recognised");
    assert.equal(result.explanation, null);
  });

  it("works with the mock provider", async () => {
    const result = await runMedicineExplainer("paracetamol", { provider: mockProvider, evaluateSafety });
    assert.equal(result.status, "explained");
    assert.match(result.explanation?.name ?? "", /\[Mock\]/);
  });
});
