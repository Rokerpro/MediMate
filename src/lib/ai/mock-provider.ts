// Deterministic offline provider for local development, tests and demos without
// an API key (AI_PROVIDER=mock). Every text is visibly marked "[Mock]" so it can
// never be mistaken for a real analysis. Returns raw JSON like a real model,
// so it goes through the same validation path.
import type { LlmProvider, MedicineModelRequest, ModelRequest } from "./types.ts";

export const mockProvider: LlmProvider = {
  name: "mock",
  async complete(request: ModelRequest | MedicineModelRequest): Promise<string> {
    if (request.task === "medicine") {
      return JSON.stringify({
        status: "explained",
        explanation: {
          name: `[Mock] ${request.query.slice(0, 60)}`,
          alsoKnownAs: [],
          medicineType: "[Mock] Placeholder medicine type",
          whatItIsFor: "[Mock] Placeholder description of what this medicine is generally used for.",
          commonUses: ["[Mock] Placeholder use"],
          howItWorks: "[Mock] Placeholder description of how it works.",
          questionsToAsk: ["[Mock] Is this medicine suitable alongside my other medicines?"],
        },
      });
    }
    const { context } = request;
    const askFollowUp = !context.mustAssess && context.priorUserMessageCount === 0;

    if (askFollowUp) {
      return JSON.stringify({
        status: "follow_up",
        assistantMessage: "[Mock] Thanks for sharing that. A few questions to understand it better.",
        followUpQuestions: [
          "When did this start, and has it changed since then?",
          "How strong is it on a scale from 0 to 10?",
          "Does anything make it better or worse?",
        ],
        assessment: null,
      });
    }

    const supportingLogIds = context.relevantLogs.slice(0, 3).map((log) => log.id);
    return JSON.stringify({
      status: "assessment",
      assistantMessage: "[Mock] Here is a summary of the information you shared.",
      followUpQuestions: [],
      assessment: {
        summary: supportingLogIds.length
          ? "[Mock] Placeholder summary. Your recent logs include entries that may relate to what you described."
          : "[Mock] Placeholder summary. No relevant history was found in your recent logs.",
        possibleExplanations: supportingLogIds.length
          ? [
              {
                title: "[Mock] A pattern in your logs to discuss with a clinician",
                whyItMayBeRelevant:
                  "[Mock] Earlier log entries recorded similar observations. This is an association, not a cause.",
                supportingLogIds,
                unknowns: ["[Mock] How long the current symptom has lasted and whether it is changing."],
              },
            ]
          : [],
        nextSteps: [
          "Consider discussing persistent, recurring or worsening symptoms with a qualified clinician.",
          "Seek urgent professional care if symptoms are severe, sudden or getting rapidly worse.",
        ],
      },
    });
  },
};
