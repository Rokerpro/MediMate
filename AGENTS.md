<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared AI context

Before starting any task, read all current project context and governing documents:

- `docs/SHARED_CONTEXT.md` — combined source of truth for both AIs.
- `docs/AI_A.md` — frontend/product AI context.
- `docs/AI_B.md` — backend/AI handoff context and update instructions.
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACTS.md`
- `docs/AI_SAFETY_SPEC.md`
- `docs/PROJECT_PLAN.md`
- `docs/WORKFLOW.md`

After an important implementation, architecture, API, safety, ownership, migration, or deployment change:

1. Update the relevant AI-specific context file.
2. Update `docs/SHARED_CONTEXT.md` with the concise cross-team decision.
3. Keep the documents factual, current, and free of secrets or real health information.

The existing files are canonical: `docs/API_CONTRACTS.md` is the API contract and `docs/PROJECT_PLAN.md` is the task plan. Do not create duplicate contract or task definitions under alternate names.
