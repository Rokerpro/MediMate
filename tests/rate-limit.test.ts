// Assistant rate limiting: sliding window, per-client and global limits,
// and urgent safety turns never limited.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runAssistantTurn } from "../src/lib/ai/assistant.ts";
import { mockProvider } from "../src/lib/ai/mock-provider.ts";
import {
  RateLimitedError,
  SlidingWindowLimiter,
  checkAssistantRateLimit,
  clientKey,
  withRateLimit,
} from "../src/lib/ai/rate-limit.ts";
import { evaluateSafety } from "../src/lib/health/safety-rules.ts";
import { DEMO_PROFILE_ID } from "../src/lib/validations/profile.ts";

const T = Date.parse("2026-11-14T12:00:00Z");

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit, then reports seconds until the oldest hit expires", () => {
    const limiter = new SlidingWindowLimiter(2, 60_000);
    assert.equal(limiter.take("a", T), 0);
    assert.equal(limiter.take("a", T + 10_000), 0);
    assert.equal(limiter.take("a", T + 20_000), 40);
    assert.equal(limiter.take("b", T + 20_000), 0, "other keys are independent");
    assert.equal(limiter.take("a", T + 60_001), 0, "window slides");
  });
});

describe("checkAssistantRateLimit", () => {
  it("throws RateLimitedError when the per-client or global limit is reached", () => {
    const limiters = { perClient: new SlidingWindowLimiter(1, 60_000), global: new SlidingWindowLimiter(2, 60_000) };
    checkAssistantRateLimit("1.1.1.1", T, limiters);
    assert.throws(() => checkAssistantRateLimit("1.1.1.1", T, limiters), RateLimitedError);
    checkAssistantRateLimit("2.2.2.2", T, limiters);
    assert.throws(() => checkAssistantRateLimit("3.3.3.3", T, limiters), RateLimitedError);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address, then x-real-ip, then a shared bucket", () => {
    assert.equal(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
    assert.equal(clientKey(new Headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
    assert.equal(clientKey(new Headers()), "unknown");
  });
});

describe("withRateLimit in a chat turn", () => {
  const profile = {
    id: DEMO_PROFILE_ID, displayName: "Alex Demo", age: 24, gender: null, location: null, heightCm: 175, weightKg: 70,
    conditions: [], allergies: [], medications: [], medicalHistory: "",
  };
  const blocked = () => {
    throw new RateLimitedError(30);
  };

  it("never limits an urgent safety turn (the provider is not called)", async () => {
    const turn = await runAssistantTurn(
      { message: "My lower back hurts and I have numbness in both legs.", priorMessages: [], profile, candidateLogs: [] },
      { provider: withRateLimit(mockProvider, blocked), evaluateSafety },
    );
    assert.equal(turn.status, "urgent");
  });

  it("rejects a normal turn when the limit is exhausted", async () => {
    await assert.rejects(
      runAssistantTurn(
        { message: "My lower back has been hurting since yesterday.", priorMessages: [], profile, candidateLogs: [] },
        { provider: withRateLimit(mockProvider, blocked), evaluateSafety },
      ),
      RateLimitedError,
    );
  });

  it("checks only once per turn", async () => {
    let checks = 0;
    const provider = withRateLimit(mockProvider, () => { checks += 1; });
    const request = { system: "", user: "", context: {} as never };
    await provider.complete(request).catch(() => undefined);
    await provider.complete(request).catch(() => undefined);
    assert.equal(checks, 1);
  });
});
