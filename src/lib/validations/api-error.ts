import { z } from "zod";

/**
 * Shared error envelope for every API route (docs/API_CONTRACTS.md §0, §4).
 * Messages must be user-safe: no stack traces, provider bodies or credentials.
 */
export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR", // 400
  "UNAUTHENTICATED", // 401
  "NOT_FOUND", // 404
  "CONFLICT", // 409
  "RATE_LIMITED", // 429
  "INTERNAL_ERROR", // 500
  "AI_UNAVAILABLE", // 503
]);

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(500),
  }),
});

export const API_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  AI_UNAVAILABLE: 503,
} as const satisfies Record<z.infer<typeof apiErrorCodeSchema>, number>;

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
