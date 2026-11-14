# Claude Code — Task Prompts by Milestone

Use one prompt at a time. Do not ask Claude to build the entire app in a single request. The repository instructions and API contracts remain authoritative.

## Prompt 0 — Repository audit

```text
Read CLAUDE.md and the docs it references. Inspect the existing repository, Git status, scripts, dependencies, environment examples and current deployment setup. Do not modify or delete existing work. Report the current state against the P0 plan, identify blockers (especially Supabase and model API credentials), and propose the smallest next implementation step.
```

## Prompt 1 — Bootstrap and shared contracts

```text
Implement only the bootstrap tasks from docs/PROJECT_PLAN.md. Preserve the existing app if one exists. Ensure the agreed Next.js TypeScript structure, scripts for dev/lint/typecheck/build, shared Zod schemas/types and environment example are in place. Do not implement optional features or install unnecessary dependencies. Run the available checks and report exact results.
```

## Prompt 2 — Supabase schema and profile/log APIs (Person A)

```text
Implement the Supabase schema and seed setup described in docs/ARCHITECTURE.md, then implement GET/PATCH /api/profile and GET/POST /api/health-logs exactly as specified in docs/API_CONTRACTS.md. Use the fixed synthetic demo profile ID and the RLS design in the migration. Do not use a service-role key in public request paths. Add input validation, safe errors and tests where practical. Do not build the AI assistant yet.
```

## Prompt 3 — Profile and logging UI (Person B)

```text
Implement the profile and daily health-log screens using the API contracts in docs/API_CONTRACTS.md. Use mock data only if the endpoints are not merged yet, and make the mocks match the contract exactly. Include loading, empty, validation, success and error states. Do not edit backend route handlers or database schema.
```

## Prompt 4 — AI chat foundation (Person A)

```text
Implement POST /api/assistant/chat and the server-side LLM client using docs/API_CONTRACTS.md and docs/AI_SAFETY_SPEC.md. Keep the provider key server-side. Support a multi-turn session, validate input and structured output, enforce a request timeout, and return a safe error if the provider is unavailable. Do not claim to diagnose, return disease probabilities or invent medical sources. Do not build history retrieval beyond the minimal placeholder needed for the contract.
```

## Prompt 5 — History-aware retrieval (Person A)

```text
Implement bounded retrieval of relevant health logs and profile facts for the current user concern. Return the source log IDs and dates with the retrieved context. Keep personal records separate from medical references. Ensure the assistant says when no relevant history exists and does not infer causation from correlations. Add tests for relevant, irrelevant and empty history.
```

## Prompt 6 — Safety engine (Person A; UI coordination with Person B)

```text
Read docs/AI_SAFETY_SPEC.md. Implement only deterministic warning rules that have an authoritative source URL recorded in the spec. Run them before normal LLM generation. A triggered rule must not be downgraded by the LLM. Add fixed positive, negative and ambiguous tests. If a rule has no reviewed source, do not invent it; leave a documented TODO and report the blocker.
```

## Prompt 7 — Assistant UI and integration (Person B)

```text
Implement the chat interface against the exact POST /api/assistant/chat contract. Support multi-turn messages, follow-up questions, an assessment card, relevant-history citations, source links, safety messages, loading/error/retry states and the required disclaimer. Do not create fake probabilities or diagnosis labels. Do not modify the backend contract without discussing it first.
```

## Prompt 8 — End-to-end QA

```text
Run the full P0 demo flow described in docs/DEMO_TEST_PLAN.md. Inspect the UI and API paths, identify the highest-risk defects, and fix only critical issues. Test empty history, relevant history, irrelevant history, a configured safety trigger, malformed model output and provider timeout. Run lint, typecheck, tests and production build if scripts exist. Report exact commands/results and remaining limitations. Do not add new features.
```

## Prompt 9 — Stretch features (only after hour 24 and P0 stable)

```text
P0 is frozen and the deployed demo has passed the acceptance tests. Implement only the highest-priority stretch item that fits the remaining time: first a simple pain/sleep trends chart; then a doctor-readable summary; then PDF export. Do not change AI safety behavior or API contracts without approval. Stop if the change risks the stable demo.
```
