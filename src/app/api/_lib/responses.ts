import "server-only";

import type { ZodError } from "zod";

import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabase/server";
import { API_ERROR_STATUS, type ApiErrorCode } from "@/lib/validations";

// Shared helpers for Route Handlers. `_lib` is a private folder, so it is not a route.

const MAX_BODY_CHARS = 20_000;

/** The shared error envelope: `{ error: { code, message } }` with the matching status. */
export function apiError(code: ApiErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status: API_ERROR_STATUS[code] });
}

/** 400 with a short, user-safe summary of the first few validation issues. */
export function validationError(error: ZodError): Response {
  const details = error.issues
    .slice(0, 3)
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
  return apiError("VALIDATION_ERROR", `Invalid request. ${details}`.slice(0, 500));
}

/** Reads a JSON body as `unknown`. Returns a 400 response for empty, oversized or malformed JSON. */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: apiError("VALIDATION_ERROR", "Could not read the request body.") };
  }
  if (text.length > MAX_BODY_CHARS) {
    return { ok: false, response: apiError("VALIDATION_ERROR", "Request body is too large.") };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: apiError("VALIDATION_ERROR", "Request body must be valid JSON.") };
  }
}

/**
 * Logs a short, content-free description of an unexpected error and returns a
 * generic 500. Never logs request bodies or health content, and never forwards
 * Supabase/provider details to the client.
 */
export function internalError(error: unknown, context: string): Response {
  let summary: string;
  if (error instanceof SupabaseConfigError) summary = "supabase env vars missing";
  else if (error instanceof SupabaseRequestError) summary = error.message;
  else if (error instanceof Error) summary = error.name;
  else summary = "unknown error";
  console.error(`[api] ${context}: ${summary}`);
  return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.");
}
