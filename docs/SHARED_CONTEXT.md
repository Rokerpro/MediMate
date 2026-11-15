# MediMate — Shared AI Context

Last updated: 2026-11-15

This is the combined source of truth for both coding AIs. Naming: `docs/AI_A.md` = frontend AI (Person B), `docs/AI_B.md` = backend/AI assistant (Person A, called "Person A" in `CLAUDE.md`). It supplements, but does not replace, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/AI_SAFETY_SPEC.md`. When these documents conflict, the executable schemas and safety specification take precedence; resolve conflicts explicitly rather than guessing.

## Current repository state

- `main` includes Google sign-in, onboarding, weekly summary, account deletion, grounded health analytics, medicine-reminder notifications with PWA install, scroll-aware headers, and a site-wide light/dark theme. Person B's remaining branches were merged by Person A on 2026-11-15 (`chore/integrate-person-b-work`).
- PR #2 (`feat/health-insights-journey`: PR #1 review fixes `ad87a1f`, Personal Health Insights `09ebb8b`, Interactive Health Journey `bbfdd5e`) was reviewed and merged by Person A on 2026-11-14, together with the backend past-conversations endpoint (`cd73b88`), safety scorecard (`77e37a9`), security headers (`3962e9d`) and the dose-question fix (`1312d70`). Checks on the merged tree: lint, typecheck, build, 202 tests, scorecard 134/134.
- The app is a Next.js 16.4.6 App Router application using React 19.3, TypeScript, Tailwind 4.3, Zod 4.6, Supabase PostgreSQL, and a server-side Groq-compatible AI provider.
- Node.js `>=22.18` is required.
- **Onboarding (2026-11-15):** new accounts are sent to `/welcome` to enter their full name and age (required), plus location and other optional details. `ProfileForm` has an `onboarding` mode. Profile gains an optional `location` field (migration `0004`), which is never sent to the AI.
- **Weekly AI summary (2026-11-15, contract §3d):** `POST /api/insights/weekly` runs on demand over the last 7 days of logs. Safety rules run first; then the same output validation as chat, with one repair. It is never stored. The card is on `/dashboard` (`weekly-summary.tsx`, built by Person A at the owner's request).
- **Google sign-in (2026-11-15, branch `feat/google-auth`, contract §0a):** everyone signs in; data routes return 401 `UNAUTHENTICATED` without a session; RLS limits each user to their own profile. Only one demo Google account (set privately in Supabase `medimate_settings`) sees the synthetic "Alex Demo" profile; other accounts start empty (`age: null`), capped at 5 sign-ups. Built by Person A at the owner's request, including the frontend pieces (`/login`, `continue-with-google.tsx`, `account-menu.tsx` in the app header, 401 → `/login` redirect and chat-storage clearing in `api-client.ts`). `/api/auth/me` also returns a nullable `avatarUrl` from trusted HTTPS Google photo metadata; invalid or missing photos become `null`. Still synthetic data only.

## Product and safety invariants

- MediMate provides educational, non-diagnostic information; it is not a doctor or emergency service.
- Relevant history must be retrieved and shown separately from curated medical references.
- Deterministic warning checks run before the LLM and cannot be overridden by model output.
- No diagnosis claims, probabilities, confidence scores, medication timing/dose instructions, or reassurance based solely on a non-matching warning rule.
- Every assessment shows uncertainty, sources returned by the server, next steps, and the fixed disclaimer.
- Reminders are user-written. Medication reminders can notify by web push or email until confirmed; the app never suggests medicines, timing, or doses.
- Every page shows: `Synthetic demo data — do not enter real health information.`

## Ownership

Since 2026-11-15 the owner has handed the whole repository (frontend and backend) to one assistant: Claude Code, working for Person A. Person B / Copilot no longer edits the repository; all of Person B's branches are merged into `main` and every other branch was deleted. The Person A / Person B split below this line and in older entries is history.

GitHub now deletes a PR's branch automatically when it is merged. Keep using short-lived feature branches and PRs into `main`.

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
- Prescription explainer: deterministic endpoint `/api/prescriptions/explain` (no AI, nothing stored; contract §3b), surfaced at `/prescriptions` with a shared-schema client method and accessible result cards.
- Assistant requests can be rate-limited with HTTP 429 `RATE_LIMITED`; the server returns a `Retry-After` header and does not persist the failed turn.
- Public landing page: `/` now presents the product story, real features, safety boundaries, workflow, FAQ, and entry CTA; `/dashboard` remains the app workspace.
- App and landing-page headers (`ScrollAwareHeader`) stay pinned while visible, hide after scrolling down past 80px, and reappear on upward scroll or keyboard focus. Both logos link to `/`.
- Health analytics: `/insights` uses the real `GET /api/insights/analytics` client method with 7/14/30-day windows, trend charts that preserve null gaps, symptom/recurrence summaries, and recorded-together associations with dated log evidence links. The route is protected by the existing sign-in proxy.
- The responsive assistant popup appears on the landing page and app pages except `/assistant`, where the dedicated full-page chat remains unobstructed. Desktop uses a bottom-right launcher with a panel right-aligned above it; mobile uses a full-screen, animated dialog with focus management and a close control.
- `/assistant` and the popup share the app-shell conversation provider; conversations, theme, and local chat actions persist in the current browser (`medimate-assistant-experience-v1`). The landing-page popup has its own provider instance and restores the same saved browser state on mount.
- The popup reuses `AssistantChat` and the existing API. Its optional browser speech-to-text requests microphone permission before recognition, stops the permission stream immediately, and appends recognized words to the composer for review; sending remains a user action, and unsupported browsers or denied permission fall back to typing. Closing during a pending permission request prevents recognition from starting. Voice recognition is browser-provided, so users must continue using synthetic data only.
- App navigation keeps its desktop links and uses a full-screen hamburger overlay on mobile, with Escape handling, focus containment, scroll locking, and a close control.
- Internal route changes and browser back/forward navigation display a branded full-screen preloader for at least one second and until tracked frontend API requests settle. It has a 30-second failsafe; API activity tracking is in `src/lib/api-client.ts`.

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
- `/reminders` now includes notification configuration and per-device push controls, a 60-second refreshing dose list, status/confirmation feedback, and `?dose=<id>&confirm=failed` handling. Root layout registers the service worker and mounts a seven-day-dismissible PWA install prompt; viewport theme color is `#254a38`.
- The prescription explainer page was tested at 375px with no horizontal overflow. It always shows the API guidance and source after a successful response, including when no terms are recognized.
- Assistant `RATE_LIMITED` (429) is retryable; the chat retains the failed text, shows the server message, and retries without duplicating its transcript entry.
- A `prompt` safety level on assistant follow-up or assessment responses appears above the reply in an amber `role="status"` notice titled “Contact a GP or NHS 111 today”; urgent responses retain their distinct red alert.
- Chat assessments and weekly summaries share `GroundedAssessment`: server-calculated recorded facts and all considered records are separated from the assistant's interpretation; matched terms, recent-measurement/cited badges, links, sources, next steps, and the disclaimer are retained. Empty new fields from older stored assessments remain hidden.
- On assistant-chat 401, the page and popup preserve the typed message and show a contextual sign-in card with `/auth/login?next=<encoded current path>` instead of generic retry UI.
- `/profile` provides inline account-deletion confirmation gated by typing `DELETE`, with focus, pending, and retryable error states. The landing page displays a dismissible notice for `/?accountDeleted=1`.
- `AssistantChat` supports page and popup presentation variants without duplicating chat state/API logic. Browser speech recognition is optional, announces unsupported/permission failures, and never auto-sends recognized text.
- The expanded assistant UI supports local create/search/switch/rename/remove, theme selection, copy, local response feedback, and safe basic Markdown. Removing a local conversation does not delete a server record. The current API is synchronous and does not provide streaming/cancellation, transcript retrieval, attachment upload, true edit/regenerate, server-side feedback, or syntax highlighting; the UI does not claim these features.
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

For `feat/chatbot-popup`, lint, typecheck, all 204 tests, and the production build passed. Local browser checks verified the full-screen mobile dialog at 375px without horizontal overflow, focus return and scroll restoration after close, and no popup launcher on the dedicated `/assistant` page. Mocked speech recognition verified unsupported-browser feedback and transcript insertion without automatic sending.

For `fix/assistant-popup-controls`, browser checks verified desktop panel alignment above the launcher, mobile full-screen layout without horizontal overflow, icon-only popup Speak/Send controls with accessible names, and text-labelled controls on `/assistant`. Mocked `getUserMedia` confirmed the permission request, immediate track release before recognition, denied-permission feedback, and cancellation when closed during a pending request. The harness did not display a real operating-system permission prompt or provide a real speech-recognition service.

For mobile navigation and the route preloader, lint, typecheck, all 204 tests, and the production build passed. Browser checks at 375×812 verified the full-screen navigation overlay, Escape and close-button behavior, focus return, scroll locking, and no horizontal overflow. Desktop links remain visible without the hamburger. Route navigation showed the branded preloader for at least one second and until tracked page API requests settled.

For `feat/assistant-experience`, lint, typecheck, all 204 tests, and production build pass. Browser checks verified mocked follow-up rendering, local persistence across reloads, rename, popup/page continuity, desktop popup alignment, responsive mobile sizing, and mocked microphone permission/recognition behavior. The API limitations listed above remain intentional.

For `feat/account-ui`, lint, typecheck, all 285 tests, and production build pass. Mocked browser checks verified the prompt notice at desktop and 375px, inline 401 sign-in cards with preserved messages, deletion confirmation/error/retry behavior, and the dismissible landing notice with no horizontal overflow. No successful account deletion or live Google sign-in was attempted; migration `0005_delete_account.sql` remains an owner prerequisite.

Use short-lived feature branches, focused Conventional Commits, explicit `git add` paths, and no force-pushes. Merge only after the other AI reviews changed files and the checks pass.

## Pending shared work

Done 2026-11-14: `0002_reminders.sql` applied in Supabase; the live Vercel site serves `/api/reminders` (200); `docs/AI_B.md` filled in by the backend assistant; PR #1 review follow-ups fixed and PR #2 merged.

1. Owner: run `supabase/reset-demo.sql` in the Supabase SQL editor just before the demo (restores Alex Demo, 14 logs dated up to today, 2 reminders; deletes all chat sessions). Then rehearse and record the backup video.
2. Done 2026-11-15 by Person A at the owner's request: "Recent assistant conversations" on `/summary` (`src/components/recent-assistant-conversations.tsx`, `listAssistantSessions` in `src/lib/api-client.ts`, rendered from `src/app/(app)/summary/page.tsx`, below Person B's `HealthSummary`). Shows the last 5 completed conversations with urgent / GP-111 badges, summary, possibilities, next steps, sources and disclaimer; loading, error/retry and empty states; prints. Person B may restyle it or move it above "Notes for the appointment". Assistant conversations are not written to the profile (they are user-reported, not recorded facts); "Save to my log" is done too (2026-11-15, Person A at the owner's request): `src/components/save-to-log.tsx`, shown under each completed assessment in `assistant-chat.tsx` (not for urgent or follow-up replies). It is prefilled only from the user's own messages (`draftLogFromUserMessages` in `src/lib/health/log-draft.ts`: symptoms text, body area typed, last "N/10" score), the user edits and confirms, then the existing `POST /api/health-logs` saves it with a note "Saved by the user from an assistant conversation (user-reported)".
3. Owner: confirm the `/summary` print layout in a real browser print preview, and check the signed-in pages in dark mode.
4. Pitch: `npm run scorecard` currently prints 266/266 fixed checks. Its weekly-summary lines are 37/37 for unsafe AI output blocked and 35/35 for warning-sign escalation in logs. The slide `public/pitch/safety-measured.svg` (from Person B's `feat/summary-conversations`) shows these figures; update it whenever the scorecard changes. Keep the scope note: fixed examples, keyword matching, and not comprehensive emergency detection; output checks use a scripted AI stand-in.
5. Workflow: one owner for the whole repository (see Ownership).
6. Keep this file and both AI-specific context files synchronized after meaningful decisions or contract changes.

- 2026-11-15 (A): `DELETE /api/auth/account` + `deleteAccount()` in api-client (needs migration 0005). Deletes the user's profile, logs, chats, reminders and sign-in; the demo profile is only unlinked. `sendAssistantMessage` no longer redirects on 401: it throws `ApiClientError` status 401 so the chat can show an inline sign-in prompt. `PROFILE_SAVED_EVENT` refreshes the header name after a profile save.
- 2026-11-15 (B): prompt-level notices are shown in the shared assistant page/popup and `urgencyLevel: "prompt"` summaries use the contract label "Urgent GP / NHS 111 advice was given". The account UI uses mocked failures only; do not test successful deletion until the owner applies `supabase/migrations/0005_delete_account.sql`.
- 2026-11-15 (B): the landing and app-header avatar menus link to the Profile page without displaying the account name or sign-out action; sign-out is available on Profile. The app header's standalone Profile navigation entry is removed.
- 2026-11-15 (B): `feat/notifications-pwa-ui` adds the contract §3f reminder controls and PWA install prompt without changing shared API or backend files. Lint, typecheck, 317 tests, and production build pass after merging `4ef1665`. Browser checks cover the mocked install flow, standalone suppression, service-worker registration and viewport metadata. Authenticated `/reminders` UI and live notification delivery remain unverified in the unauthenticated browser; migration 0006 and server configuration are owner prerequisites.

- 2026-11-15 (A): Grounded history + analytics + eval. Contract §3e: assessment gains `recordedFacts` (server-calculated) and `historyConsidered` (records given to the model, `matchedTerms`, `reason`, `cited`); supportingHistory items gain `matchedTerms`. New `GET /api/insights/analytics?days=7|14|30` + `getHealthAnalytics()`. Output checks now block dates/pain scores/counts not in the records. `npm run eval` writes docs/EVALUATION.md (synthetic; not proof of clinical safety).
- 2026-11-15 (B): `/insights` and the shared grounded-assessment UI are implemented on `feat/grounded-insights-ui`. Lint, typecheck, all 305 tests, and production build pass. Synthetic browser responses exercised analytics and grounded chat output; chat was checked at 375px. Authenticated live `/insights` could not be checked because the browser lacked a session cookie.
- 2026-11-15 (A): Medicine-reminder notifications + PWA, contract §3f (owner decision). Medication reminders notify by web push (else email) at due time, +5, +10 min until confirmed; then `missed`, confirmable until 1 h after due. New: `listReminderDoses`, `confirmReminderDose` (409 `CONFLICT` when too late), `getNotificationConfig`, `src/lib/push-client.ts` (`registerServiceWorker`, `enablePushNotifications`, `disablePushNotifications`, `isStandalone`, `pushSupport`, `BeforeInstallPromptEvent`), manifest, `public/sw.js`, icons. Person B: register the SW on load, notification toggle on /reminders, dose list + "I took it" at `/reminders?dose=<id>`, Android install prompt. Needs migration 0006 + env vars (owner).
- 2026-11-15 (B): `feat/global-theme-toggle` adds the root `ThemeProvider` and shared theme switch on landing, login, and the app header. The preference persists as `medimate-theme-v1`; assistant pages and popup consume the same theme, and the assistant-only switch is removed. Signed-in avatars navigate directly to `/profile`. Browser checks verified landing/login theme persistence, a mocked signed-in avatar link, and no landing overflow at 375px; the authenticated app route remains unverified.
