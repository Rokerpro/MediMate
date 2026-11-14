---
name: testing-and-review
description: RECOMMENDED. Load before declaring any MediMate task done, before committing or pushing, when fixing a bug, or when asked to test or review. Covers running the relevant checks, testing API integrations, finding edge cases, reviewing security and data handling, and verifying fixes instead of assuming they work.
---

# Testing and review

A task is not done until it has been exercised (`CLAUDE.md` §10). "It compiles" and "the code looks right" are not verification.

## 1. Checks to run

| When | Command |
|---|---|
| Every change | `npm run lint` and `npm run typecheck` |
| Logic, schemas or contracts | `npm test` (Node built-in runner, `tests/**/*.test.ts`) |
| Before push or PR, and at milestones | `npm run build` |

Report each command's **actual result**. Do not summarize a failure as a pass. If something could not be run (e.g. no Supabase keys), say so explicitly.

Writing tests:

- Tests live in `tests/` and use `node:test` with `node:assert/strict`.
- Import source modules by relative path with the `.ts` extension.
- Add no new test dependency without justification.

## 2. Testing API integrations

1. Start the app with `npm run dev`.
2. For each touched endpoint, use `curl` to check:
   - a valid request;
   - an invalid body (400);
   - missing or oversized fields;
   - an unknown ID (404);
   - that the response parses against the schema in `@/lib/validations`.
3. Chat: start a new session (`sessionId: null`), then continue it with the same ID. Check message order and status transitions (`follow_up` to `assessment`, and the `urgent` path).
4. Failure paths:
   - an AI provider timeout or a bad key returns 503 `AI_UNAVAILABLE` with a safe message;
   - malformed model JSON is repaired once or rejected, and never shown.
5. UI changes: open the page in the browser and check the loading, empty, error, retry and success states, plus phone width.

## 3. Edge cases to probe

- Empty states: no logs, no relevant history, an empty profile list field.
- Boundaries: pain 0 and 10, pain 11 and -1; sleep quality 1 and 5; 0 and negative minutes; maximum string lengths; whitespace-only text.
- Wrong types: strings for numbers, `null` versus missing, unknown extra keys, invalid JSON.
- Chat:
  - an unknown or foreign `sessionId`;
  - a double-submit or two concurrent turns on one session;
  - a very long message;
  - prompt-injection text ("ignore previous instructions");
  - asking for a diagnosis;
  - asking whether to stop a medication.
- History: a relevant record, an irrelevant record, and no records (`docs/AI_SAFETY_SPEC.md` §8).

## 4. Security and data-handling review

- [ ] No secrets in code, git, logs or client bundles. Server env vars have no `NEXT_PUBLIC_` prefix and are not imported in client components.
- [ ] No service-role key in public paths. RLS remains enabled and is scoped to the demo profile.
- [ ] Profile IDs never come from the client. Session ownership is checked.
- [ ] Errors expose no stack traces, SQL, Supabase or provider details.
- [ ] Raw health content is not logged. Only synthetic data is in seeds, fixtures and screenshots.
- [ ] Medical output passes the `medical-safety` skill checklist.
- [ ] Before staging, `git status` and `git diff --cached` show no `.env*` files (other than `.env.example`) and no unrelated changes.

## 5. Verify fixes, don't assume

1. Reproduce the bug first and note the exact failing input or output.
2. Fix it.
3. Re-run the **same** reproduction and show that it now passes. Add a test that would have caught it, when practical.
4. Re-run the full check set from §1 to catch regressions.
5. Report what was reproduced, what changed, and the before and after results. If you could not reproduce or verify it, say that. Do not claim it is fixed.
