// Synthetic, contract-exact mock payloads for frontend work before endpoints are merged.
// Validated against the shared schemas in tests/contracts.test.ts. Fictional data only.
// The source URL is a placeholder for mocks only; never ship it in a real assessment.
import type {
  ApiErrorResponse,
  ChatResponse,
  HealthLogCreateResponse,
  HealthLogListResponse,
  ProfileResponse,
} from "@/lib/validations";
// Relative .ts import so the Node test runner can load this module without a bundler.
import { ASSESSMENT_DISCLAIMER } from "../validations/assistant.ts";

export const mockProfileResponse: ProfileResponse = {
  profile: {
    id: "00000000-0000-4000-8000-000000000001",
    displayName: "Alex Demo",
    age: 24,
    gender: null,
    location: null,
    heightCm: 175,
    weightKg: 70,
    conditions: [],
    allergies: [],
    medications: [],
    medicalHistory: "Synthetic demonstration profile. No real patient information.",
  },
};

export const mockHealthLogListResponse: HealthLogListResponse = {
  logs: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      loggedAt: "2026-11-13T09:00:00.000Z",
      symptoms: "Mild lower back discomfort",
      painLocation: "Lower back",
      painLevel: 3,
      sleepDurationMinutes: 450,
      sleepQuality: 4,
      mood: "okay",
      waterMl: 1600,
      activityMinutes: 15,
      notes: "Synthetic note: reported a long period of sitting.",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      loggedAt: "2026-11-12T09:00:00.000Z",
      symptoms: "No specific symptom reported",
      painLocation: null,
      painLevel: null,
      sleepDurationMinutes: 360,
      sleepQuality: 2,
      mood: "tired",
      waterMl: 1400,
      activityMinutes: 50,
      notes: null,
    },
  ],
};

export const mockHealthLogEmptyListResponse: HealthLogListResponse = { logs: [] };

export const mockHealthLogCreateResponse: HealthLogCreateResponse = {
  log: {
    id: "33333333-3333-4333-8333-333333333333",
    loggedAt: "2026-11-14T09:00:00.000Z",
    symptoms: "Headache after screen time",
    painLocation: "Head",
    painLevel: 2,
    sleepDurationMinutes: null,
    sleepQuality: null,
    mood: null,
    waterMl: null,
    activityMinutes: null,
    notes: null,
  },
};

const SESSION_ID = "44444444-4444-4444-8444-444444444444";

export const mockChatFollowUpResponse: ChatResponse = {
  sessionId: SESSION_ID,
  status: "follow_up",
  assistantMessage: "Thanks for sharing that. A couple of questions will help me summarize this.",
  followUpQuestions: ["Has the pain changed since it began?", "Does it spread to your legs?"],
  safety: { level: "routine", triggered: false, message: null },
  assessment: null,
};

export const mockChatAssessmentResponse: ChatResponse = {
  sessionId: SESSION_ID,
  status: "assessment",
  assistantMessage: "Here is a summary of the information you shared.",
  followUpQuestions: [],
  safety: { level: "routine", triggered: false, message: null },
  assessment: {
    summary: "Non-diagnostic summary of the reported lower back discomfort.",
    possibleExplanations: [
      {
        title: "Possible explanation to discuss with a clinician",
        whyItMayBeRelevant:
          "Earlier logs record similar discomfort on days with long periods of sitting. This is an association, not a confirmed cause.",
        supportingHistory: [
          {
            logId: "11111111-1111-4111-8111-111111111111",
            date: "2026-11-13",
            observation: "Mild lower back discomfort (pain 3/10) after a long period of sitting.",
            matchedTerms: ["back"],
          },
        ],
        unknowns: ["Whether the discomfort changes with movement or rest."],
      },
    ],
    nextSteps: ["Consider discussing persistent symptoms with a qualified clinician."],
    sources: [
      {
        title: "Mock reference (placeholder)",
        publisher: "Mock publisher",
        url: "https://example.org/mock-reference",
      },
    ],
    disclaimer: ASSESSMENT_DISCLAIMER,
    recordedFacts: [
      'Logs mentioning "back": 6 logs on 6 days in the last 30 days, between 2026-11-02 and 2026-11-13 (3 separate stretches of days; the longest was 2 days in a row).',
      "Recorded pain on those logs: 2–4/10, average 2.8/10 (6 logs with a pain level).",
    ],
    historyConsidered: [
      {
        logId: "11111111-1111-4111-8111-111111111111",
        date: "2026-11-13",
        observation: 'symptoms: "Mild lower back discomfort"; pain location: Lower back; pain level 3/10',
        matchedTerms: ["back"],
        reason: "symptom_match",
        cited: true,
      },
      {
        logId: "22222222-2222-4222-8222-222222222222",
        date: "2026-11-12",
        observation: "sleep 6h; sleep quality 2/5; mood: tired",
        matchedTerms: [],
        reason: "recent_measurement",
        cited: false,
      },
    ],
  },
};

/** UI-only mock. Real urgent wording must come from the reviewed safety spec. */
export const mockChatUrgentResponse: ChatResponse = {
  sessionId: SESSION_ID,
  status: "urgent",
  assistantMessage: "Placeholder urgent-care message for UI development only.",
  followUpQuestions: [],
  safety: {
    level: "urgent",
    triggered: true,
    message: "Placeholder safety message for UI development only.",
  },
  assessment: null,
};

export const mockAiUnavailableError: ApiErrorResponse = {
  error: {
    code: "AI_UNAVAILABLE",
    message: "The assistant is temporarily unavailable. Please try again.",
  },
};
