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
  reminderCreateSchema,
  reminderListResponseSchema,
  reminderResponseSchema,
  reminderUpdateSchema,
  prescriptionExplainRequestSchema,
  prescriptionExplainResponseSchema,
  type ReminderCreateRequest,
  type ReminderListResponse,
  type ReminderResponse,
  type ReminderUpdateRequest,
  type ChatRequest,
  type ChatResponse,
  type HealthLogCreateRequest,
  type HealthLogCreateResponse,
  type HealthLogListResponse,
  type ProfileResponse,
  type ProfileUpdateRequest,
  type PrescriptionExplainRequest,
  type PrescriptionExplainResponse,
} from "@/lib/validations";

const REQUEST_TIMEOUT_MS = 10_000;
const CHAT_REQUEST_TIMEOUT_MS = 30_000;
export const API_REQUEST_ACTIVITY_EVENT = "medimate:api-request-activity";

let apiRequestSequence = 0;
const activeApiRequests = new Set<string>();

function dispatchApiRequestActivity(requestId: string, active: boolean) {
  if (typeof window === "undefined") return;
  if (active) activeApiRequests.add(requestId);
  else activeApiRequests.delete(requestId);
  window.dispatchEvent(
    new CustomEvent(API_REQUEST_ACTIVITY_EVENT, {
      detail: { requestId, active },
    }),
  );
}

export function getActiveApiRequestIds(): string[] {
  return Array.from(activeApiRequests);
}

async function trackApiRequest<T>(request: () => Promise<T>): Promise<T> {
  const requestId = String(++apiRequestSequence);
  dispatchApiRequestActivity(requestId, true);
  try {
    return await request();
  } finally {
    dispatchApiRequestActivity(requestId, false);
  }
}

export class ApiClientError extends Error {
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
  return trackApiRequest(() =>
    requestJsonWithoutTracking(input, init, schema, expectedStatus, timeoutMs),
  );
}

async function requestJsonWithoutTracking<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  schema: { parse: (value: unknown) => T },
  expectedStatus: number,
  timeoutMs: number,
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
        response.status === 429 || response.status >= 500,
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
      throw new ApiClientError(
        "This conversation has expired. Please start over.",
        false,
        404,
      );
    }
    throw error;
  }
}

export async function listReminders(includeInactive = true): Promise<ReminderListResponse> {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) });
  return requestJson(
    `/api/reminders?${params.toString()}`,
    { method: "GET" },
    reminderListResponseSchema,
    200,
  );
}

export async function createReminder(input: ReminderCreateRequest): Promise<ReminderResponse> {
  const validatedInput = reminderCreateSchema.parse(input);
  return requestJson(
    "/api/reminders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validatedInput),
    },
    reminderResponseSchema,
    201,
  );
}

export async function updateReminder(
  id: string,
  input: ReminderUpdateRequest,
): Promise<ReminderResponse> {
  const validatedInput = reminderUpdateSchema.parse(input);
  return requestJson(
    `/api/reminders/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validatedInput),
    },
    reminderResponseSchema,
    200,
  );
}

export async function deleteReminder(id: string): Promise<void> {
  return trackApiRequest(async () => {
    let response: Response;
    try {
      response = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ApiClientError("The server is unavailable. Please try again.", true);
    }

    if (response.status === 204) return;

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiClientError(
        `The request failed with status ${response.status}.`,
        response.status >= 500,
        response.status,
      );
    }

    if (!response.ok) {
      const parsedError = apiErrorResponseSchema.safeParse(body);
      throw new ApiClientError(
        parsedError.success ? parsedError.data.error.message : `The request failed with status ${response.status}.`,
        response.status >= 500,
        response.status,
      );
    }

    throw new ApiClientError(`The server returned status ${response.status}. Please try again.`);
  });
}

export async function explainPrescription(
  input: PrescriptionExplainRequest,
): Promise<PrescriptionExplainResponse> {
  const validatedInput = prescriptionExplainRequestSchema.parse(input);
  return requestJson(
    "/api/prescriptions/explain",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validatedInput),
    },
    prescriptionExplainResponseSchema,
    200,
  );
}
