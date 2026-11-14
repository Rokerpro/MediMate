# AI_A — Current Project Context

Last updated: 2026-11-14

## Role and current state

This file records the context for the frontend/product AI (Person B). The reminders UI, printable health summary, navigation polish, and their frontend data-access methods are merged into `main`. The backend reminder API and validation contract were merged into the same branch before the final integration.

The current `main` branch is deployable at commit `ed81a7c` before this documentation change. Do not assume that a feature is deployed just because it is merged; verify the deployed app separately.

## Product

MediMate is a history-aware, educational health-information prototype for one synthetic demo profile. It is not a doctor, diagnostic device, emergency service, or medical-record system.

P0:

- Synthetic profile view/edit.
- Daily health log create/list.
- Multi-turn assistant chat with relevant history retrieval.
- Deterministic warning checks before the LLM.
- Non-diagnostic assessment, uncertainty, sources, next steps, and disclaimer.

Integrated UI stretch work:

- Plain-SVG 14-day pain and sleep trends.
- Printable doctor-readable summary at `/summary`.
- User-controlled in-app reminders at `/reminders`.

Out of scope: diagnosis, probabilities, disease prediction, image analysis, voice, wearables, native apps, push/SMS/email notifications, model training, vector search, and broad web crawling.

## Architecture

- One Next.js 16 App Router application; no separate backend service.
- Server Route Handlers own Supabase and AI calls.
- Supabase PostgreSQL stores the synthetic profile, health logs, sessions, and reminders.
- Supabase is accessed through server-side REST helpers and demo-only RLS.
- Zod schemas in `src/lib/validations/` are the shared executable API contract.
- Frontend calls are centralized in `src/lib/api-client.ts`.
- Client components are used only where interaction or browser APIs require them.
- Every app page is wrapped by `src/components/app-shell.tsx`, which shows the synthetic-data notice.

Runtime assistant flow:

1. Validate the request.
2. Load the fixed synthetic profile and bounded recent history.
3. Run deterministic safety rules.
4. Return urgent guidance immediately if a rule matches.
5. Retrieve curated references and call the configured provider.
6. Validate and sanitize structured model output.
7. Persist and return the typed response.

## Responsibilities and ownership

Person A / backend and AI:

- `src/app/api/**`
- `src/lib/ai/**`
- `src/lib/health/**`
- `src/lib/reminders/**`
- `src/lib/supabase/**`
- `supabase/**`
- Shared validation schemas and server-side contract changes

Person B / frontend and product:

- `src/components/**`
- `src/app/(app)/**`
- `src/lib/api-client.ts`
- Frontend hooks, forms, UI state, and presentation assets

Shared/coordinate first:

- `docs/API_CONTRACTS.md`
- `docs/AI_SAFETY_SPEC.md`
- `src/lib/validations/**`
- `package.json`, root config, layout/global styles
- Database/API contract changes

Never edit a protected backend or validation file as a frontend workaround. If the contract is wrong, notify Person A and update the contract/schema together.

## Frontend implementation details

### Shell and navigation

- `AppShell` renders the global synthetic-data warning.
- `PrimaryNavigation` uses `usePathname()` and `aria-current="page"` for active links.
- Navigation currently includes Dashboard, Profile, Daily logs, Assistant, Reminders, and Summary.
- Focus-visible rings and keyboard-operable controls are required.

### API client

`src/lib/api-client.ts`:

- Parses successful JSON with the corresponding Zod response schema.
- Parses the standard `{ error: { code, message } }` envelope.
- Uses bounded request timeouts and safe retryable errors.
- Reminder methods are `listReminders`, `createReminder`, `updateReminder`, and `deleteReminder`.
- DELETE handles the contract's `204 No Content` response separately.

### Reminders UI

`src/components/reminders.tsx` and `/reminders`:

- Loads active and inactive reminders with `includeInactive=true` so paused reminders can be resumed.
- Creation is a two-step flow: enter fields, review the user's wording/timing, then explicitly confirm and save with `userConfirmed: true`.
- Uses `datetime-local`, converts local input to an ISO timestamp with the local offset, and never suggests medication content or timing.
- Supports Pause/Resume, Edit, and inline Delete confirmation. It never uses `window.confirm`.
- A reminder 404 refreshes the list because another actor may have removed it.
- Includes loading, empty (`No reminders yet`), error, retry, and success states.
- Required safety copy states that reminders are user-set, medication timing/doses are not suggested or checked, pharmacists/prescribers should answer medication questions, and reminders are in-app only.

### Printable summary

`src/components/health-summary.tsx`, `src/components/health-trends.tsx`, and `/summary`:

- Uses existing profile and health-log APIs.
- Keeps the 14-day trend helpers in `src/lib/health/trends.ts` pure and unchanged.
- Shows user-reported data, not diagnostic indicators.
- Includes the patient-provided, non-diagnostic, clinician-review, synthetic-data wording.
- Print-only styling hides the app header and print button, keeps the synthetic notice, stacks charts on narrow print widths, wraps the seven-column table, and allows the history section to break across pages.

## API contract summary

The canonical contract is `docs/API_CONTRACTS.md`; schemas are exported from `@/lib/validations`.

- `GET/PATCH /api/profile`
- `GET/POST /api/health-logs`
- `POST /api/assistant/chat`
- `GET /api/reminders?includeInactive=true|false`
- `POST /api/reminders` with `userConfirmed: true`
- `PATCH/DELETE /api/reminders/{id}`
- `POST /api/prescriptions/explain` for deterministic abbreviation explanations

All errors use the shared error envelope. Frontend must handle 400, 404, 429, 500, and 503 safely. Reminder `DELETE` returns 204 with no body. Do not duplicate these shapes in UI code.

## Safety decisions

- Do not use diagnosis labels, probabilities, confidence scores, or medication start/stop/dose instructions.
- Do not imply that no warning rule means the user is safe.
- Keep recorded facts, user statements, curated reference facts, and model interpretation distinct.
- Every assessment needs uncertainty, next steps, sources from the curated server set, and the fixed disclaimer.
- Reminders are not notifications and must never be presented as medication advice.
- Only synthetic data may appear in fixtures, screenshots, seeds, or demos.

## Engineering conventions

- TypeScript strict; use `unknown` plus Zod validation instead of `any`.
- Tailwind only for UI styling; no new dependencies without agreement.
- Prefer Server Components; use Client Components for forms, browser APIs, and interactive state.
- Every async UI has loading, empty, error, retry, and success states.
- Use Windows paths for shell commands in this environment.
- Use focused Conventional Commits and stage specific files; never commit `.env*` secrets.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` at milestones.

## Verification completed

The reminders UI was tested in the browser at 375px:

1. Create a reminder.
2. Review and confirm it.
3. Pause it.
4. Resume it.
5. Edit its title.
6. Delete it with inline confirmation.

The temporary test reminder was confirmed absent from the API list afterward. The final checks passed: lint, typecheck, build, and 160 tests.

## Pending work and coordination

- Verify the merged `supabase/migrations/0002_reminders.sql` is applied in the deployed Supabase project before demo use.
- Verify the deployed Vercel build contains `/reminders` and the merged API.
- Keep `docs/AI_A.md`, `docs/AI_B.md`, and `docs/SHARED_CONTEXT.md` synchronized after meaningful architecture, contract, ownership, or deployment changes.
- Do not create real reminders, logs, or health data in the shared demo database for testing.
- Before starting a task, inspect `git status`, read all context files, and check whether the other AI has changed the files you need.
