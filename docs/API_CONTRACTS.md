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

## 4. Status and error behavior

- `400`: malformed or invalid request.
- `404`: requested session/profile/log/reminder does not exist.
- `429`: rate limit exceeded, if implemented.
- `500`: generic unexpected server error; no internal details to client.
- `503`: configured AI provider unavailable or timed out; return a safe fallback message.

The frontend must handle loading, empty, error and retry states.

## 5. Shared types

Create shared TypeScript types/schemas in one location (for example `src/lib/validations/` and `src/types/`). Infer TypeScript types from Zod schemas where practical. Do not hand-maintain duplicate, slightly different request/response definitions in frontend and backend.
