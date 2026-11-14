// Fixed examples for every deterministic safety rule (AI_SAFETY_SPEC.md §5, §9.1).
// For each rule: positive (must fire), negative (negated, must not fire) and
// ambiguous (near-miss that is not on the NHS 999 list, must not fire this rule).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SAFETY_RULES, evaluateSafety, hasUnnegated } from "../src/lib/health/safety-rules.ts";

type Case = { ruleId: string; positive: string[]; negative: string[]; ambiguous: string[] };

const CASES: Case[] = [
  {
    ruleId: "back-both-legs",
    positive: [
      "My lower back hurts and I have numbness in both legs.",
      "Back pain, and my legs feel weak and tingly.",
      "My back hurts and the pain is going down both of my legs.",
    ],
    negative: ["My lower back hurts. No numbness or tingling in my legs.", "Back pain but my legs are not weak."],
    ambiguous: ["Back pain with some numbness in my left leg.", "Back pain, my legs are fine."],
  },
  {
    ruleId: "back-saddle-numbness",
    positive: ["Back pain and I can't feel anything around my groin.", "My back hurts and there is numbness around my bottom."],
    negative: ["Back pain, no numbness around my groin."],
    ambiguous: ["Back pain and my bottom is sore from sitting."],
  },
  {
    ruleId: "back-bladder-bowel",
    positive: ["My back hurts and I can't pee since this morning.", "Back pain and I wet myself today.", "Back pain with changes in my bladder."],
    negative: ["Back pain but no changes in my bladder or bowels."],
    ambiguous: ["Back pain and I need to pee more often after drinking coffee."],
  },
  {
    ruleId: "back-sexual-function",
    positive: ["Lower back pain and I can't get an erection anymore."],
    negative: ["Back pain, no erectile problems."],
    ambiguous: ["Back pain makes sex uncomfortable."],
  },
  {
    ruleId: "back-chest-pain",
    positive: ["My upper back hurts and I also have chest pain."],
    negative: ["Back pain but no chest pain."],
    ambiguous: ["Back pain and my chest feels a bit stiff after the gym."],
  },
  {
    ruleId: "back-serious-accident",
    positive: ["My back has hurt since a car accident yesterday."],
    negative: ["Back pain, but I was not in a car accident."],
    ambiguous: ["My back hurts after I tripped on a step."],
  },
  {
    ruleId: "headache-seizure",
    positive: ["I had a seizure and now I have a bad headache."],
    negative: ["Headache since morning, never had a seizure."],
    ambiguous: ["Headache after a workout, I'm trying to get fit."],
  },
  {
    ruleId: "headache-numbness-weakness",
    positive: ["Headache and my face feels numb on one side.", "I have a headache and my arm is weak."],
    negative: ["Headache, no numbness in my face or arms."],
    ambiguous: ["Headache and I feel tired today."],
  },
  {
    ruleId: "headache-sudden-severe",
    positive: ["The headache came on suddenly and it is the worst pain ever.", "My headache started out of nowhere, 10 out of 10."],
    negative: ["My headache was not sudden, it is the worst in the evenings though."],
    ambiguous: ["I have a severe headache that built up slowly over the day."],
  },
  {
    ruleId: "headache-head-injury",
    positive: ["I hit my head last week and now I have a headache."],
    negative: ["Headache, but I did not hit my head."],
    ambiguous: ["Headache at the front of my head."],
  },
  {
    ruleId: "headache-speech-balance-memory",
    positive: ["Headache and I'm finding it hard to speak.", "Headache and my speech is slurred."],
    negative: ["Headache but no trouble speaking or walking."],
    ambiguous: ["Headache after a long walk."],
  },
  {
    ruleId: "headache-drowsy-confused",
    positive: ["Headache and I feel drowsy and confused."],
    negative: ["Headache, not confused or drowsy."],
    ambiguous: ["Headache and I feel a bit sleepy after lunch."],
  },
  {
    ruleId: "headache-vision-loss",
    positive: ["Headache and I suddenly can't see out of one eye."],
    negative: ["Headache, no loss of vision."],
    ambiguous: ["Headache and my eyes feel tired from the screen."],
  },
  {
    ruleId: "headache-non-fading-rash",
    positive: ["Headache and a rash that doesn't fade when I press a glass on it."],
    negative: ["Headache. No rash."],
    ambiguous: ["Headache and an itchy rash on my arm that fades when pressed."],
  },
  {
    ruleId: "headache-fever-stiff-neck-light",
    positive: ["Headache with a stiff neck.", "Headache and bright lights are bothering me.", "Headache and a very high temperature."],
    negative: ["Headache, no stiff neck and no fever."],
    ambiguous: ["Headache and my neck is a little sore from my pillow."],
  },
];

describe("safety rule register", () => {
  it("every rule has fixed test cases, and every case names a real rule", () => {
    const ruleIds = SAFETY_RULES.map((rule) => rule.id).sort();
    assert.deepEqual(CASES.map((c) => c.ruleId).sort(), ruleIds);
  });

  it("every rule cites one of the recorded NHS sources and a review date", () => {
    for (const rule of SAFETY_RULES) {
      assert.match(rule.sourceUrl, /^https:\/\/www\.nhs\.uk\/conditions\/(back-pain|headaches)\/$/);
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

describe("evaluateSafety behaviour", () => {
  it("requires the symptom context (warning sign alone does not fire a back/headache rule)", () => {
    assert.equal(evaluateSafety(["I have numbness in both legs."]).result.triggered, false);
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
