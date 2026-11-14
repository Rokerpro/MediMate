// Best-effort, in-memory rate limiting for LLM calls (public demo on a free-tier
// provider). State is per server instance, so on Vercel it limits each instance,
// not the whole deployment. It only guards provider calls: deterministic safety
// replies are never rate-limited. Client keys are never logged.
import type { LlmProvider, ModelRequest } from "./types.ts";

export const PER_CLIENT_LIMIT = 6;
export const GLOBAL_LIMIT = 20;
export const WINDOW_MS = 60_000;

/** Too many assistant turns. Maps to HTTP 429. */
export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Rate limited");
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Sliding-window counter per key. */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  // Plain fields, not parameter properties: tests run with Node's type stripping.
  constructor(limit: number, windowMs: number, maxKeys = 5000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  /** Records a hit and returns 0, or returns the seconds to wait without recording. */
  take(key: string, now: number): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return Math.max(1, Math.ceil((recent[0]! + this.windowMs - now) / 1000));
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.prune(now);
    return 0;
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits) {
      if (!times.some((t) => t > now - this.windowMs)) this.hits.delete(key);
    }
  }
}

const perClient = new SlidingWindowLimiter(PER_CLIENT_LIMIT, WINDOW_MS);
const global = new SlidingWindowLimiter(GLOBAL_LIMIT, WINDOW_MS);

/** First address in x-forwarded-for (set by Vercel), else x-real-ip, else a shared bucket. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Checks both limits once; throws RateLimitedError when either is exhausted. */
export function checkAssistantRateLimit(key: string, now: number = Date.now(), limiters = { perClient, global }): void {
  const clientWait = limiters.perClient.take(key, now);
  if (clientWait > 0) throw new RateLimitedError(clientWait);
  const globalWait = limiters.global.take("global", now);
  if (globalWait > 0) throw new RateLimitedError(globalWait);
}

/**
 * Wraps a provider so the rate limit is checked on the first model call of a
 * turn only (the repair retry is part of the same turn). Urgent safety turns
 * never call the provider, so they are never limited.
 */
export function withRateLimit(provider: LlmProvider, check: () => void): LlmProvider {
  let checked = false;
  return {
    name: provider.name,
    complete(request: ModelRequest): Promise<string> {
      if (!checked) {
        checked = true;
        check();
      }
      return provider.complete(request);
    },
  };
}
