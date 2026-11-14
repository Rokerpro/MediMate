# MediMate — Shared AI Context

Last updated: 2026-11-14

This is the combined source of truth for both coding AIs. It supplements, but does not replace, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/AI_SAFETY_SPEC.md`. When these documents conflict, the executable schemas and safety specification take precedence; resolve conflicts explicitly rather than guessing.

## Current repository state

- `main` contains the merged health summary, trends, navigation polish, reminders UI, reminder API, reminder migration, and prescription abbreviation explainer.
- The merge was pushed as commit `ed81a7c` before this documentation update.
- The app is a Next.js 16.4.6 App Router application using React 19.3, TypeScript, Tailwind 4.3, Zod 4.6, Supabase PostgreSQL, and a server-side Groq-compatible AI provider.
- Node.js `>=22.18` is required.
- There is one synthetic demo profile and no authentication. Never add real health data.

## Product and safety invariants

- MediMate provides educational, non-diagnostic information; it is not a doctor or emergency service.
- Relevant history must be retrieved and shown separately from curated medical references.
- Deterministic warning checks run before the LLM and cannot be overridden by model output.
- No diagnosis claims, probabilities, confidence scores, medication timing/dose instructions, or reassurance based solely on a non-matching warning rule.
- Every assessment shows uncertainty, sources returned by the server, next steps, and the fixed disclaimer.
- Reminders are user-written, in-app-only records. They do not send notifications, suggest medication timing, or check doses.
- Every page shows: `Synthetic demo data — do not enter real health information.`

## Ownership

Person A owns:

- `src/app/api/**`
- `src/lib/ai/**`
- `src/lib/health/**`
- `src/lib/reminders/**`
- `src/lib/supabase/**`
- `supabase/**`
- Shared validation schemas and API contract changes

Person B owns:

- `src/components/**`
- `src/app/(app)/**`
- `src/lib/api-client.ts`
- Frontend hooks, forms, UI state, and presentation assets

Coordinate before editing:

- `docs/API_CONTRACTS.md`
- `docs/AI_SAFETY_SPEC.md`
- `src/lib/validations/**`
- `package.json`, root config, layout, and global styles

## Architecture and data flow

Browser UI calls Next.js Route Handlers. Route Handlers validate input with Zod, use server-side Supabase helpers, run deterministic safety logic before AI calls, validate responses, and return the shared JSON/error envelopes. The frontend parses responses through `src/lib/api-client.ts`; it must not call Supabase or an AI provider directly.

Main user flows:

- Profile: `/profile` → `/api/profile`.
- Daily logs: `/logs` → `/api/health-logs`.
- Assistant: `/assistant` → `/api/assistant/chat`.
- Reminders: `/reminders` → `/api/reminders` and `/api/reminders/{id}`.
- Printable summary: `/summary` combines profile and health-log APIs with pure 14-day trend helpers.
- Prescription explainer: backend-only deterministic endpoint `/api/prescriptions/explain`.

## Contract and schema rules

Canonical contract: `docs/API_CONTRACTS.md`.

Canonical schemas and inferred types: `src/lib/validations/`, exported through `@/lib/validations`.

Required behavior:

- Strict request objects reject unknown keys.
- IDs are UUIDs.
- Errors use `{ error: { code, message } }`.
- Frontend handles 400, 404, 429, 500, and 503 without exposing internals.
- Reminder POST requires `userConfirmed: true`; local `datetime-local` values must become ISO timestamps with a timezone offset before sending.
- Reminder GET can include inactive records; active records are first and ordered by `nextDueAt`.
- Reminder DELETE returns 204 with no response body.

## Current UI implementation

- `AppShell` owns the global notice.
- `PrimaryNavigation` marks the active route with `aria-current`.
- `/summary` contains profile/background/medication sections, 14-day charts, observations, a printable history table, and notes.
- `/reminders` contains a confirmation-before-create form, local-time conversion, active/paused list, Pause/Resume, Edit, inline Delete confirmation, and loading/empty/error/retry states.
- Reminder UI uses the shared `Reminder` schemas and only talks through `src/lib/api-client.ts`.
- The reminders page was tested at 375px with no horizontal overflow and through create → confirm → pause → resume → edit → delete. The temporary test reminder was deleted.

## Testing and delivery

Use the existing npm scripts:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

The latest reminder integration passed all four checks; the test suite reported 160 passing tests. Browser validation is still required for every UI change, including 375px layout and async loading/error/empty states where practical.

Use short-lived feature branches, focused Conventional Commits, explicit `git add` paths, and no force-pushes. Merge only after the other AI reviews changed files and the checks pass.

## Pending shared work

1. Confirm the reminders migration is applied to the deployed Supabase project.
2. Confirm the deployed Vercel build includes the merged reminders route and UI.
3. Have the backend AI fill `docs/AI_B.md` with its exact implementation, migration, safety, and deployment context.
4. Keep this file and both AI-specific context files updated after meaningful decisions or contract changes.
