import {
  apiErrorResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  healthLogCreateResponseSchema,
  healthLogCreateSchema,
  healthLogListQuerySchema,
  healthLogListResponseSchema,
  profileResponseSchema,
  profileUpdateSchema,
  type ChatRequest,
  type ChatResponse,
  type HealthLogCreateRequest,
  type HealthLogCreateResponse,
  type HealthLogListResponse,
  type ProfileResponse,
  type ProfileUpdateRequest,
} from "@/lib/validations";
import {
  mockAiUnavailableError,
  mockChatAssessmentResponse,
  mockChatFollowUpResponse,
  mockChatUrgentResponse,
} from "@/lib/mocks/api-fixtures";

const REQUEST_TIMEOUT_MS = 10_000;

class ApiClientError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  schema: { parse: (value: unknown) => T },
  expectedStatus: number,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiClientError("The request timed out. Please try again.", true);
    }
    throw new ApiClientError("The server is unavailable. Please try again.", true);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      response.ok
        ? "The server returned an invalid response. Please try again."
        : `The request failed with status ${response.status}.`,
      !response.ok,
    );
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(body);
    if (parsedError.success) {
      throw new ApiClientError(parsedError.data.error.message, response.status >= 500);
    }
    throw new ApiClientError(`The request failed with status ${response.status}.`, response.status >= 500);
  }

  if (response.status !== expectedStatus) {
    throw new ApiClientError(`The server returned status ${response.status}. Please try again.`);
  }

  return schema.parse(body);
}

export async function getProfile(): Promise<ProfileResponse> {
  return requestJson("/api/profile", { method: "GET" }, profileResponseSchema, 200);
}

export async function updateProfile(
  input: ProfileUpdateRequest,
): Promise<ProfileResponse> {
  const validatedInput = profileUpdateSchema.parse(input);
  const patch = Object.fromEntries(
    Object.entries(validatedInput).filter(([, value]) => value !== undefined),
  );

  return requestJson(
    "/api/profile",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    profileResponseSchema,
    200,
  );
}

export async function listHealthLogs(limit?: number): Promise<HealthLogListResponse> {
  const query = healthLogListQuerySchema.parse({ limit });
  const params = new URLSearchParams({ limit: String(query.limit) });

  return requestJson(
    `/api/health-logs?${params.toString()}`,
    { method: "GET" },
    healthLogListResponseSchema,
    200,
  );
}

export async function getHealthLogs(limit?: number): Promise<HealthLogListResponse> {
  return listHealthLogs(limit);
}

export async function createHealthLog(
  input: HealthLogCreateRequest,
): Promise<HealthLogCreateResponse> {
  const validatedInput = healthLogCreateSchema.parse(input);
  const payload = Object.fromEntries(
    Object.entries(validatedInput).filter(
      ([key, value]) => key !== "loggedAt" && value !== undefined,
    ),
  );

  return requestJson(
    "/api/health-logs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    healthLogCreateResponseSchema,
    201,
  );
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
