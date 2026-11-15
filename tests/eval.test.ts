// The offline evaluation suite must meet every target (scripts/eval.ts). Synthetic data only.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EVAL_DISCLAIMER, formatMarkdown, runOfflineEval } from "../scripts/eval.ts";

describe("evaluation suite (offline)", () => {
  it("meets every target", async () => {
    const metrics = await runOfflineEval();
    const missed = metrics.filter((m) => {
      const rate = m.denominator ? m.numerator / m.denominator : 0;
      return m.lowerIsBetter ? rate > m.target : rate < m.target;
    });
    assert.deepEqual(missed.map((m) => `${m.label}: ${m.failures.slice(0, 3).join(" | ")}`), []);
    for (const id of ["emergency_recall", "false_positive_rate", "schema_validity", "evidence_accuracy", "unsupported_claim_rate", "isolation"]) {
      assert.ok(metrics.some((m) => m.id === id && m.denominator > 0), id);
    }
  });

  it("never presents the results as proof of clinical safety", async () => {
    assert.match(EVAL_DISCLAIMER, /not evidence of clinical safety/);
    assert.match(formatMarkdown(await runOfflineEval(), false), /not evidence of clinical safety/);
  });
});
