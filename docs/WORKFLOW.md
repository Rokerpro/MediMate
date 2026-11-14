# MediMate — Git and Collaboration Workflow

## 1. Branch model

Keep `main` deployable at all times. Use short-lived feature branches; avoid permanent `person-a` and `person-b` branches because they drift and create late merge conflicts.

Branch names:

- `feat/profile-api`
- `feat/health-logs-api`
- `feat/ai-chat`
- `feat/history-retrieval`
- `feat/safety-engine`
- `feat/profile-ui`
- `feat/health-log-ui`
- `feat/assistant-ui`
- `feat/dashboard-charts`
- `fix/<short-description>`
- `docs/<short-description>`

## 2. Ownership

| Owner | Main files/areas |
|---|---|
| Person A | `src/app/api/**`, `src/lib/ai/**`, `src/lib/health/**`, `src/lib/supabase/server.ts`, `supabase/**`, shared API schemas/types |
| Person B | `src/components/**`, `src/app/(app)/**`, frontend hooks and UI state, presentation assets |
| Shared/coordinate | `docs/API_CONTRACTS.md`, root config, shared types, `package.json`, `src/app/layout.tsx`, global CSS |

Ownership is a coordination aid, not a prohibition. Notify the other person before changing shared files.

## 3. Branch workflow

For each task:

```bash
git switch main
git pull --ff-only
git switch -c feat/short-task-name
# implement one focused task
npm run lint
npm run typecheck   # if script exists
npm test            # if script exists
npm run build       # at milestone checkpoints
git status --short
git add <specific-files>
git commit -m "feat: describe the task"
git push -u origin feat/short-task-name
```

Then open a small PR (or have the other developer review the diff), merge into `main`, and delete the branch after merge. If the hackathon platform makes PR overhead too slow, use a direct merge after the other developer reviews the diff and checks the working tree.

Do not use `git add .` blindly. Do not commit `.env*` secrets. Do not force-push or rewrite shared history.

## 4. Commit message style

Use simple Conventional Commit prefixes:

- `feat:` new user-visible behavior.
- `fix:` bug fix.
- `docs:` documentation.
- `refactor:` code change without behavior change.
- `test:` tests.
- `chore:` tooling/configuration.

Examples:

- `feat: add health log creation endpoint`
- `feat: add history-aware assistant response`
- `fix: handle unavailable AI provider`
- `docs: define chat API response contract`

## 5. Integration cadence

- Integrate at least every 2–3 hours.
- Do not leave all frontend/backend integration until hour 22 or later.
- Use mock data early, but make mock objects exactly match the API contract.
- Run the full P0 flow on `main` after every major merge.
- Use Vercel Preview Deployments for feature branches if already configured.

## 6. Copilot and Claude Code coordination

- Claude Code is the primary implementation agent for the task assigned to Person A or the designated owner.
- Copilot is a coding assistant for Person B (and may help either developer with small, isolated tasks).
- Do not ask both tools to edit the same files at the same time.
- Assign one tool/owner per file group for a task.
- Copilot should follow `.github/copilot-instructions.md`; Claude Code should follow root `CLAUDE.md`.
- Do not spend hackathon time installing elaborate agent harnesses, subagents or MCP integrations. Use the tools already working.
