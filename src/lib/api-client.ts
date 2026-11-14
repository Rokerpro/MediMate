import {
  chatRequestSchema,
  chatResponseSchema,
  healthLogCreateSchema,
  profileResponseSchema,
  type ChatRequest,
  type ChatResponse,
  type HealthLogCreateRequest,
  type HealthLogCreateResponse,
  type HealthLogListResponse,
  type ProfileResponse,
  type ProfileUpdateRequest,
} from "@/lib/validations";
import {
  healthLogCreateResponseSchema,
  healthLogListResponseSchema,
  profileUpdateSchema,
} from "@/lib/validations";
import {
  mockHealthLogCreateResponse,
  mockHealthLogListResponse,
  mockProfileResponse,
  mockAiUnavailableError,
  mockChatAssessmentResponse,
  mockChatFollowUpResponse,
  mockChatUrgentResponse,
} from "@/lib/mocks/api-fixtures";

export async function getProfile(): Promise<ProfileResponse> {
  return profileResponseSchema.parse(mockProfileResponse);
}

export async function updateProfile(
  input: ProfileUpdateRequest,
): Promise<ProfileResponse> {
  const validatedInput = profileUpdateSchema.parse(input);
  const nextProfile = {
    ...mockProfileResponse.profile,
    ...validatedInput,
  };

  return profileResponseSchema.parse({ profile: nextProfile });
}

export async function getHealthLogs(): Promise<HealthLogListResponse> {
  return healthLogListResponseSchema.parse(mockHealthLogListResponse);
}

export async function createHealthLog(
  input: HealthLogCreateRequest,
): Promise<HealthLogCreateResponse> {
  const validatedInput = healthLogCreateSchema.parse(input);
  const response = {
    log: {
      ...mockHealthLogCreateResponse.log,
      ...validatedInput,
      loggedAt: validatedInput.loggedAt ?? mockHealthLogCreateResponse.log.loggedAt,
    },
  };

  return healthLogCreateResponseSchema.parse(response);
}

export async function sendAssistantMessage(input: ChatRequest): Promise<ChatResponse> {
  const validatedInput = chatRequestSchema.parse(input);
  const normalizedMessage = validatedInput.message.toLowerCase();

  if (normalizedMessage.includes("unavailable")) {
    throw new Error(mockAiUnavailableError.error.message);
  }

  if (normalizedMessage.includes("urgent")) {
    return chatResponseSchema.parse(mockChatUrgentResponse);
  }

  const response =
    validatedInput.sessionId === null
      ? mockChatFollowUpResponse
      : mockChatAssessmentResponse;

  return chatResponseSchema.parse(response);
}
