---
name: nextjs-supabase
description: ESSENTIAL. Load when building or changing MediMate Next.js Route Handlers, Supabase queries, schema/migrations/seed, environment variables or data access. Covers Route Handler conventions, Supabase PostgreSQL usage, schema conventions, server-side key handling and the demo-only access model.
---

# Next.js + Supabase

Read `docs/ARCHITECTURE.md` and `supabase/migrations/` first. This is Next.js 16. APIs differ from older versions, so check `node_modules/next/dist/docs/` before using anything unfamiliar (see `AGENTS.md`).

## 1. Route Handlers

- Location: `src/app/api/<resource>/route.ts`, exporting `GET`, `POST`, `PATCH` and so on. One Next.js app; no second backend.
- Handler flow:
  1. Parse the input with `unknown`.
  2. Validate it with the shared Zod schema (see the `api-contracts` skill).
  3. Run the query.
  4. Map DB rows (snake_case) to the contract shape (camelCase).
  5. Validate or construct the response.
  6. Return `Response.json(...)` with the correct status.
- Wrap each handler body in try/catch and return the shared error envelope. Never return thrown errors, Supabase error objects or stack traces.
- In Next 16, dynamic route `params` is a Promise: `{ params }: { params: Promise<{ id: string }> }`, then `await params`.
- Handlers that read the database or env must not be statically cached. Verify with `npm run build`; the route should show as dynamic (ƒ).
- Do not log raw health content. Log only an error code or a short message.

## 2. Supabase access

- Use a single server-only client factory in `src/lib/supabase/server.ts`, and add `import "server-only"` if that package is available. Never import it from client components.
- Env vars (see `.env.example`): `SUPABASE_URL` and `SUPABASE_ANON_KEY` are **server-only, with no `NEXT_PUBLIC_` prefix**. The browser never talks to Supabase directly; it calls our Route Handlers.
- **Never use the service-role key** in any public request path. RLS must remain the guard.
- If a dependency is needed (e.g. `@supabase/supabase-js`), state why in the task report before installing it, and pin the exact version.
- Validate that env vars exist at request time, and return a safe 500 (`INTERNAL_ERROR`) if they are missing. Never crash at import time during the build.

## 3. Data access and the demo security model

- There is one fixed synthetic profile: `DEMO_PROFILE_ID` in `src/lib/validations/profile.ts`, matching `is_medimate_demo_profile()` in the migration.
- The server always uses `DEMO_PROFILE_ID`. **Never accept a profile ID from the client.**
- Scope every query to the demo profile, even though RLS also enforces it (defense in depth).
- Before reading or writing a session's messages, check that the session belongs to the demo profile. Unknown sessions return 404 `NOT_FOUND`.
- There is no user authentication in this hackathon build. Do not describe the app as suitable for real data, and keep the visible synthetic-data notice.

## 4. Queries

- Keep queries bounded: always `.limit(...)` and order explicitly (logs `logged_at desc`, messages `created_at asc`).
- History retrieval is plain SQL filtering (symptom terms, `pain_location`, a recent date window). No vector database. Return log `id` and `logged_at` so answers can cite them.
- Select only the columns you need. Do not send unrelated logs to the LLM.
- Writes that depend on a read (e.g. appending a chat turn) should handle a concurrent second request gracefully, at minimum by ordering by `created_at`.

## 5. Schema conventions

- Never edit an applied migration. Add a new numbered file, e.g. `supabase/migrations/0002_<change>.sql`.
- Conventions:
  - snake_case tables and columns;
  - `uuid` primary keys with `gen_random_uuid()`;
  - `timestamptz` with `default now()`;
  - CHECK constraints mirroring the Zod ranges;
  - RLS enabled on every table, with policies scoped to the demo profile only.
- If a column or constraint changes, update the matching Zod schema and `docs/API_CONTRACTS.md` in the same change, and tell the other developer.
- Seed data is fictional only.

## 6. Verify

- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.
- Exercise the endpoint against a running server with `curl`, covering a valid request, an invalid body (400) and an unknown ID (404).
- Grep the client bundle or source for secrets: `grep -r "SUPABASE\|ANTHROPIC" src --include=*.tsx`. No server env var may appear in a client component.
