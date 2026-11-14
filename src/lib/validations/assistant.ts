import { z } from "zod";

/** Disclaimer text from docs/API_CONTRACTS.md; every completed assessment must carry it. */
export const ASSESSMENT_DISCLAIMER =
  "This is educational information, not a diagnosis or substitute for professional medical care.";

/** POST /api/assistant/chat body. `sessionId` is null for a new conversation. */
export const chatRequestSchema = z.strictObject({
  sessionId: z.uuid().nullable(),
  message: z.string().trim().min(1).max(2000),
});

export const chatStatusSchema = z.enum(["follow_up", "assessment", "urgent"]);

/** Same values as symptom_sessions.urgency_level in the migration. */
export const safetyLevelSchema = z.enum(["routine", "prompt", "urgent"]);

export const safetyResultSchema = z.strictObject({
  level: safetyLevelSchema,
  triggered: z.boolean(),
  message: z.string().min(1).nullable(),
});

export const supportingHistorySchema = z.strictObject({
  logId: z.uuid(),
  date: z.iso.date(), // YYYY-MM-DD
  observation: z.string().min(1),
});

export const possibleExplanationSchema = z.strictObject({
  title: z.string().min(1),
  whyItMayBeRelevant: z.string().min(1),
  supportingHistory: z.array(supportingHistorySchema),
  unknowns: z.array(z.string().min(1)),
});

/** Only URLs supplied by the curated reference layer may appear here. */
export const sourceSchema = z.strictObject({
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.httpUrl(),
});

export const assessmentSchema = z.strictObject({
  summary: z.string().min(1),
  possibleExplanations: z.array(possibleExplanationSchema),
  nextSteps: z.array(z.string().min(1)),
  sources: z.array(sourceSchema),
  disclaimer: z.string().min(1),
});

/**
 * POST /api/assistant/chat response.
 * Cross-field rules enforce the contract's status semantics:
 * - follow_up: at least one follow-up question, no assessment.
 * - assessment: assessment present.
 * - urgent: deterministic safety result triggered with a message, no assessment.
 */
export const chatResponseSchema = z
  .strictObject({
    sessionId: z.uuid(),
    status: chatStatusSchema,
    assistantMessage: z.string().min(1),
    followUpQuestions: z.array(z.string().min(1)),
    safety: safetyResultSchema,
    assessment: assessmentSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.safety.triggered && value.safety.message === null) {
      ctx.addIssue({
        code: "custom",
        path: ["safety", "message"],
        message: "A triggered safety result must include a message.",
      });
    }
    if (value.status === "follow_up") {
      if (value.followUpQuestions.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["followUpQuestions"],
          message: "follow_up responses need at least one question.",
        });
      }
      if (value.assessment !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["assessment"],
          message: "follow_up responses must not include an assessment.",
        });
      }
    }
    if (value.status === "assessment" && value.assessment === null) {
      ctx.addIssue({
        code: "custom",
        path: ["assessment"],
        message: "assessment responses must include an assessment.",
      });
    }
    if (value.status === "urgent") {
      if (!value.safety.triggered || value.safety.level !== "urgent") {
        ctx.addIssue({
          code: "custom",
          path: ["safety"],
          message: "urgent responses require a triggered urgent safety result.",
        });
      }
      if (value.assessment !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["assessment"],
          message: "urgent responses must not include an ordinary assessment.",
        });
      }
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatStatus = z.infer<typeof chatStatusSchema>;
export type SafetyLevel = z.infer<typeof safetyLevelSchema>;
export type SafetyResult = z.infer<typeof safetyResultSchema>;
export type SupportingHistory = z.infer<typeof supportingHistorySchema>;
export type PossibleExplanation = z.infer<typeof possibleExplanationSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
