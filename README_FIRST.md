# MediMate — Claude Code Handoff Pack

This pack is the implementation brief for the 32-hour, two-person hackathon build.

## Files

- `CLAUDE.md` — primary instructions Claude Code should follow from the repository root.
- `.github/copilot-instructions.md` — repository-wide instructions for GitHub Copilot.
- `docs/PROJECT_PLAN.md` — scope, ownership, milestones, priorities and acceptance criteria.
- `docs/ARCHITECTURE.md` — proposed app structure, data model and runtime flow.
- `docs/API_CONTRACTS.md` — frontend/backend contracts to agree before parallel implementation.
- `docs/AI_SAFETY_SPEC.md` — non-diagnostic behavior, safety pipeline and response schema expectations.
- `docs/WORKFLOW.md` — branch naming, commits, PRs and collaboration rules.
- `docs/DEMO_TEST_PLAN.md` — end-to-end demo and final test checklist.
- `docs/CLAUDE_TASK_PROMPTS.md` — copy/paste prompts for Claude Code milestone by milestone.
- `supabase/seed.sql` — fictional 14-day demo profile and health log data.
- `supabase/migrations/0001_initial_schema.sql` — starter schema outline. Review and adapt before applying.

## How to use this pack

1. Copy the contents into the root of the MediMate Git repository. Preserve the `.github/` and `docs/` folders.
2. Start Claude Code in the repository root so it can read `CLAUDE.md`.
3. Ensure the team agrees on the API contracts in `docs/API_CONTRACTS.md` before Person A and Person B work in parallel.
4. Give Claude Code the kickoff prompt below.
5. Person B should use the `.github/copilot-instructions.md` file with Copilot enabled in the same repository.

## Claude Code kickoff prompt

> Read `CLAUDE.md` and every file it references before making changes. Inspect the existing repository, current Git status, package manager, and installed dependencies. Do not overwrite or delete existing work. Compare the repository with the plan and report: (1) what already exists, (2) what is missing, (3) any conflicts or decisions needed, and (4) the smallest implementation sequence that achieves the P0 demo. Then implement only the first milestone: project/bootstrap checks and the agreed shared types/API contracts. Keep changes focused, run relevant checks, and report exact files changed and commands run. Do not add optional features or unapproved dependencies.

## Important setup checks

- Confirm a working model API key separately from Claude Code access. Claude Code subscription access does not automatically mean the deployed application has API credits.
- Create `.env.local` from `.env.example`; never commit secrets. The Supabase anon key is used with restrictive RLS; the LLM key remains server-side.
- Use synthetic demo data only. Do not enter real patient information in the hackathon deployment.
- The migration is a hackathon-only schema with RLS restricted to a single synthetic demo profile. The public demo data is intentionally disposable. Never put real health information into it.

## Recommended initial commands

Run only the commands appropriate to the repository's current state; do not blindly recreate an existing app.

```bash
 git status --short
 node --version
 npm --version
 npm install
 npm run dev
```

If no app exists yet, initialize the agreed Next.js TypeScript project first. Do not create a second nested app by accident.
