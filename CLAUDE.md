# CLAUDE.md — MediMate Project Instructions

You are the primary implementation agent for **MediMate**, a 32-hour hackathon prototype built by two developers. Optimize for a reliable end-to-end demonstration, not production-scale architecture or feature count.

## 1. Read these documents first

Before making code changes, read:

1. `docs/PROJECT_PLAN.md`
2. `docs/ARCHITECTURE.md`
3. `docs/API_CONTRACTS.md`
4. `docs/AI_SAFETY_SPEC.md`
5. `docs/WORKFLOW.md`
6. `docs/DEMO_TEST_PLAN.md`
7. `AGENTS.md`, `docs/SHARED_CONTEXT.md`, `docs/AI_A.md` (frontend AI) and `docs/AI_B.md` (backend AI, this assistant's own context)

After an important implementation, API, schema, safety, ownership, migration or deployment change, update `docs/AI_B.md` and the concise cross-team decision in `docs/SHARED_CONTEXT.md` (see `AGENTS.md`). Never put secrets or real health data in them.

These documents define the agreed product scope and engineering constraints. If the repository already contains code that conflicts with a proposal, inspect it and preserve working behavior; report the discrepancy rather than overwriting it blindly.

## 2. Product objective

Build a web application where a user can:

- View and edit a synthetic personal health profile.
- Create and review daily health logs.
- Describe a health concern in a conversational assistant.
- Receive follow-up questions when information is missing.
- See an educational, non-diagnostic assessment that uses relevant historical records and medical references.
- See appropriate safety guidance and a clear disclaimer.

**Core differentiator:** MediMate retrieves relevant personal health history before generating an answer. Do not reduce the product to a generic chatbot.

## 3. Locked scope

### P0 — must work end to end

1. Personal health profile.
2. Daily health logging.
3. Multi-turn AI symptom conversation.
4. Relevant-history retrieval and explanation of how history relates to the current concern.
5. Deterministic safety checks, escalation guidance and a non-diagnostic disclaimer.

### P1 — only after P0 is integrated and tested

1. Basic trends chart.
2. Doctor-readable health summary.
3. PDF export.

### Explicitly out of scope

- Training or fine-tuning a medical model.
- Predicting or diagnosing diseases.
- Medical image/rash analysis.
- Voice input beyond the browser's built-in Web Speech API. (Dictation in the assistant via Web Speech was added on 2026-11-15. In Chrome the audio goes to Google's speech service, and Brave does not support it.)
- Wearable integrations.
- Native mobile application.
- Scheduled or emailed weekly summaries, and medication notifications. (An on-demand weekly AI summary of the user's own logs was added by the owner on 2026-11-15; it uses the same safety order and output checks as the chat.)
- Large-scale medical web crawling.
- A vector database unless a tested need arises and time remains.
- Complex agent frameworks or multi-agent orchestration.

Do not implement out-of-scope items unless the project owner explicitly changes the scope.

## 4. Expected technology direction

Use the existing repository choices where they already work. The intended stack is:

- Next.js App Router + TypeScript.
- Tailwind CSS.
- Next.js Route Handlers for server-side endpoints.
- Supabase PostgreSQL for persistence.
- A server-side LLM API client (Anthropic if a working API key is available; otherwise the provider explicitly selected by the team).
- Zod for input/output validation.
- Recharts only if the P1 trends chart is reached.
- Vercel deployment.

Do not add FastAPI or a second backend service for this hackathon. Do not introduce a vector database by default. Do not switch package managers after one has been established.

## 5. Core engineering rules

- Inspect the repository and `git status` before every substantial task.
- Do not delete, reset, reformat, or replace existing work unless explicitly instructed.
- Keep changes small and testable. Prefer vertical slices that can be integrated quickly.
- Do not install a dependency without explaining why the built-in platform/API is insufficient.
- Do not modify unrelated files.
- Keep TypeScript strict; avoid `any`. Use `unknown` and validate it when needed.
- Validate all API input with Zod (or the validation library already adopted by the repo).
- Return predictable error responses; never expose stack traces, secrets or provider errors to the browser.
- Keep LLM API keys and Supabase privileged credentials server-side only.
- Never commit `.env`, `.env.local`, API keys, access tokens or real health information.
- For the public hackathon demo, use synthetic data only. Since 2026-11-15 (owner decision) users sign in with Google; RLS limits each user to their own profile, only one configured demo account sees the seeded synthetic profile, and sign-ups are capped at 5. Do not use a service-role key to serve unauthenticated public requests.
- Add loading, empty, error and retry states for user-facing async operations.
- Use accessible labels, keyboard-operable controls and responsive layouts.
- Do not claim a feature is complete until it has been exercised through the UI and the relevant API path.

## 6. Health and AI safety rules — non-negotiable

MediMate is a hackathon health-information prototype, not a doctor and not a diagnostic device.

- Never state or imply that the application has diagnosed a disease.
- Never invent diagnostic probabilities, confidence percentages, citations, lab values or patient history.
- Present possibilities as explanations to discuss with a qualified clinician, not as confirmed causes.
- Distinguish recorded facts, user-reported statements, retrieved medical-reference facts and model-generated interpretation.
- Explain uncertainty and identify important missing information.
- Do not recommend starting, stopping or changing prescription medication or dosage.
- Do not reassure a user that they are safe merely because no configured warning rule matched.
- Run deterministic warning-sign checks before ordinary LLM assessment. The LLM must not override a triggered safety result.
- Warning rules must be based on a cited, authoritative medical reference and tested with fixed examples. Do not invent medical rules from intuition.
- Every assessment must show a clear non-diagnostic disclaimer and appropriate care-seeking guidance.
- Use synthetic patient data only in the public demo. Do not encourage testers to submit real personal health information.

Read `docs/AI_SAFETY_SPEC.md` before implementing or changing any health-related prompt or logic.

## 7. History retrieval rules

- Retrieve only records relevant to the current symptom and a sensible recent time window; do not dump the entire database into every prompt.
- Include dates and source identifiers for retrieved records.
- Do not infer causation from correlation. For example, prolonged sitting and back discomfort may be associated observations, not proof of the cause.
- If there is no relevant history, say so rather than fabricating personalization.
- Keep user history and external medical references in separate context sections.
- The UI should show which historical observations informed the response.

## 8. Frontend/backend collaboration

There are two developers. Person A owns backend, database and AI. Person B owns frontend, forms, charts and pitch. Both can use Claude Code/Copilot, but they must not concurrently edit the same files without coordination.

- Treat `docs/API_CONTRACTS.md` as the shared agreement.
- If an API contract needs to change, update the document and tell the other developer before changing implementation.
- Frontend work may use typed mock data until the endpoint is ready.
- Backend work must return the agreed response shape even if a field is temporarily empty.
- Merge small branches frequently; do not leave integration until the last quarter of the hackathon.

## 9. Implementation priority

Use this exact priority unless the project owner changes it:

1. App runs locally and deploys.
2. Supabase connection and schema.
3. Profile read/update.
4. Health-log create/list.
5. Chat endpoint with validated request/response.
6. Follow-up conversation loop.
7. Relevant history retrieval.
8. Safety checks and assessment disclaimer.
9. Full end-to-end demo.
10. Basic trends chart.
11. Exportable report.

If behind schedule, cut P1 features. Do not cut safety checks, API validation, history retrieval or the core demo flow.

## 10. Definition of done

A task is done only when:

- It matches the agreed behavior and API contract.
- It handles normal, empty and error cases.
- Typecheck/lint/tests relevant to the change pass.
- The feature has been tested in the browser or through the endpoint.
- No secrets or real user data were added.
- The developer knows what changed and how to verify it.

Before declaring a milestone complete, report:

1. Files changed.
2. Behavior implemented.
3. Commands/tests run and their results.
4. Known limitations or blockers.
5. Next smallest task.

## 11. Git behavior

- Never force-push, rewrite shared history, delete branches or run destructive Git commands unless explicitly instructed.
- **Commit often:** commit each small, working, checked step on the current feature branch (never directly on `main`) with a focused Conventional Commit message. Stage specific files; never `git add .`. Run lint/typecheck/tests relevant to the change before each commit.
- **Push less often than you commit:** batch several commits and push at meaningful checkpoints — a finished task or vertical slice, before opening/updating a PR, before handing off to the other developer, or at least every 2–3 hours to match the integration cadence in `docs/WORKFLOW.md`. Never push broken builds or failing checks.
- Use the branch and merge rules in `docs/WORKFLOW.md`.
- Do not merge another developer's branch without checking its diff and test status.

## 12. How to start

When first invoked in this repository:

1. Read the required documents above.
2. Inspect the repository structure, package scripts, dependencies, environment examples and Git status.
3. Summarize the current state against the plan.
4. Identify blockers, especially missing API credentials or Supabase configuration.
5. Implement the next P0 task only. Do not attempt the entire application in one giant change.
