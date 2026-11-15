// Fixed examples for every deterministic safety rule (AI_SAFETY_SPEC.md §5, §9.1).
// For each rule: positive (must fire), negative (negated, must not fire) and
// ambiguous (near-miss that is not on the NHS 999 list, must not fire this rule).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PROMPT_RULES, SAFETY_RULES, evaluateSafety, hasUnnegated } from "../src/lib/health/safety-rules.ts";
import { PROMPT_RULE_CASES, RULE_CASES } from "./fixtures/safety-cases.ts";

const CASES = RULE_CASES;

describe("safety rule register", () => {
  it("every rule has fixed test cases, and every case names a real rule", () => {
    const ruleIds = SAFETY_RULES.map((rule) => rule.id).sort();
    assert.deepEqual(CASES.map((c) => c.ruleId).sort(), ruleIds);
  });

  it("every rule cites one of the recorded NHS sources and a review date", () => {
    for (const rule of SAFETY_RULES) {
      assert.match(rule.sourceUrl, /^https:\/\/www\.nhs\.uk\/conditions\/(back-pain|headaches|chest-pain)\/$/);
      assert.match(rule.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(rule.message, /local emergency number/);
      assert.match(rule.message, /not a diagnosis/);
    }
  });
});

for (const c of CASES) {
  describe(`rule ${c.ruleId}`, () => {
    for (const text of c.positive) {
      it(`fires: "${text}"`, () => {
        const { result, ruleId } = evaluateSafety([text]);
        assert.equal(result.triggered, true);
        assert.equal(result.level, "urgent");
        assert.equal(ruleId, c.ruleId);
      });
    }
    for (const text of [...c.negative, ...c.ambiguous]) {
      it(`does not fire: "${text}"`, () => {
        assert.equal(evaluateSafety([text]).result.triggered, false);
      });
    }
  });
}

describe("prompt-level (urgent GP / 111) rule register", () => {
  it("every prompt rule has fixed test cases, and every case names a real rule", () => {
    assert.deepEqual(PROMPT_RULE_CASES.map((c) => c.ruleId).sort(), PROMPT_RULES.map((r) => r.id).sort());
  });

  it("prompt rules cite the Back pain or Headaches page (Chest pain has no 111 list) and never send to emergency first", () => {
    for (const rule of PROMPT_RULES) {
      assert.match(rule.sourceUrl, /^https:\/\/www\.nhs\.uk\/conditions\/(back-pain|headaches)\/$/);
      assert.match(rule.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(rule.message, /urgent GP appointment/);
      assert.match(rule.message, /NHS 111/);
      assert.match(rule.message, /not a diagnosis/);
    }
  });

  it("rule ids are unique across both levels", () => {
    const ids = [...SAFETY_RULES, ...PROMPT_RULES].map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

for (const c of PROMPT_RULE_CASES) {
  describe(`prompt rule ${c.ruleId}`, () => {
    for (const text of c.positive) {
      it(`fires at prompt level: "${text}"`, () => {
        const { result, ruleId } = evaluateSafety([text]);
        assert.equal(result.triggered, true);
        assert.equal(result.level, "prompt");
        assert.equal(ruleId, c.ruleId);
      });
    }
    for (const text of [...c.negative, ...c.ambiguous]) {
      it(`does not fire: "${text}"`, () => {
        assert.equal(evaluateSafety([text]).result.triggered, false);
      });
    }
  });
}

describe("evaluateSafety behaviour", () => {
  it("an urgent (999) sign wins over a prompt (111) sign in the same conversation", () => {
    const { result, ruleId } = evaluateSafety(["Headache and I have been vomiting.", "Now I feel drowsy and confused."]);
    assert.equal(result.level, "urgent");
    assert.equal(ruleId, "headache-drowsy-confused");
  });

  it("a prompt sign from an earlier message carries through later turns", () => {
    const { result, ruleId } = evaluateSafety(["It is about 5 out of 10.", "My back pain started suddenly and it is severe."]);
    assert.equal(result.level, "prompt");
    assert.equal(ruleId, "back-sudden-or-rapidly-worse");
  });

  it("requires the symptom context (warning sign alone does not fire a back/headache rule)", () => {
    assert.equal(evaluateSafety(["I have numbness in both legs."]).result.triggered, false);
  });

  it("chest pain alone does not fire (NHS lists it as see a GP if it comes and goes)", () => {
    assert.equal(evaluateSafety(["I have had some chest pain today."]).result.triggered, false);
  });

  it("chest pain with breathing trouble fires without any earlier back context (gap found in review)", () => {
    assert.equal(evaluateSafety(["I have severe chest pain and trouble breathing."]).ruleId, "chest-with-symptoms");
  });

  it("combines earlier user messages in the session", () => {
    const { result } = evaluateSafety(["Since yesterday, and I can't pee.", "My lower back hurts."]);
    assert.equal(result.triggered, true);
  });

  it("does not fire on the main demo conversations", () => {
    const demo = [
      ["My lower back has been hurting since yesterday.", "It started after sitting at my desk most of the day. About 4 out of 10, it is a dull ache and gets better when I walk around. No numbness."],
      ["I've had a headache since this morning.", "Dull, around my forehead, about 3 out of 10. I slept badly and haven't drunk much water today."],
      ["I take ibuprofen for my back. Should I stop taking it or double the dose?", "200 mg twice a day for the last 3 days. The back ache is about the same."],
    ];
    for (const conversation of demo) assert.equal(evaluateSafety(conversation).result.triggered, false);
  });

  it("negation is limited to the same clause", () => {
    assert.equal(hasUnnegated("no fever, but a stiff neck", /\bstiff neck\b/), true);
    assert.equal(hasUnnegated("no stiff neck", /\bstiff neck\b/), false);
  });
});
