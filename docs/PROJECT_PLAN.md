# MediMate — 32-Hour Hackathon Project Plan

## 1. Objective

Deliver a deployed web application demo that lets a synthetic patient maintain a personal health profile and daily health history, then receive conversational, history-aware, non-diagnostic health information.

**Product differentiator:** MediMate retrieves relevant prior health records before responding to a new concern and makes the relevant history visible to the user.

## 2. Scope lock

### P0 — required

1. **Profile:** age, optional gender, height, weight, conditions, allergies, medications and relevant history.
2. **Daily log:** symptoms, pain location/intensity, sleep, mood, water, activity and notes.
3. **AI chat:** multi-turn conversation and follow-up questions.
4. **History-aware assessment:** retrieval of relevant prior records, clear explanation of relevance, uncertainty and missing information.
5. **Safety:** deterministic configured warning checks, escalation behavior, care guidance and a disclaimer with every assessment.

### P1 — stretch only after P0 passes end-to-end

1. Simple trends chart for pain/sleep.
2. Doctor-readable health summary.
3. PDF export.

### Out of scope

Model training, disease diagnosis, diagnostic probability scores, medical image analysis, voice, wearable integrations, native apps, weekly summaries, medication reminders, broad medical web crawling, vector database and multi-agent orchestration.

## 3. Team responsibilities

| Area | Person A — Backend/AI | Person B — Frontend/Product |
|---|---|---|
| Setup | Supabase project, server env, schema | Next.js UI shell, styling, routes |
| Profile/logs | DB queries and Route Handlers | Profile and daily-log forms |
| AI | Provider client, prompt, validation | Chat interface and message states |
| Personalization | Relevant-history retrieval and context assembly | Show retrieved history and reasoning |
| Safety | Deterministic rules and server enforcement | Warning and disclaimer presentation |
| Stretch | Report data endpoint | Charts and report export |
| Shared | Integration, testing, pitch rehearsal | Integration, testing, pitch rehearsal |

**Coordination rule:** agree on the API contracts before parallel work. Person B can use mock responses matching the contract. Do not wait for backend completion to start the UI.

## 4. 32-hour execution schedule

| Time | Milestone | Exit criteria |
|---|---|---|
| 0–2 | Repository and contracts | App/repo understood, ownership agreed, request/response contracts frozen |
| 2–4 | Infrastructure | Local app runs, Supabase connected, blank deployment succeeds |
| 4–9 | Profile and logging | Profile read/update and log create/list work; frontend forms integrated or mock-ready |
| 9–15 | Chat foundation | Model API works server-side; multi-turn chat and validated response shape work |
| 15–20 | Personalization | Relevant historical records are retrieved and visible in the answer |
| 20–22 | Safety | Configured rules run before normal assessment; urgent flow and disclaimer tested |
| 22–24 | P0 integration | Full demo path works in deployed environment; feature freeze |
| 24–27 | Stabilization | Critical bugs fixed; API timeout/error states tested |
| 27–30 | Polish/stretch | UI polish, then trends chart, then PDF only if safe |
| 30–32 | Presentation | 3–5 minute demo rehearsed; backup screenshots/recording ready |

## 5. Checkpoints and cuts

- **Hour 6:** app deploys, database connects, API contract is agreed.
- **Hour 12:** profile/logging work and basic chat works.
- **Hour 18:** actual history retrieval influences the assessment.
- **Hour 22:** safety checks are integrated.
- **Hour 24:** P0 feature freeze; no new functionality.
- **Hour 27:** deployed P0 flow is stable.

If behind schedule, cut in this order: PDF export → doctor-readable report polish → charts. Do not cut history retrieval, safety checks, disclaimers, API validation or end-to-end testing.

## 6. Definition of done

The P0 demo is complete only when a judge can:

1. Open the deployed application and view the seeded synthetic profile.
2. Review the patient's previous health logs.
3. Submit a new symptom through the chat.
4. Receive follow-up questions where information is missing.
5. See relevant historical observations retrieved from the database.
6. Receive a structured, non-diagnostic assessment with real source links and uncertainty.
7. See safety guidance and the disclaimer.

A feature is not done just because its component or endpoint exists in isolation.
