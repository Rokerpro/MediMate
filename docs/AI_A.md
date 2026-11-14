# AI_A — Current Project Context

Last updated: 2026-11-14

## Role and current state

This file records the context for the frontend/product AI (Person B). The reminders UI, printable health summary, prescription explainer UI, and their frontend data-access methods are on `main`. The current frontend task adds completed assistant-conversation history to the printable summary.

The current work is on `feat/summary-conversations`, based on `main` at `7ccd3ee`. The backend `GET /api/assistant/sessions` endpoint and shared response schema are already merged; this branch adds frontend presentation and a pitch slide. Do not assume that a feature is deployed just because it is merged; verify the deployed app separately.

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
- Dashboard health insights and a date-grouped health-log timeline.

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

### Public landing page and visual language

- `/` is now a public landing page; `/dashboard` remains the demo workspace entry point.
- `src/components/landing-page.tsx` uses real MediMate features and safe product copy across hero, benefits, workflow, showcase, technology, roadmap, FAQ, CTA, and footer sections.
- `src/app/globals.css` provides the organic/luxurious visual foundation: earthy colors, serif display typography, subtle grain, organic motion, hover states, and reduced-motion handling.
- `AppShell`, `PrimaryNavigation`, and the dashboard entry card use the shared warm palette without changing data behavior.

### Shell and navigation

- `AppShell` renders the global synthetic-data warning.
- `PrimaryNavigation` uses `usePathname()` and `aria-current="page"` for active links.
- Navigation currently includes Dashboard, Profile, Daily logs, Assistant, Reminders, and Summary.
- Navigation also includes Prescriptions, which links to the deterministic abbreviation explainer.
- Focus-visible rings and keyboard-operable controls are required.

### API client

`src/lib/api-client.ts`:

- Parses successful JSON with the corresponding Zod response schema.
- Parses the standard `{ error: { code, message } }` envelope.
- Uses bounded request timeouts and safe retryable errors.
- Marks HTTP 429 as retryable for rate-limited assistant requests.
- Reminder methods are `listReminders`, `createReminder`, `updateReminder`, and `deleteReminder`.
- DELETE handles the contract's `204 No Content` response separately.
- `explainPrescription` posts example wording to `/api/prescriptions/explain` and parses `PrescriptionExplainResponse` with the shared schema.

### Prescription explainer UI

`src/components/prescription-explainer.tsx` and `/prescriptions`:

- Accepts up to 2000 characters under the label `Prescription wording`.
- Shows the example-only warning, loading state, retryable error state, recognized terms, matched text, Latin origin, meaning, cautions, fixed guidance, and the API-provided source link.
- Does not add drug, dose, timing, checking, or prescribing advice.
- Was browser-checked at 375px with no horizontal overflow. The contract example `Eye drops s prn` returns `p.r.n.` only because the backend recognizer only returns abbreviations present in the submitted text; use explicit `o.d.`, `t.d.s.`, and `p.r.n.` tokens to exercise all three terms.

### Reminders UI

`src/components/reminders.tsx` and `/reminders`:

- Loads active and inactive reminders with `includeInactive=true` so paused reminders can be resumed.
- Creation is a two-step flow: enter fields, review the user's wording/timing, then explicitly confirm and save with `userConfirmed: true`.
- Uses `datetime-local`, converts local input to an ISO timestamp with the local offset, and never suggests medication content or timing.
- Supports Pause/Resume, Edit, and inline Delete confirmation. It never uses `window.confirm`.
- A reminder 404 refreshes the list because another actor may have removed it.
- Includes loading, empty (`No reminders yet`), error, retry, and success states.
- Required safety copy states that reminders are user-set, medication timing/doses are not suggested or checked, pharmacists/prescribers should answer medication questions, and reminders are in-app only.

### Assistant rate-limit retry

`src/components/assistant-chat.tsx`:

- On a retryable assistant error, keeps the submitted text in the message field and shows the server error message with a Retry action.
- Retrying resends the same message without appending another user transcript entry; the field clears only after a successful response.

### Printable summary

`src/components/health-summary.tsx`, `src/components/health-trends.tsx`, and `/summary`:

- Uses existing profile and health-log APIs.
- Keeps the 14-day trend helpers in `src/lib/health/trends.ts` pure and unchanged.
- Shows user-reported data, not diagnostic indicators.
- Includes the patient-provided, non-diagnostic, clinician-review, synthetic-data wording.
- Print-only styling hides the app header and print button, keeps the synthetic notice, stacks charts on narrow print widths, wraps the seven-column table, and allows the history section to break across pages.
- `RecentAssistantConversations` loads up to five completed sessions through `getPastAssessments()` and the shared `assessmentHistoryResponseSchema`. It labels the initial concern as the user's own words, separates urgent-care guidance from routine assessments, and shows routine summaries, possible explanations with unknowns, next steps, source links, and the API-provided disclaimer. It has loading, empty, error, and retry states with print-friendly cards.

### Personal health insights and health-log journey

- `/dashboard` requests at most 100 logs through `getHealthLogs(100)` and provides loading, error/retry, empty, and success states.
- It reuses `logsInWindow`, `summaryFigures`, `TREND_DAYS`, and `HealthTrends` for the latest 14-day window; no API contract or health helper was changed.
- The dashboard presents the 14-day log count, average recorded sleep, highest recorded pain and date, and latest observation. The tiles and latest observation link to `/logs`.
- The explanatory label is `User-reported measurements, not diagnostic indicators`; the tiles use neutral styling and avoid cause/effect claims.
- `/logs` groups entries by UTC date, newest first, labels the current and previous dates Today and Yesterday, and shows pain and sleep as small neutral indicators (for example `Pain 3/10` and `Sleep 7h 30m`). Other recorded details remain available.
- The timeline links to `/summary`, including its loading, error, and empty states. No API, validation, or backend files were changed.

### PR #1 review fixes

- Prescription example placeholder: `Example: Ibuprofen 200mg tds prn`.
- Landing-page source label: `Curated NHS and Patient.info sources`.
- Assistant Send is disabled when it would resend text that is pending Retry, preventing a duplicate transcript entry.

## API contract summary

The canonical contract is `docs/API_CONTRACTS.md`; schemas are exported from `@/lib/validations`.

- `GET/PATCH /api/profile`
- `GET/POST /api/health-logs`
- `POST /api/assistant/chat`
- `GET /api/assistant/sessions?limit=5` for recent completed conversations (contract §3c)
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

For `feat/health-insights-journey`, lint, typecheck, build, and all 188 tests passed. Browser checks at a 375px configured viewport found no horizontal overflow on `/dashboard`, `/logs`, or `/summary`; the dashboard showed both charts and linked stat tiles, and the timeline showed Today then Yesterday with the expected pain/sleep formatting and a summary link. The `/summary` page showed its synthetic-data notice, charts, and history table. Print CSS could not be verified in the browser harness because `page.emulateMedia({ media: "print" })` left `matchMedia("print").matches` false; use a real browser print preview before confirming print-specific behavior.

For `feat/summary-conversations`, lint, typecheck, build, and all 204 tests passed. At 375px, `/summary` showed the newest routine conversation before the urgent one with no horizontal overflow. A mocked 503 verified the error and Retry states; retrying with an empty response showed the empty state and `/assistant` link. Print-media emulation returned `matchMedia("print").matches === true`; the app header and print button were hidden and conversation cards used `break-inside: avoid`. A synthetic back-pain browser turn with a negated bladder/bowel statement nevertheless triggered urgent guidance; this backend safety behavior was not changed and should be reviewed by Person A.

## Pending work and coordination

- Have Person A review and merge `feat/summary-conversations`; then verify the merged build separately.
- Verify the merged `supabase/migrations/0002_reminders.sql` is applied in the deployed Supabase project before demo use.
- Verify the deployed Vercel build contains `/reminders` and the merged API.
- Keep `docs/AI_A.md`, `docs/AI_B.md`, and `docs/SHARED_CONTEXT.md` synchronized after meaningful architecture, contract, ownership, or deployment changes.
- Do not create real reminders, logs, or health data in the shared demo database for testing.
- Confirm `/summary` print-specific layout in a real browser print preview.
- `public/pitch/safety-measured.svg` is a standalone 16:9 slide using the current scorecard output of 137/137 checks, not the earlier 134/134 total.
- Before starting a task, inspect `git status`, read all context files, and check whether the other AI has changed the files you need.
