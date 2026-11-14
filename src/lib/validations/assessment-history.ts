import { z } from "zod";

import { assessmentSchema, safetyLevelSchema } from "./assistant.ts";

// Read-only list of completed assistant conversations for the health summary.
// Only data that was already validated and shown to the user is returned again.

export const ASSESSMENT_HISTORY_MAX = 20;

/** GET /api/assistant/sessions?limit=5 */
export const assessmentHistoryQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(ASSESSMENT_HISTORY_MAX).default(5),
});

export const pastAssessmentSchema = z.strictObject({
  sessionId: z.uuid(),
  /** When the conversation started (UTC ISO). */
  startedAt: z.iso.datetime({ offset: true }),
  /** When the final reply was given (UTC ISO). */
  completedAt: z.iso.datetime({ offset: true }),
  /** The user's first message, as they wrote it. */
  initialConcern: z.string().min(1),
  /** "urgent" means the deterministic safety rules fired and urgent-care guidance was shown (no assessment). */
  urgencyLevel: safetyLevelSchema,
  /** The stored assessment, or null for urgent conversations or if the stored value no longer matches the contract. */
  assessment: assessmentSchema.nullable(),
});

export const assessmentHistoryResponseSchema = z.strictObject({
  sessions: z.array(pastAssessmentSchema),
});

export type AssessmentHistoryQuery = z.infer<typeof assessmentHistoryQuerySchema>;
export type PastAssessment = z.infer<typeof pastAssessmentSchema>;
export type AssessmentHistoryResponse = z.infer<typeof assessmentHistoryResponseSchema>;
