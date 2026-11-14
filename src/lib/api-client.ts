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

const REQUEST_TIMEOUT_MS = 10_000;
const CHAT_REQUEST_TIMEOUT_MS = 30_000;

class ApiClientError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly status?: number,
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
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
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
      throw new ApiClientError(
        parsedError.data.error.message,
        response.status >= 500,
        response.status,
      );
    }
    throw new ApiClientError(
      `The request failed with status ${response.status}.`,
      response.status >= 500,
      response.status,
    );
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
  try {
    return await requestJson(
      "/api/assistant/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedInput),
      },
      chatResponseSchema,
      200,
      CHAT_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404 && validatedInput.sessionId !== null) {
      return sendAssistantMessage({ ...validatedInput, sessionId: null });
    }
    throw error;
  }
}
