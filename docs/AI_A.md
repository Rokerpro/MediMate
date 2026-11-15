# AI_A — Current Project Context

Last updated: 2026-11-15

## Role and current state

This file records the context for the frontend/product AI (Person B). `main` at `67f0db0` includes the prompt-level notice, inline chat sign-in, account deletion, nullable Google avatar field, and the Profile-only avatar link with sign-out on the Profile page. The current branch, `feat/global-theme-toggle`, is based on that commit and adds a persistent site-wide theme switch, removes the chat-only switch, and makes the account avatar navigate directly to `/profile`.

PR #2 (`feat/health-insights-journey`) was merged into `main`. Do not assume that a feature is deployed just because it is merged; verify the deployed app separately.

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

Out of scope: diagnosis, probabilities, disease prediction, image analysis, voice assistants/audio output, wearables, native apps, push/SMS/email notifications, model training, vector search, and broad web crawling. Browser speech-to-text is available only as an input method for the existing assistant.

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
- `PrimaryNavigation` uses `usePathname()` and `aria-current="page"` for active links. On mobile, it replaces the horizontal link list with a full-screen hamburger overlay with Escape handling, focus containment, scroll locking, and a close control; desktop navigation remains unchanged.
- Navigation currently includes Dashboard, Insights, Daily logs, Assistant, Reminders, Prescriptions, and Summary. Profile is linked from the avatar menu instead of primary navigation.
- Focus-visible rings and keyboard-operable controls are required.

### Route preloader

- `RoutePreloader` is mounted in the shared root layout and shows a branded full-screen transition for internal route changes, including browser back/forward navigation.
- The preloader remains visible for at least one second and waits for in-flight frontend API requests to settle, with a 30-second failsafe.
- API activity is tracked centrally in `src/lib/api-client.ts`; request methods and the bodyless reminder DELETE endpoint use the same tracking.

### API client

`src/lib/api-client.ts`:

- Parses successful JSON with the corresponding Zod response schema.
- Parses the standard `{ error: { code, message } }` envelope.
- Uses bounded request timeouts and safe retryable errors.
- Marks HTTP 429 as retryable for rate-limited assistant requests.
- Reminder methods are `listReminders`, `createReminder`, `updateReminder`, and `deleteReminder`.
- DELETE handles the contract's `204 No Content` response separately.
- `explainPrescription` posts example wording to `/api/prescriptions/explain` and parses `PrescriptionExplainResponse` with the shared schema.

### Account sign-in and deletion UI

- On assistant-chat 401, the shared page/popup UI preserves the typed message and shows an inline "Sign in to chat with MediMate" card with a URL-encoded `/auth/login?next=<current path>` link instead of generic retry UI.
- `/profile` has a danger zone with an in-page confirmation; the user must type `DELETE`, receives focus in the confirmation input, and sees pending/error/retry states. The existing `deleteAccount()` API client owns the success redirect.
- `/?accountDeleted=1` shows a dismissible confirmation notice. It reads the query after client mount so the notice is not held inside a hidden streamed Suspense boundary.
- The landing navigation uses `AccountMenu`'s `landing` variant: signed-out visitors see a Sign in link; signed-in users see their Google avatar or initials as a direct link to `/profile`. In the app header, a 32px avatar link navigates directly to `/profile`; neither header shows the account name or a sign-out button. The Profile page has the sign-out action.
- A real deletion has not been tested; the owner must apply `supabase/migrations/0005_delete_account.sql` before the endpoint can succeed.

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
- A `prompt` safety level on a follow-up or assessment shows the server message above the reply in an amber `role="status"` notice titled “Contact a GP or NHS 111 today.” Urgent responses retain their separate prominent red alert.

### Responsive assistant popup and voice input

- `src/components/assistant-chat-popup.tsx` adds a floating launcher throughout the public landing page and app shell, except `/assistant`, where the dedicated full-page chat remains unobstructed.
- Desktop uses a bottom-right launcher with a panel right-aligned above it. On narrow screens the panel fills the viewport, animates in/out, locks background scrolling, traps keyboard focus, and has an explicit SVG close control.
- The popup renders the existing `AssistantChat` component and uses the existing chat API, response rendering, retry behavior, and safety guidance; it does not introduce another chat implementation.
- `AssistantChat` offers optional browser speech-to-text. On activation, supported browsers first request microphone permission with `getUserMedia({ audio: true })`; the permission stream is stopped immediately before recognition starts. Closing the popup cancels a pending recognition start. Unsupported browsers and permission/start errors get a text-entry fallback. Recognized words are appended to the composer and are never sent automatically. The popup uses icon-only Speak and Send controls with accessible names; the dedicated assistant page retains text labels.
- Urgent guidance is prioritized above the popup conversation. The launcher and panel are hidden in print.

### Shared assistant experience

- `src/components/assistant-experience.tsx` provides conversation state, local persistence, the global theme value, and chat actions to both the full-page assistant and popup. The app shell shares one provider instance between both modes; `/` mounts the provider for its own landing-page popup. Conversation state is persisted in this browser under `medimate-assistant-experience-v1`.
- Users can create, search, switch, rename, and locally remove conversations. Saved conversations can continue through the existing synchronous chat API using their session IDs. Rename/removal are browser-local; removing a chat does not delete server records.
- The assistant reads the site-wide light/dark theme; theme preference is managed by the root provider rather than stored with chat state. The UI also includes copy, local response feedback, loading/error/retry behavior, and basic safe Markdown for headings, lists, inline formatting, and fenced code. It does not provide syntax highlighting.
- The existing API does not support streaming/cancellation, transcript retrieval or server-side session management, attachments, true edit/regenerate, or server-side feedback. No controls claim those capabilities. The sessions endpoint remains a read-only list of completed assessments and is not used as transcript storage.
- Assessment cards continue to render the existing validated response fields. Urgent guidance remains prominent; routine output retains relevant history, sources, unknowns, next steps, and the disclaimer.

### Printable summary

`src/components/health-summary.tsx`, `src/components/health-trends.tsx`, and `/summary`:

- Uses existing profile and health-log APIs.
- Keeps the 14-day trend helpers in `src/lib/health/trends.ts` pure and unchanged.
- Shows user-reported data, not diagnostic indicators.
- Includes the patient-provided, non-diagnostic, clinician-review, synthetic-data wording.
- Print-only styling hides the app header and print button, keeps the synthetic notice, stacks charts on narrow print widths, wraps the seven-column table, and allows the history section to break across pages.

### Personal health insights and health-log journey

- `/dashboard` requests at most 100 logs through `getHealthLogs(100)` and provides loading, error/retry, empty, and success states.
- It reuses `logsInWindow`, `summaryFigures`, `TREND_DAYS`, and `HealthTrends` for the latest 14-day window; no API contract or health helper was changed.
- The dashboard presents the 14-day log count, average recorded sleep, highest recorded pain and date, and latest observation. The tiles and latest observation link to `/logs`.
- The explanatory label is `User-reported measurements, not diagnostic indicators`; the tiles use neutral styling and avoid cause/effect claims.
- `/logs` groups entries by UTC date, newest first, labels the current and previous dates Today and Yesterday, and shows pain and sleep as small neutral indicators (for example `Pain 3/10` and `Sleep 7h 30m`). Other recorded details remain available.
- The timeline links to `/summary`, including its loading, error, and empty states. No API, validation, or backend files were changed.

### Grounded analytics and assessment presentation

- `/insights` calls the signed-in user's `GET /api/insights/analytics` through `getHealthAnalytics(days)` with 7/14/30-day windows (30 by default). It displays symptom counts and recurrence, recorded pain summaries, SVG pain/sleep charts with null gaps, and "Recorded together" comparisons with dated evidence links. It shows loading, empty, retryable error, and invalid-response states.
- `GroundedAssessment` renders server-calculated `recordedFacts` and `historyConsidered` separately from MediMate's interpretation. Chat and weekly summaries share it; older assessments with empty new fields hide those sections. It preserves sources, next steps, and the disclaimer.
- The new `/insights` page is protected by the existing sign-in proxy and protected-path helper. The API client and validation schemas are unchanged.
- Verification on this branch: lint, typecheck, all 305 tests, and production build pass. Synthetic browser responses exercised analytics and grounded chat/weekly-summary output; chat was checked at 375px. A fresh `/insights` navigation in the browser redirected to sign-in because that browser lacked a session cookie, so the authenticated live endpoint was not verified there.

### PR #1 review fixes

- Prescription example placeholder: `Example: Ibuprofen 200mg tds prn`.
- Landing-page source label: `Curated NHS and Patient.info sources`.
- Assistant Send is disabled when it would resend text that is pending Retry, preventing a duplicate transcript entry.

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

For `feat/health-insights-journey`, lint, typecheck, build, and all 188 tests passed. Browser checks at a 375px configured viewport found no horizontal overflow on `/dashboard`, `/logs`, or `/summary`; the dashboard showed both charts and linked stat tiles, and the timeline showed Today then Yesterday with the expected pain/sleep formatting and a summary link. The `/summary` page showed its synthetic-data notice, charts, and history table. Print CSS could not be verified in the browser harness because `page.emulateMedia({ media: "print" })` left `matchMedia("print").matches` false; use a real browser print preview before confirming print-specific behavior.

For `feat/chatbot-popup`, lint, typecheck, all 204 tests, and the production build passed. Local browser checks verified the full-screen mobile dialog at 375px without horizontal overflow, focus return and scroll restoration on close, and that `/assistant` remains a dedicated full-page chat. A mocked SpeechRecognition verified unsupported-browser feedback and transcript insertion without automatic sending.

On `fix/assistant-popup-controls`, browser checks verified that the desktop panel aligns with and opens above its launcher, the popup Speak and Send controls are icon-only with accessible names, and the dedicated `/assistant` page retains text labels. Mocked `getUserMedia` verified the `{ audio: true }` permission request, track release before recognition, clear denial messaging, and cancellation when the popup closes during a pending request. A real operating-system microphone prompt and speech-recognition service were not available in the browser harness.

For the mobile navigation and route preloader, lint, typecheck, all 204 tests, and the production build passed. Browser checks verified the mobile menu fills a 375×812 viewport, supports Escape and its close button, restores focus and body scrolling, and has no horizontal overflow. Desktop links remain visible while the hamburger is hidden. Internal navigation displayed the preloader for at least one second and waited for the page API requests to settle; the synthetic-data notice remained visible.

For `feat/assistant-experience`, lint, typecheck, all 204 tests, and the production build pass. Browser checks verified mocked follow-up rendering, persistence across reloads, rename, popup/page conversation continuity, desktop launcher alignment, mobile popup sizing, and mocked microphone permission/recognition behavior. Streaming, server-side history management, attachment upload, server feedback, and syntax highlighting are not supported by the current API and are intentionally absent.

For `feat/account-ui`, lint, typecheck, all 285 tests, and the production build pass. Browser checks with mocked API responses verified the prompt notice and normal follow-up at desktop and 375px, inline 401 sign-in cards with preserved composer text on the assistant page and landing popup, and the profile deletion confirmation/error/retry flow without a successful deletion. The landing-page deletion notice appears and dismisses at desktop and 375px. No real account deletion or live Google sign-in was attempted; migration `0005_delete_account.sql` is still an owner prerequisite.

For `feat/global-theme-toggle`, browser checks verified the site-wide switch on the landing and login pages, dark-theme persistence after reload, one theme switch on the landing page (none in the chat), and no horizontal overflow at phone width. With a mocked signed-in landing response, the avatar is a direct `/profile` link; without a real session, the protected route correctly redirects to `/login?next=%2Fprofile`. The initial development-server context error did not recur after reloading the landing page; an authenticated app route was not browser-tested.

## Pending work and coordination

- Keep `docs/AI_A.md`, `docs/AI_B.md`, and `docs/SHARED_CONTEXT.md` synchronized after meaningful architecture, contract, ownership, or deployment changes.
- Do not create real reminders, logs, or health data in the shared demo database for testing.
- Confirm `/summary` print-specific layout in a real browser print preview.
- Before starting a task, inspect `git status`, read all context files, and check whether the other AI has changed the files you need.
