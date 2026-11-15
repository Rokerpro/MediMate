# MediMate — API Contracts (Shared Frontend/Backend Agreement)

These contracts are intentionally small. Agree on them before parallel frontend/backend implementation. If a contract changes, update this document and notify the other developer first.

All endpoints return JSON. Validate inputs server-side. Use consistent error objects:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A user-safe explanation."
  }
}
```

Do not return stack traces, provider error bodies, API keys or database credentials.

## 1. Profile

### `GET /api/profile`

Returns the seeded demo profile.

```json
{
  "profile": {
    "id": "demo-profile-id",
    "displayName": "Alex",
    "age": 24,
    "gender": null,
    "heightCm": 175,
    "weightKg": 70,
    "conditions": [],
    "allergies": [],
    "medications": [],
    "medicalHistory": ""
  }
}
```

### `PATCH /api/profile`

Accepts only editable profile fields. Return `{ "profile": { ... } }` using the same shape. Validate numeric ranges and string lengths. Gender is optional and must not be used to make unsupported inferences.

## 2. Health logs

### `GET /api/health-logs?limit=30`

Returns newest logs first:

```json
{ "logs": [
  {
    "id": "log-id",
    "loggedAt": "2026-11-01T09:00:00.000Z",
    "symptoms": "Lower back discomfort",
    "painLocation": "Lower back",
    "painLevel": 3,
    "sleepDurationMinutes": 390,
    "sleepQuality": 2,
    "mood": "okay",
    "waterMl": 1500,
    "activityMinutes": 20,
    "notes": "Long period sitting"
  }
] }
```

### `POST /api/health-logs`

Request body uses the same log fields except `id` and server-generated timestamps. Return `{ "log": { ... } }` with HTTP 201. Validate pain level 0–10, sleep quality 1–5, and non-negative durations/volumes.

## 3. AI chat

### `POST /api/assistant/chat`

Request:

```json
{
  "sessionId": null,
  "message": "My lower back has been hurting since yesterday."
}
```

For a new conversation, `sessionId` is `null`; the server creates a session. For subsequent turns, send the returned `sessionId`.

Response shape:

```json
{
  "sessionId": "session-id",
  "status": "follow_up",
  "assistantMessage": "A focused follow-up question.",
  "followUpQuestions": ["Has the pain changed since it began?"],
  "safety": {
    "level": "routine",
    "triggered": false,
    "message": null
  },
  "assessment": null
}
```

When sufficient information is available:

```json
{
  "sessionId": "session-id",
  "status": "assessment",
  "assistantMessage": "Here is a summary of the information you shared.",
  "followUpQuestions": [],
  "safety": {
    "level": "routine",
    "triggered": false,
    "message": null
  },
  "assessment": {
    "summary": "Non-diagnostic summary.",
    "possibleExplanations": [
      {
        "title": "Possible explanation to discuss with a clinician",
        "whyItMayBeRelevant": "A cautious explanation tied to available facts.",
        "supportingHistory": [
          {
            "logId": "log-id",
            "date": "2026-11-01",
            "observation": "A previous user-reported observation."
          }
        ],
        "unknowns": ["Information not yet established."]
      }
    ],
    "nextSteps": ["Consider discussing persistent symptoms with a qualified clinician."],
    "sources": [
      {
        "title": "Medical reference title",
        "publisher": "Publisher name",
        "url": "https://example.org/real-source"
      }
    ],
    "disclaimer": "This is educational information, not a diagnosis or substitute for professional medical care."
  }
}
```

If a safety rule triggers, return `status: "urgent"`, a non-null safety message and no ordinary LLM-generated reassurance. The exact urgency wording must come from the reviewed safety specification. Do not let an AI response override the deterministic safety result.

`safety.level` values:

- `"routine"`: no configured rule matched (`triggered: false`, `message: null`). This is **not** medical clearance; never show it as "safe".
- `"urgent"`: an NHS "Call 999 / A&E" item matched. Always `status: "urgent"`.
- `"prompt"`: an NHS "Ask for an urgent GP appointment or get help from NHS 111" item matched (`docs/AI_SAFETY_SPEC.md` §9.1a). `triggered: true`, `message` holds the fixed NHS wording, and `status` stays `"follow_up"` or `"assessment"`. The server has already added a GP/111 sentence to `assistantMessage` and, on an assessment, put the GP/111 step first in `nextSteps`. The UI should show `safety.message` in a prominent, non-red notice (amber), labelled e.g. "Contact a GP or NHS 111 today", alongside the normal reply. Once triggered, later turns in the session stay at least at `"prompt"`.

## 3a. Reminders

Reminders are written and confirmed by the user. MediMate stores the user's own wording only: it never generates, suggests or checks reminder content, medication timing or doses. In-app list only; there are no push, SMS or email notifications. Schemas: `src/lib/validations/reminder.ts`. Table: `supabase/migrations/0002_reminders.sql`.

`Reminder`:

```json
{
  "id": "uuid",
  "title": "Fill in daily health log",
  "category": "medication | appointment | health_log | other",
  "notes": "string or null",
  "remindAt": "2026-11-14T20:00:00.000Z",
  "repeat": "none | daily | weekly",
  "active": true,
  "nextDueAt": "2026-11-14T20:00:00.000Z or null",
  "createdAt": "2026-11-10T08:00:00.000Z"
}
```

- `title` 1–120 chars, `notes` up to 500 chars.
- `nextDueAt` is computed by the server. One-off reminders return `remindAt` even when it has passed (show as overdue). Repeating reminders return the next occurrence at or after now (fixed 24 h / 7 day steps in UTC). `null` when `active` is false.

### `GET /api/reminders?includeInactive=false`

`200` → `{ "reminders": Reminder[] }`. Active reminders first, ordered by `nextDueAt`; then inactive ones (only when `includeInactive=true`). Maximum 100.

### `POST /api/reminders`

```json
{
  "title": "GP appointment",
  "category": "appointment",
  "notes": "Bring the printed summary",
  "remindAt": "2026-11-20T10:00:00+00:00",
  "repeat": "none",
  "userConfirmed": true
}
```

`category` defaults to `other`, `repeat` to `none`, `notes` is optional. `userConfirmed` must be `true`: the UI shows the reminder back to the user and sends it only after they confirm. Unknown fields (e.g. `profileId`) are rejected. `201` → `{ "reminder": Reminder }`.

### `PATCH /api/reminders/{id}`

Any subset of `title`, `category`, `notes`, `remindAt`, `repeat`, `active` (at least one). Use `{ "active": false }` to pause or mark done, `{ "active": true }` to resume. `200` → `{ "reminder": Reminder }`. `404` if the id is unknown or not a UUID.

### `DELETE /api/reminders/{id}`

`204` with no body. `404` if the id is unknown or not a UUID.

## 3b. Prescription abbreviation explainer

### `POST /api/prescriptions/explain`

Deterministic (no AI call). The text is not stored or logged. Schemas: `src/lib/validations/prescription.ts`. Source and rules: `docs/AI_SAFETY_SPEC.md` §9.3.

Request: `{ "text": "Ibuprofen 200mg tds prn" }` (1–2000 chars, trimmed; unknown fields rejected).

`200` response:

```json
{
  "terms": [
    { "abbreviation": "t.d.s.", "latin": "ter die sumendum", "meaning": "to be taken three times daily", "matchedText": "tds", "caution": null },
    { "abbreviation": "p.r.n.", "latin": "pro re nata", "meaning": "when required", "matchedText": "prn", "caution": null }
  ],
  "guidance": "This only explains common prescription abbreviations. It does not check your medicine, dose or timing. Follow the label and the instructions from your pharmacist or prescriber, and ask them if anything is unclear.",
  "source": { "title": "General prescribing guidance", "publisher": "Patient.info", "url": "https://patient.info/doctor/general-prescribing-guidance" }
}
```

- Recognised: `stat`, `p.r.n.`, `o.d.`, `o.n.`, `b.d.`, `t.d.s.`, `q.d.s.` (dotted or not, any case; `o.n.` only with dots). Order = first appearance; each listed once.
- `terms` may be empty: the UI must say no common abbreviations were recognised and still show `guidance`.
- `caution` is non-null for `o.d.` (may mean right eye on eye prescriptions) and must be shown next to that term.
- `guidance` and `source` must always be shown.

## 3c. Past assistant conversations

### `GET /api/assistant/sessions?limit=5`

Read-only. The demo profile's **completed** assistant conversations, newest first (by `completedAt`). In-progress conversations (still at a follow-up question) are not returned. Schemas: `src/lib/validations/assessment-history.ts` (`assessmentHistoryResponseSchema`, type `PastAssessment`). `limit` is an integer 1–20 (default 5); any other query key → 400.

`200` response:

```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "startedAt": "2026-11-14T09:00:00.000Z",
      "completedAt": "2026-11-14T09:02:30.000Z",
      "initialConcern": "My lower back has been sore since yesterday",
      "urgencyLevel": "routine",
      "assessment": { "summary": "…", "possibleExplanations": [], "nextSteps": [], "sources": [], "disclaimer": "…" }
    },
    {
      "sessionId": "uuid",
      "startedAt": "…",
      "completedAt": "…",
      "initialConcern": "Back pain with numbness in both legs",
      "urgencyLevel": "urgent",
      "assessment": null
    }
  ]
}
```

- `assessment` has the same shape as in §3 and is exactly what the user was shown then.
- `urgencyLevel: "prompt"` means the conversation matched an NHS urgent-GP / 111 item; the assessment is present and its first next step is the GP/111 advice. Show it as "Urgent GP / NHS 111 advice was given".
- `urgencyLevel: "urgent"` with `assessment: null` means the warning-sign rules fired and the user was told to seek urgent care. Show it as "Urgent-care guidance was given" — never as a diagnosis or a result.
- `assessment` can also be `null` for a routine conversation if the stored data no longer matches the contract; show "Summary not available".
- `sessions` may be empty: show an empty state ("No completed assistant conversations yet").
- Anything shown from an assessment must keep its `disclaimer`; label `initialConcern` as what the user reported, not a recorded fact.

## 4. Status and error behavior

- `400`: malformed or invalid request.
- `404`: requested session/profile/log/reminder does not exist.
- `429` (`RATE_LIMITED`): `POST /api/assistant/chat` only, when a turn would call the AI model and the limit is reached (6 turns per minute per client address, 20 per minute per server instance; best-effort, in memory). Includes a `Retry-After` header (seconds) and a message saying how long to wait. Nothing is saved. Urgent safety replies are never rate-limited. The UI should show the message and offer Retry.
- `500`: generic unexpected server error; no internal details to client.
- `503`: configured AI provider unavailable or timed out; return a safe fallback message.

The frontend must handle loading, empty, error and retry states.

## 5. Shared types

Create shared TypeScript types/schemas in one location (for example `src/lib/validations/` and `src/types/`). Infer TypeScript types from Zod schemas where practical. Do not hand-maintain duplicate, slightly different request/response definitions in frontend and backend.
