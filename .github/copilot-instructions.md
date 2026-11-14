# GitHub Copilot Instructions — MediMate

MediMate is a 32-hour, two-person hackathon prototype. Optimize for a reliable end-to-end demo, not feature count. These instructions mirror the root `CLAUDE.md`. If they disagree, `CLAUDE.md` and the docs below win.

Copilot mainly assists **Person B (frontend/product)**. Claude Code is the primary agent for Person A (backend/AI). Do not edit the same files another tool or developer is working on at the same time.

## 1. Read first

- `CLAUDE.md`: the full project rules.
- `docs/PROJECT_PLAN.md`: scope, priorities and acceptance criteria.
- `docs/ARCHITECTURE.md`: app structure and data model.
- `docs/API_CONTRACTS.md`: the shared frontend/backend agreement.
- `docs/AI_SAFETY_SPEC.md`: non-diagnostic behavior and safety rules.
- `docs/WORKFLOW.md`: branches, commits and PRs.
- `docs/DEMO_TEST_PLAN.md`: the demo flow and acceptance tests.

## 2. Product and scope

A web app where a synthetic user views and edits a health profile, creates and reviews daily health logs, and chats with an assistant. The assistant asks follow-up questions and returns an educational, non-diagnostic assessment that shows which **historical records** informed it, plus safety guidance and a disclaimer.

- **P0 (must work end to end):** profile, daily logging, multi-turn chat, relevant-history retrieval with visible history, deterministic safety checks and a disclaimer.
- **P1 (only after P0 is integrated and tested):** a trends chart (Recharts), a doctor-readable summary, PDF export.
- **Out of scope:** model training, diagnosis or disease prediction, image/rash analysis, voice, wearables, a native app, weekly AI summaries, medication notifications, web crawling, a vector database, multi-agent frameworks.

## 3. Stack

Next.js 16 App Router + TypeScript (strict), Tailwind CSS, Next.js Route Handlers, Supabase PostgreSQL, Zod 4, npm. Do not switch package managers, add a second backend, or install dependencies without explaining why the platform or existing deps are insufficient.

This Next.js version has breaking changes. Check `node_modules/next/dist/docs/` (see `AGENTS.md`) before using unfamiliar APIs.

## 4. Ownership

| Owner | Files |
|---|---|
| Person B (Copilot) | `src/components/**`, `src/app/(app)/**`, frontend hooks/UI state, presentation assets |
| Person A (Claude Code) | `src/app/api/**`, `src/lib/ai/**`, `src/lib/health/**`, `src/lib/supabase/**`, `supabase/**` |
| Shared: coordinate first | `docs/API_CONTRACTS.md`, `src/lib/validations/**`, `package.json`, root config, `src/app/layout.tsx`, `src/app/globals.css` |

Do not modify backend route handlers or the database schema from frontend work.

## 5. API contracts and shared types

- `docs/API_CONTRACTS.md` is the agreement. Import request/response types and schemas from `@/lib/validations`. Never hand-write duplicate types.
- Before the endpoints are merged, use the mocks in `src/lib/mocks/api-fixtures.ts`. They match the contract exactly and are covered by `tests/contracts.test.ts`.
- If a contract must change, update the doc and tell the other developer *before* changing the code.
- Handle the error envelope `{ "error": { "code", "message" } }` and the statuses 400, 404, 429, 500 and 503. A 503 (`AI_UNAVAILABLE`) must show a retryable, safe message.

## 6. Frontend rules

- Use Server Components by default, and Client Components only for interactive UI.
- Every async view needs **loading, empty, error and retry** states. A provider timeout must never leave the UI loading forever.
- Use accessible labels, keyboard-operable controls and responsive layouts.
- Show a visible notice on every page: **"Synthetic demo data — do not enter real health information."**
- Keep TypeScript strict with no `any`. Use `unknown` plus validation.
- Never put secrets or `NEXT_PUBLIC_` keys for the LLM or Supabase in client code. All Supabase and LLM calls go through server Route Handlers.

## 7. Health and AI safety (non-negotiable)

- Never use labels like "diagnosed", "disease detected", "95% likely" or "AI doctor confirmed". Never show probabilities or confidence scores.
- Present possible explanations as things to discuss with a clinician, not as confirmed causes.
- Every assessment must show the disclaimer, the historical observations used (with dates), source links from the API only, unknowns, and next steps including when to seek care.
- An `urgent` response shows the server's safety message prominently and must not be hidden or softened by the UI.
- Never present "no warning matched" as proof of safety.
- Do not suggest starting, stopping or changing medication.
- Use synthetic data only. Never add real health information to code, fixtures or screenshots.

## 8. Git workflow

- Never work directly on `main`. Use short-lived branches such as `feat/profile-ui`, `feat/health-log-ui`, `feat/assistant-ui` or `fix/<desc>`.
- **Commit often:** commit each small, working step with a Conventional Commit message (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Stage specific files and never `git add .`. Run `npm run lint`, `npm run typecheck` and `npm test` before committing.
- **Push less often than you commit:** batch several commits and push at meaningful checkpoints. Those are a finished task or slice, before opening or updating a PR, before handing off, or at least every 2–3 hours to keep integration flowing. Never push a broken build or failing checks.
- Never commit `.env*` files (except `.env.example`), keys or real data. Never force-push, rewrite shared history or delete branches.
- Run `npm run build` at milestone checkpoints. Merge small PRs often after the other developer reviews the diff.

## 9. Definition of done

A task is done only when it:

- matches the contract;
- handles normal, empty and error cases;
- passes lint, typecheck and tests;
- has been exercised in the browser against the real or mock API;
- adds no secrets or real data.
