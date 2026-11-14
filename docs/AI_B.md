# AI_B — Backend/AI Context Handoff Instructions

This file is the handoff target for the backend/AI assistant (Person A). It is intentionally an instruction template until that assistant fills in its current project context.

## Required reading before writing

Read all of these first:

- `docs/SHARED_CONTEXT.md`
- `docs/AI_A.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACTS.md`
- `docs/AI_SAFETY_SPEC.md`
- `docs/PROJECT_PLAN.md`
- `docs/WORKFLOW.md`
- `AGENTS.md`

Inspect the current branch and worktree before documenting anything:

```text
git status --short
git branch --show-current
git log --oneline -10
```

## What to document here

Replace this instruction section with a factual, current backend/AI context report covering:

1. **Current branch and commit**
   - Branch, latest commit, whether it is pushed, and whether migrations are deployed.

2. **Backend architecture**
   - Route Handlers, Supabase access, fixed demo profile/RLS model, server-only environment variables, and any provider adapters.

3. **Implemented endpoints**
   - Route paths, request/response schemas, status codes, error behavior, and important edge cases.
   - Link every shape to `docs/API_CONTRACTS.md` and `src/lib/validations/`.

4. **Database and migrations**
   - Tables, columns, constraints, indexes, seed data, RLS policies, and which migrations must be applied.
   - Never include credentials or secret values.

5. **AI and health safety**
   - Provider selection, prompts, history retrieval window, curated references, deterministic warning rules, output validation, repair behavior, and known limitations.

6. **Tests and verification**
   - Exact commands run and their results.
   - Important fixed cases and any endpoint/browser verification still needed.

7. **Decisions and pending work**
   - Decisions another AI must not reverse casually.
   - Contract or schema work that requires coordination.
   - Deployment blockers, migration blockers, or known risks.

## Synchronization rules

- Do not overwrite `AI_A`’s context. Add backend facts here and put cross-cutting decisions in `SHARED_CONTEXT.md`.
- Do not include secrets, real health data, provider keys, or private user information.
- Update this file after important backend/API/schema/safety changes.
- After writing this file, update `SHARED_CONTEXT.md` with the concise shared conclusions and tell the other AI which files changed.
- If an API contract changes, update `docs/API_CONTRACTS.md`, the Zod schema, tests, and both AI context files in the same coordinated change.
