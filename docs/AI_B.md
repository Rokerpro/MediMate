# AI_B — Backend/AI Context (Person A)

Last updated: 2026-11-15

Written by Person A's assistant (Claude Code). Naming note: in these context files **AI_A = frontend (Person B)** and **AI_B = backend (Person A)**. `CLAUDE.md` calls the backend owner "Person A".

Read with `docs/SHARED_CONTEXT.md`, `docs/AI_A.md`, `CLAUDE.md`, `docs/API_CONTRACTS.md` and `docs/AI_SAFETY_SPEC.md`. No secrets, keys or real health data belong in this file.

## 1. Current branch, commits and deployment

- **2026-11-15 handover:** the owner handed the whole repository (frontend included) to this assistant. Person B's last five branches were merged in PR #10 (`chore/integrate-person-b-work`; resolutions listed in the PR), all other local and remote branches were deleted (each checked as merged into `main` first), and GitHub's "automatically delete head branches" is on. Only `main` remains. Copilot / Person B no longer edits the repository.
- `main` at `39fe7dc` (Person B's shared-context docs) includes every backend feature below. This file is added on `docs/backend-ai-context` and fast-forwarded into `main`.
- Backend commits of note: `032828a` reminders table and API, `aab2970` prescription abbreviation explainer, `6406129` chest-pain rules, `0b1c013` recent daily measurements in the prompt, `99c3d38` no-reference guardrails, `4669354` assistant reply clean-up.
- Supabase: `0001_initial_schema.sql`, `seed.sql` and `0002_reminders.sql` are **applied** to the project (reminders confirmed 2026-11-14; `GET /api/reminders` returned the 2 seeded reminders).
- Vercel (https://medi-mate-mauve.vercel.app) deploys `main` automatically. `/api/reminders` returned 200 on the live site after the merge.
- Avoid polling the live site in tight loops: about 60 rapid requests triggered Vercel's bot challenge (403) once.

## 2. Backend architecture

- Next.js Route Handlers under `src/app/api/**`; no separate backend service.
- `src/lib/supabase/server.ts` → `supabaseRest(path, { method, body, returnRepresentation })`: a small `fetch` client for Supabase PostgREST (GET/POST/PATCH/DELETE). No `@supabase/supabase-js` dependency. Uses only the anon/publishable key; never the service-role key. Errors become `SupabaseConfigError` / `SupabaseRequestError` holding status and code only.
- `src/lib/supabase/mappers.ts`: pure row ↔ contract mapping (snake_case ↔ camelCase), timestamps normalized to UTC ISO, column lists (`PROFILE_COLUMNS`, `HEALTH_LOG_COLUMNS`, `REMINDER_COLUMNS`). Unit-tested.
- `src/lib/supabase/assistant-store.ts`: profile, recent logs, sessions and messages for the chat route.
- `src/app/api/_lib/responses.ts`: `apiError`, `validationError` (first 3 Zod issues), `readJsonBody` (20,000-char limit, malformed JSON → 400), `internalError` (logs a content-free summary, returns a generic 500).
- Demo access model: one fixed profile `00000000-0000-4000-8000-000000000001` (`DEMO_PROFILE_ID`). Every RLS policy uses `public.is_medimate_demo_profile(...)`. Routes never accept a profile id from the client.
- Security headers (`next.config.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` on every route, and `Cache-Control: no-store` on `/api/*`. No CSP yet (Next.js inline scripts would need nonces).
- Server-only env vars (names only): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AI_PROVIDER` (`groq` | `gemini` | `mock`), `GROQ_API_KEY`, `GROQ_MODEL` (optional), `GEMINI_API_KEY`, `GEMINI_MODEL`. Never prefix with `NEXT_PUBLIC_`. Production uses `AI_PROVIDER=groq` (free tier, ~8,000 tokens/min).
- AI adapters: `src/lib/ai/client.ts` selects the provider; `openai-compatible.ts` serves Groq and Gemini; `mock-provider.ts` gives offline replies marked "[Mock]".

## 3. Implemented endpoints

Shapes: `docs/API_CONTRACTS.md` and `src/lib/validations/*` (exported from `@/lib/validations`). Errors always use `{ error: { code, message } }`.

| Endpoint | Contract | Notes |
|---|---|---|
| `GET /api/profile` | §1 | 404 if the demo profile row is missing. |
| `PATCH /api/profile` | §1 | Any subset of editable fields, at least one; unknown keys (e.g. `id`) → 400. |
| `GET /api/health-logs?limit=30` | §2 | `limit` 1–100; newest first. |
| `POST /api/health-logs` | §2 | `symptoms` required; 201. |
| `POST /api/assistant/chat` | §3 | See §5. 429 `RATE_LIMITED` + `Retry-After` when a turn that would call the model exceeds 6/min per client or 20/min per instance (`src/lib/ai/rate-limit.ts`; urgent safety turns are never limited, nothing saved). 404 "This conversation was not found. Please start a new one." for an unknown session; 503 `AI_UNAVAILABLE` with a safe message when the provider fails or output stays invalid. |
| `GET /api/reminders?includeInactive=false` | §3a | Active first, by `nextDueAt`; max 100; `includeInactive` must be `true`/`false`. |
| `POST /api/reminders` | §3a | Requires `userConfirmed: true` (else 400); 201. |
| `PATCH /api/reminders/{id}` | §3a | At least one field; non-UUID or unknown id → 404. |
| `DELETE /api/reminders/{id}` | §3a | 204 with no body; repeat or unknown → 404. |
| `POST /api/prescriptions/explain` | §3b | Deterministic, no AI, not stored or logged. `text` 1–2000 chars. |
| `GET /api/assistant/sessions?limit=5` | §3c | Read-only, completed conversations newest first; `limit` 1–20. Urgent sessions → `assessment: null`; a stored assessment that fails the contract schema is returned as `null`, never unvalidated (`rowToPastAssessment`). |

Reminder `nextDueAt` (`src/lib/reminders/schedule.ts`): one-off reminders keep `remindAt` even when past (UI shows "overdue"); daily/weekly roll forward in fixed 24 h / 7 day UTC steps; `null` when paused.

## 4. Database and migrations

- `supabase/migrations/0001_initial_schema.sql`: `profiles`, `health_logs`, `symptom_sessions`, `symptom_messages`, CHECK constraints matching the Zod ranges, indexes, demo-only RLS.
- `supabase/migrations/0002_reminders.sql`: `reminders` (title 1–120, category `medication|appointment|health_log|other`, notes ≤ 500, `remind_at`, repeat `none|daily|weekly`, `active`), index on `(profile_id, remind_at)`, RLS policy "demo reminders access", 2 synthetic seed reminders (fixed ids `…0a1`, `…0a2`, `on conflict do nothing`).
- `supabase/seed.sql`: profile "Alex Demo" and 14 days of logs (recurring lower-back discomfort after long sitting, variable sleep).
- The live profile currently reads "Alex Demo Updated" (age 24) from UI testing. **Run `supabase/reset-demo.sql` just before the demo**, not earlier. It is destructive for the demo profile only.
- Test data hygiene: backend tests create rows only with "Synthetic … test" wording and delete them afterwards (messages first, then sessions).

## 5. AI and health safety

Pipeline in `POST /api/assistant/chat` (`src/lib/ai/assistant.ts`):

1. Validate the request; load the demo profile and up to 60 logs from the last 30 days.
2. **Safety rules first** (`src/lib/health/safety-rules.ts`, `evaluateSafety`). A match returns `status: "urgent"`, the reviewed message, `assessment: null`, and `URGENT_ASSISTANT_MESSAGE`. The LLM is not called and cannot override it. If no 999 rule matches, the 6 `PROMPT_RULES` (NHS "urgent GP appointment / NHS 111" items, spec §9.1a, approved 2026-11-15) are checked: a match sets `safety.level: "prompt"` (triggered, fixed NHS message), the model still runs with the sign named in `SAFETY_RESULT`, and the server appends `PROMPT_ASSISTANT_NOTE` to the reply and puts `PROMPT_NEXT_STEP` first in the assessment's next steps. No chest-pain prompt rules: that page has no 111 list.
3. **History** (`src/lib/health/retrieve-history.ts`): `selectRelevantLogs` (up to 5 related logs, keyword match with negated phrases removed; a small body-area synonym map links e.g. "backache"/"lumbar"/"spine" → "back", "headache" → "head", "tummy"/"belly"/"abdomen" → "stomach") plus `selectRecentMeasurementLogs` (last 7 days of sleep/water/activity/mood, up to 7).
4. **References** (`src/lib/health/references.ts`): verbatim excerpts for `nhs-back-pain`, `nhs-headaches`, `nhs-chest-pain` when the topic matches.
5. **LLM** (`src/lib/ai/prompts.ts`): separate labelled sections for profile, related history, recent measurements and references; structured JSON only. One follow-up round (`MAX_FOLLOW_UP_ROUNDS = 1`), then it must assess.
6. **Output checks** (`src/lib/ai/output.ts`, `parseModelOutput`): rejects diagnosis wording, percentages/probabilities, medication or dose advice, invented links, self-care not found in the references (`findUnsourcedSelfCare`), and named conditions when no reference was supplied (`namesConditionWithoutReference`). Also rejects causal claims about recorded/reported factors (`makesCausalClaim`), "matches/aligns with common X" framing, comparisons with "normal/recommended" amounts or the user's own "needs" and "could contribute to" claims about recorded factors (added 2026-11-15 after a live reply said water intake "may be lower than your personal needs"), medicine start/stop instructions and follow-up questions about doses (spec §4). If the user mentioned a medicine and no next step refers them to a pharmacist/prescriber, the server appends `MEDICINE_NEXT_STEP`. `tidyAssistantMessage` strips heading-only lines. One repair retry whose prompt quotes the exact offending phrases (quotes never logged); otherwise 503.
7. `toContractAssessment` attaches the dated history used, sources from the curated set only, `NO_HISTORY_NOTE` when no related history was found, and the fixed `ASSESSMENT_DISCLAIMER`.

Sources register (`docs/AI_SAFETY_SPEC.md` §9; each approved by Person A on 2026-11-14):

- NHS Back pain, Headaches, Chest pain: safety rules and reference excerpts. Chest pain alone does not trigger; the rules need the NHS "Call 999" combinations.
- Patient.info "General prescribing guidance": prescription explainer only (§9.3). It expands only stat, p.r.n., o.d., o.n., b.d., t.d.s., q.d.s. with quoted meanings, adds a right-eye caution for o.d., and always returns fixed pharmacist/prescriber guidance and the source.

Known limitations: rules use keyword matching with simple negation handling and are not comprehensive emergency detection; history retrieval is keyword-based, not semantic; only three topics have rules and references; Groq's free-tier token limit can cause 503s under rapid testing.

## 6. Tests and verification

- Commands: `npm run lint`, `npm run typecheck` (`next typegen && tsc --noEmit`), `npm test` (node:test over `tests/**/*.test.ts`), `npm run build`.
- Latest backend run (`fix/no-causal-claims`): lint, typecheck and build clean; 188 tests pass. Real-model check (Groq, paced): the demo back-pain conversation 3× and a headache/sleep conversation all returned 200 with no causal titles. On `main` at `39fe7dc` (with Person B's merges): 167 tests pass. Test files: `assistant`, `contracts`, `safety-rules`, `supabase-mappers`, `trends`, `reminders`, `prescription-terms`.
- Endpoint checks against Supabase on 2026-11-14 (plus the full README demo script on the live site: follow-up → assessment with 3 dated history entries and the NHS source; urgent back-pain case; all pages and read APIs 200; rate limit checked locally with the mock provider: 7th turn → 429, urgent still 200, other address unaffected):
  - Reminders: list, create (201), missing confirmation (400), pause (200, `nextDueAt: null`), empty patch (400), delete (204), repeat delete (404), non-UUID id (404), bad query (400). Test row removed.
  - Prescription explainer: "Eye drops 1 drop OD, ibuprofen 200mg tds prn" → o.d. (with caution), t.d.s., p.r.n.; empty text → 400.
  - Live chat: "severe chest pain and trouble breathing" → urgent.
- Past conversations (`GET /api/assistant/sessions`, mock provider, 2026-11-14): empty table → `{ sessions: [] }`; after one routine and one urgent synthetic conversation → both listed newest first (routine with its assessment, urgent with `null`); `limit=0`, `limit=abc`, unknown key → 400. Test sessions deleted. 197 tests pass.
- Safety scorecard (`npm run scorecard`, 2026-11-14): 134/134 fixed checks pass (137/137 after adding 3 dose follow-up questions in `feat/history-synonyms`) — 19/19 rules cite an NHS source, 35/35 warning signs → urgent without a model call, 0 false alarms on 20 negated, 21 near-miss and 12 everyday messages, 21/21 unsafe model replies blocked, 6/6 careful replies delivered. Writing it exposed a gap (model text "stop taking your medication" was not blocked); fixed with `changesMedication` in `output.ts`. 199 tests pass.
- Urgent-GP / 111 rules (`feat/nhs-111-rules`, 2026-11-15): 6 prompt rules with 15 positive, 6 negated and 10 near-miss cases. Scorecard 173/173, then 180/180 after the personal-needs wording fix (25/25 rules cited, 35/35 urgent, 15/15 prompt with the GP/111 step added, 0 false alarms on 26 negated, 30 near-miss and 12 everyday messages, 24/24 unsafe replies blocked, 6/6 careful replies delivered).
- 2026-11-15: at the owner's request Person A built the `/summary` "Recent assistant conversations" section (frontend exception, noted in SHARED_CONTEXT). Checked with headless Brave at 375px against live Supabase data. Also widened `MENTIONS_NO_HISTORY` so "No prior related logs" does not get `NO_HISTORY_NOTE` appended twice. 244 tests pass.
- 2026-11-15: "Save to my log" (frontend exception at the owner's request). Prefill never reads AI text. Headless Brave click-through with the mock provider at 390px: prefilled "Right knee", pain 5, saved row confirmed in Supabase, then deleted. 248 tests pass.
- 2026-11-15: Google sign-in (`feat/google-auth`). PKCE over Supabase Auth REST, httpOnly cookies, `getRequestContext()` with token refresh, `authenticate()` first in every data route, `supabaseRest` now requires the user's `accessToken`, migration `0003_user_accounts.sql` (per-user RLS, private `medimate_settings.demo_owner_email`, `claim_medimate_profile()` with a 5-account cap raising `MMCAP`, owner-change trigger, `age` nullable). Local checks without the migration: protected pages → 307 `/login?next=…`; data APIs → 401 before any work; `/auth/login` → Supabase authorize with an S256 challenge; forged JWT cookie → Supabase 401 → our 401 with cookies cleared. 265 tests pass. Real Google sign-in is checked after the owner's setup.
- 2026-11-15: `/api/auth/me` exposes a nullable `avatarUrl` from trusted Google photo metadata (`avatar_url` or `picture`, HTTPS on `lh*.googleusercontent.com` only; contract §0a). Missing or untrusted photo metadata yields `null`, allowing the UI to show initials.
- 2026-11-15: weekly AI summary (`src/lib/ai/weekly-summary.ts`, `/api/insights/weekly`, contract §3d). It reuses `SYSTEM_PROMPT` and `buildUserContent` (`mode: "weekly"`), `parseModelOutput` with one repair, and `toContractAssessment`. Tests: 10 unit tests; scorecard lines "Weekly summary: unsafe AI output blocked" and "warning sign in a log escalated". Live Groq on the demo week:
  - First run: 3/3 delivered, but they used "low/limited activity" wording, so a check now blocks low-amount judgements.
  - Then 2 of 3 failed on structure: more than 5 cited ids, and empty unknowns. Fixed by raising the cited-id cap to 14 and having the weekly instruction require at least one unknown.
  - Also new: a `"you have <condition>"` ban ("You have sciatica." was getting through when references were attached).
- Still needed: browser walk-through of the full demo on the judging device; the prescription explainer UI once Person B builds it.

## 7. Decisions and pending work

Do not reverse these without agreeing first:

- No vector database, no second backend service, no `@supabase/supabase-js`, no service-role key in request paths.
- A safety rule or medical explanation is only added with an approved source recorded in `docs/AI_SAFETY_SPEC.md` §9, plus tests.
- The prescription explainer stays deterministic (no LLM) and never explains doses, drug names, purpose or timing.
- Reminders are user-written: no suggested content, `userConfirmed: true` required. Only medication reminders notify (§3f, owner decision 2026-11-15); notification text is the user's own wording plus a confirm prompt, never medicine advice.
- Notifications: the DB (pg_cron + pg_net, migration 0006) decides who is due and posts to `/api/notifications/dispatch` with a shared secret; the route only sends. No service-role key: the only anon call is `prune_push_subscriptions`, which checks the same secret.
- Charts use plain SVG (no Recharts dependency).
- Data access: every Supabase data call uses the signed-in user's token plus the anon key; anon alone reaches no rows (since migration 0003).
- Workflow: Person A builds the system side (schemas, routes, DB, AI/safety, contract, tests) and hands Person B a UI prompt; Person A does not edit frontend files.

Pending:

- Person B: "Recent assistant conversations" section on `/summary` using `GET /api/assistant/sessions` (contract §3c).

- Person B: prescription explainer UI (contract §3b; ClickUp "Prescription abbreviation explainer UI").
- Owner: run `supabase/reset-demo.sql` in the Supabase SQL editor right before the demo (restores Alex Demo, 14 logs re-dated to today, 2 reminders; deletes all chat sessions). Then rehearse and record the backup video.
- Person B: treat 429 as retryable in `src/lib/api-client.ts` and show the wait message.
- Any contract change: update `docs/API_CONTRACTS.md`, the Zod schema, tests and both AI context files together, and tell the other developer.

- 2026-11-15: Delete account — `supabase/migrations/0005_delete_account.sql` (`delete_medimate_account()`, security definer, only `auth.uid()`; demo profile unlinked, never deleted; deletes the auth user, freeing a sign-up place), `src/app/api/auth/account/route.ts` (DELETE, 204), `deleteAccount()` in api-client, contract §0a. Chat 401 no longer redirects (`redirectOnUnauthenticated` param on `requestJson`). Header name refresh via `PROFILE_SAVED_EVENT` (header stays mounted across `router.replace`, so it showed "New user" after onboarding).

- 2026-11-15: Grounding + analytics + eval. `rankRelevantLogs` (retrieve-history.ts): term overlap, location match ×2, recency/pain tie-breaks (<1 pt total), duplicates (same day + text) collapsed to highest pain. `src/lib/health/analytics.ts`: `computeAnalytics`, `recordedFactsFor` → `<RECORDED_PATTERNS>` prompt section + `assessment.recordedFacts`; `historyConsidered` built in `toContractAssessment` (Grounding param). `findUnsupportedClaims`/`claimEvidence` in output.ts (ISO + month-name dates, N/10, "on N days"/"N times"; date parts excluded from numbers). Route `GET /api/insights/analytics`. `scripts/eval.ts` (`npm run eval`, `--live N`, `--write`), tests/eval.test.ts, tests/analytics.test.ts. Scorecard 266/266 (invented-history category; scripted replies now get synthetic logs). Live eval needs `reasoning_effort: "low"` like production or gpt-oss runs out of tokens.

- 2026-11-15: Medicine-reminder notifications + PWA (contract §3f). Migration 0006: `push_subscriptions`, `reminder_doses` (RLS read own; writes via security-definer `save_push_subscription`, `confirm_reminder_dose` (owner, ≤1 h after due, P0002/P0001 → 404/409), `prune_push_subscriptions(secret)`), `medimate_dispatch_reminders()` every minute via pg_cron (3 notifications 5 min apart, then missed; occurrences >10 min old not back-filled), `delete_medimate_account` also clears demo-profile devices. Routes: `/api/notifications/{config,subscriptions,dispatch}`, `/api/reminders/doses`, `/api/reminders/doses/{id}/confirm`. `src/lib/notifications/doses.ts` (pure: mapper, wording, `dispatchNotifications`), `senders.ts` (web-push 3.6.7 VAPID, nodemailer 10.2.1 Gmail). New error code `CONFLICT` 409. PWA: `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, `public/icons/*`, `src/app/apple-icon.png`; browser helpers `src/lib/push-client.ts`. Verified the migration in a throwaway postgres:16 (stubs for auth/pg_net/pg_cron): 3 attempts then missed, isolation, confirm window, prune secret, re-run safe. Eval isolation 67/67, tests 316.

- 2026-11-15: UI redesign (front end only, PRs #12–#17): palette unification, `PageHeader`, `LoadingSkeleton`, sidebar + phone tab bar, Today page with quick check-in, assistant "History used" panel from `historyConsidered`. No API, `src/lib`, safety-rule or disclaimer changes. Figma proposal: file "MediMate — Design proposal" in the owner's drafts.
