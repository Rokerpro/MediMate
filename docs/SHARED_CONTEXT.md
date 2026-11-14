# MediMate — Shared AI Context

Last updated: 2026-11-14

This is the combined source of truth for both coding AIs. Naming: `docs/AI_A.md` = frontend AI (Person B), `docs/AI_B.md` = backend/AI assistant (Person A, called "Person A" in `CLAUDE.md`). It supplements, but does not replace, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/AI_SAFETY_SPEC.md`. When these documents conflict, the executable schemas and safety specification take precedence; resolve conflicts explicitly rather than guessing.

## Current repository state

- `main` at `7ccd3ee` contains the merged health summary, trends, dashboard insights, health-log timeline, reminders UI and API, prescription explainer, assistant 429 retry handling, past-conversations API/schema, and offline safety scorecard.
- PR #2 (`feat/health-insights-journey`: PR #1 review fixes `ad87a1f`, Personal Health Insights `09ebb8b`, Interactive Health Journey `bbfdd5e`) was reviewed and merged by Person A on 2026-11-14, together with the backend past-conversations endpoint (`cd73b88`), safety scorecard (`77e37a9`), security headers (`3962e9d`) and the dose-question fix (`1312d70`). The current scorecard prints 137/137 checks; use its current output rather than the earlier 134/134 total.
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
- `/summary` also loads up to five completed assistant conversations from `GET /api/assistant/sessions?limit=5`. It labels the initial concern as the user's own words, keeps urgent-care guidance separate from routine assessment content, and shows each routine assessment's summary, possible explanations and unknowns, next steps, sources, and disclaimer. Loading, empty, error, and retry states are included.
- Browser verification on `feat/summary-conversations`: newest-first routine and urgent examples rendered at 375px without horizontal overflow; a mocked 503 plus retry-to-empty verified the error, retry, and empty states. Print-media emulation hid the app header and print button and kept each conversation card together. A synthetic back-pain turn with a negated bladder/bowel statement unexpectedly triggered urgent guidance; Person A should review this backend safety behavior.
- Prescription explainer: deterministic endpoint `/api/prescriptions/explain` (no AI, nothing stored; contract §3b), surfaced at `/prescriptions` with a shared-schema client method and accessible result cards.
- Assistant requests can be rate-limited with HTTP 429 `RATE_LIMITED`; the server returns a `Retry-After` header and does not persist the failed turn.
- Public landing page: `/` now presents the product story, real features, safety boundaries, workflow, FAQ, and entry CTA; `/dashboard` remains the app workspace.

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
- `/dashboard` loads up to 100 logs through the existing API client, shows 14-day log/sleep/pain/latest-observation tiles and reuses the 14-day pain/sleep charts. It includes loading, empty, error/retry, and success states; the statistic tiles and latest observation link to `/logs`.
- `/logs` groups entries by date, newest first, labels Today and Yesterday, shows pain and sleep in neutral small indicators, and links to `/summary`.
- `/reminders` contains a confirmation-before-create form, local-time conversion, active/paused list, Pause/Resume, Edit, inline Delete confirmation, and loading/empty/error/retry states.
- Reminder UI uses the shared `Reminder` schemas and only talks through `src/lib/api-client.ts`.
- The reminders page was tested at 375px with no horizontal overflow and through create → confirm → pause → resume → edit → delete. The temporary test reminder was deleted.
- The prescription explainer page was tested at 375px with no horizontal overflow. It always shows the API guidance and source after a successful response, including when no terms are recognized.
- Assistant `RATE_LIMITED` (429) is retryable; the chat retains the failed text, shows the server message, and retries without duplicating its transcript entry.
- Prescription example wording and the landing-page curated-source label were updated per PR #1 review; Send is disabled when it would duplicate text awaiting assistant Retry.

## Testing and delivery

Use the existing npm scripts:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

The latest checks on `feat/health-insights-journey` passed: lint, typecheck, build, and all 188 tests. Browser checks at a 375px configured viewport found no horizontal overflow on `/dashboard`, `/logs`, or `/summary`; Dashboard charts and linked insights rendered, and the timeline showed Today then Yesterday with pain/sleep indicators and a `/summary` link. The summary contained the synthetic-data notice, charts, and table. Print media could not be verified in the browser harness because `page.emulateMedia({ media: "print" })` did not make `matchMedia("print").matches` true; confirm the print-specific layout in a real browser preview. Browser validation remains required for future UI changes, including async loading/error/empty states where practical.

Use short-lived feature branches, focused Conventional Commits, explicit `git add` paths, and no force-pushes. Merge only after the other AI reviews changed files and the checks pass.

## Pending shared work

Done 2026-11-14: `0002_reminders.sql` applied in Supabase; the live Vercel site serves `/api/reminders` (200); `docs/AI_B.md` filled in by the backend assistant; PR #1 review follow-ups fixed and PR #2 merged.

1. Owner: run `supabase/reset-demo.sql` in the Supabase SQL editor just before the demo (restores Alex Demo, 14 logs dated up to today, 2 reminders; deletes all chat sessions). Then rehearse and record the backup video.
2. Person B: confirm the `/summary` print layout in a real browser print preview.
3. Pitch slide `public/pitch/safety-measured.svg` uses the latest printed scorecard values (137/137 total) and includes the required fixed-example scope footnote.
4. Workflow: Person A builds the system side and hands Person B a UI prompt; neither edits the other's files without coordinating.
5. Keep this file and both AI-specific context files synchronized after meaningful decisions or contract changes.
