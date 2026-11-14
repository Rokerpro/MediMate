# MediMate — Demo and Test Plan

## 1. Demo objective

Show that MediMate uses the patient's history, not just the latest symptom message, to produce a more context-aware educational response.

Use only a fictional, synthetic adult patient. Put a visible “Synthetic demo data — do not enter real health information” notice in the application.

## 2. Suggested 3–5 minute demo

1. Open the seeded dashboard and introduce the synthetic profile.
2. Show a short timeline of previous logs (for example, several reports of discomfort, variable sleep and periods of prolonged sitting). Avoid implying these observations prove a cause.
3. Open the assistant and enter a new symptom statement.
4. Show the follow-up question step.
5. Submit the synthetic answers.
6. Show the assessment, including relevant dated history, what remains unknown, references and next steps.
7. Demonstrate the warning-sign flow using a separate predefined test scenario if safe and appropriate; do not use a real person or claim comprehensive emergency detection.
8. Optionally show a trends chart or report export only if it is stable.

## 3. End-to-end acceptance tests

### Profile
- Profile loads from the database.
- Profile can be edited and saved.
- Invalid numeric inputs are rejected with clear messages.

### Daily logs
- User can create a log.
- New log appears in the timeline after refresh.
- Pain and sleep values are range-validated.
- Empty optional fields do not crash the UI.

### Chat
- New conversation creates a session.
- Follow-up turns use the same session ID.
- User and assistant messages render in order.
- Loading, error and retry states work.
- Provider timeout does not leave the interface permanently loading.

### Personalization
- Seeded history is actually queried from the database.
- Assessment references correct prior observations and dates.
- Irrelevant observations are not forced into the response.
- Empty history is described honestly.
- The app does not infer causality from correlation.

### Safety
- Each implemented warning rule has a cited source and tests.
- A matching rule triggers the deterministic response.
- The LLM cannot suppress or downgrade that response.
- Every completed assessment displays the disclaimer.
- No rule match is not described as proof of safety.

### Deployment
- Live app loads from a fresh browser session.
- Environment variables are configured in deployment settings.
- No secret is present in browser bundles or Git history.
- Demo works on the network/device used for judging.

## 4. Backup plan

Before presentation:

- Keep a known-good seeded demo profile.
- Prepare screenshots or a short screen recording of the complete flow.
- Keep a local working version available in case deployment/network fails.
- Do not rely on live external medical search for the only demo path; use a small verified reference set that is already available.
