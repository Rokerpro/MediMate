// Provider-agnostic types for the assistant. No I/O here.
import type { HealthLog, Profile } from "@/lib/validations";

import type { CuratedReference } from "../health/references.ts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Everything a provider may use for one turn. Already filtered and bounded. */
export type ModelContext = {
  currentMessage: string;
  priorMessages: readonly ChatMessage[];
  priorUserMessageCount: number;
  profile: Profile;
  relevantLogs: readonly HealthLog[];
  /** Last-7-days sleep/fluids/activity/mood logs not already in relevantLogs. */
  recentMeasurementLogs: readonly HealthLog[];
  references: readonly CuratedReference[];
  /** True once enough follow-up rounds have happened; the model must assess. */
  mustAssess: boolean;
  /** True on the single repair attempt after invalid output. */
  isRepair: boolean;
};

export type ModelRequest = { system: string; user: string; context: ModelContext };

export interface LlmProvider {
  readonly name: string;
  /** Returns the raw model text (expected to be one JSON object). */
  complete(request: ModelRequest): Promise<string>;
}

/** The provider failed, timed out, is not configured, or produced unusable output. Maps to 503. */
export class AiUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`AI unavailable: ${reason}`);
    this.name = "AiUnavailableError";
    this.reason = reason;
  }
}
