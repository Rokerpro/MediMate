// The pitch scorecard (scripts/safety-scorecard.ts) must stay at 100% on its fixed examples.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runScorecard } from "../scripts/safety-scorecard.ts";

describe("safety scorecard", () => {
  it("passes every fixed example", async () => {
    const { lines, allPassed } = await runScorecard();
    const failures = lines.flatMap((l) => l.failures.map((f) => `${l.label}: ${f}`));
    assert.deepEqual(failures, []);
    assert.equal(allPassed, true);
    assert.ok(lines.every((l) => l.total > 0));
  });
});
