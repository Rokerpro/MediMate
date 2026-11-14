---
name: api-contracts
description: ESSENTIAL. Load whenever code sends, receives, validates or mocks MediMate API data — Route Handlers, frontend fetch/data-access code, forms, mocks, or any change to request/response shapes. Covers docs/API_CONTRACTS.md, request/response formats, Zod validation, the shared error envelope and preventing frontend/backend contract drift.
---

# API contracts

`docs/API_CONTRACTS.md` is the agreement between frontend (Person B) and backend (Person A). Code in `src/lib/validations/` is its executable form.

## 1. One source of truth

- Import schemas and types from `@/lib/validations`. **Never hand-write request or response types** in components, hooks or handlers.
- Types are inferred from Zod with `z.infer`. If a shape is wrong, fix the schema, not a local copy.
- Mock data lives in `src/lib/mocks/api-fixtures.ts` and is typed with the shared types. `tests/contracts.test.ts` validates it.

## 2. Endpoints and schemas

| Endpoint | Request schema | Response schema | Success |
|---|---|---|---|
| `GET /api/profile` | none | `profileResponseSchema` | 200 |
| `PATCH /api/profile` | `profileUpdateSchema` | `profileResponseSchema` | 200 |
| `GET /api/health-logs?limit=` | `healthLogListQuerySchema` | `healthLogListResponseSchema` | 200 |
| `POST /api/health-logs` | `healthLogCreateSchema` | `healthLogCreateResponseSchema` | **201** |
| `POST /api/assistant/chat` | `chatRequestSchema` | `chatResponseSchema` | 200 |

Key rules:

- Requests are strict objects, so unknown keys (like `id`) are rejected.
- IDs are UUIDs.
- `loggedAt` is ISO 8601.
- `supportingHistory.date` is `YYYY-MM-DD`.
- `chatResponseSchema` enforces the consistency between `status`, `safety` and `assessment`.

## 3. Validation

- **Server:** validate every body and query with `safeParse` on `unknown` input. Invalid JSON and schema failures both return 400 `VALIDATION_ERROR`. The message should be user-safe; do not echo raw input back.
- **Server responses:** build them from typed objects. For LLM-derived data, `safeParse` against the response schema before returning (see the `medical-safety` skill).
- **Frontend:** validate forms with the same schemas, and show field-level messages from `error.issues`. Treat fetched JSON as `unknown` and parse it with the response schema or the error schema before use.

## 4. Error handling

- Every error uses `{ "error": { "code", "message" } }` (`apiErrorResponseSchema`), with its status from `API_ERROR_STATUS`:
  - `VALIDATION_ERROR` 400
  - `NOT_FOUND` 404
  - `RATE_LIMITED` 429
  - `INTERNAL_ERROR` 500
  - `AI_UNAVAILABLE` 503
- Never include stack traces, SQL or Supabase errors, provider bodies or keys.
- The frontend handles each code. 503 shows a retryable message, and no request may leave the UI loading forever.

## 5. Preventing drift

1. A shape change starts with `docs/API_CONTRACTS.md`. Tell the other developer before touching the implementation.
2. Then update the Zod schema, the fixtures and `tests/contracts.test.ts` in the **same commit**.
3. Backend returns the full agreed shape even if a field is temporarily empty (`[]`, `null`). Never omit keys.
4. Frontend keeps all data access in one module, so swapping mocks for real `fetch` calls changes only that file.
5. Run `npm test` and `npm run typecheck`. A contract change that breaks the other side's types should fail here, not at the demo.

## 6. Verify

- Run `npm test` (the contract tests) and `npm run typecheck`.
- For a real endpoint: `curl` it and confirm that the success response parses with the response schema, a bad body returns 400 with the envelope, and an unknown ID returns 404.
