import { z } from "zod";

import { assessmentSchema, safetyResultSchema } from "./assistant.ts";

/**
 * POST /api/insights/weekly response (docs/API_CONTRACTS.md §3d).
 * - "summary": educational summary of the last 7 days of logs, with the usual assessment and disclaimer.
 * - "no_data": no logs in the last 7 days; nothing was sent to the AI model.
 * - "urgent": a log this week matched an urgent warning rule; no AI call, `safety.message` must be shown.
 */
export const weeklySummaryResponseSchema = z
  .strictObject({
    status: z.enum(["summary", "no_data", "urgent"]),
    weekStart: z.iso.date(),
    weekEnd: z.iso.date(),
    logCount: z.int().min(0).max(100),
    safety: safetyResultSchema,
    assistantMessage: z.string().min(1),
    assessment: assessmentSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (value.safety.triggered !== (value.safety.level !== "routine")) {
      issue("safety", "triggered must be true exactly when the safety level is prompt or urgent.");
    }
    if (value.safety.triggered && value.safety.message === null) issue("safety", "A triggered result needs its message.");
    if (value.status === "summary" && (value.assessment === null || value.safety.level === "urgent")) {
      issue("assessment", "A summary needs an assessment and cannot be urgent.");
    }
    if (value.status === "urgent" && (value.assessment !== null || value.safety.level !== "urgent")) {
      issue("assessment", "An urgent result has no assessment and an urgent safety level.");
    }
    if (value.status === "no_data" && (value.assessment !== null || value.logCount !== 0 || value.safety.triggered)) {
      issue("status", "no_data has no logs, no assessment and no safety match.");
    }
  });

export type WeeklySummaryResponse = z.infer<typeof weeklySummaryResponseSchema>;
