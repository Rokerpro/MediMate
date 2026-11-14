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

## 4. Status and error behavior

- `400`: malformed or invalid request.
- `404`: requested session/profile/log does not exist.
- `429`: rate limit exceeded, if implemented.
- `500`: generic unexpected server error; no internal details to client.
- `503`: configured AI provider unavailable or timed out; return a safe fallback message.

The frontend must handle loading, empty, error and retry states.

## 5. Shared types

Create shared TypeScript types/schemas in one location (for example `src/lib/validations/` and `src/types/`). Infer TypeScript types from Zod schemas where practical. Do not hand-maintain duplicate, slightly different request/response definitions in frontend and backend.
