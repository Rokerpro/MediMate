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

## 0a. Sign-in and accounts (added 2026-11-15)

Every data endpoint below requires a signed-in user. Sign-in is "Continue with Google" through Supabase Auth (PKCE). Session tokens are kept in httpOnly cookies (`mm_access`, `mm_refresh`), so browser JavaScript never sees them; `fetch` sends them automatically to same-origin routes.

- The server takes the profile id from the session, never from the request. All data is the signed-in user's own (RLS: own profile only).
- Without a usable session, every data endpoint returns **401** `{"error":{"code":"UNAUTHENTICATED","message":"Please sign in to continue."}}` before any validation, database read, rate-limit slot or AI call. The client should send the user to `/login?next=<current path>` (the shared `api-client.ts` does this), except the assistant chat: `sendAssistantMessage` throws `ApiClientError` with `status: 401` and does not redirect, so the chat can show an inline "Sign in to chat" prompt.
- App pages (`/dashboard`, `/logs`, `/profile`, `/assistant`, `/reminders`, `/summary`, `/prescriptions`) redirect to `/login?next=…` when there are no session cookies (`src/proxy.ts`). `/`, `/login` and `/auth/*` are public.
- Only one configured demo Google account sees the synthetic demo profile ("Alex Demo"). Other accounts start with an empty profile (`displayName: "New user"`, `age: null`). Only the first 5 non-demo accounts can sign up.

| Route | Method | Purpose |
|---|---|---|
| `/auth/login?next=/logs` | GET (browser navigation) | Redirects to Google via Supabase. |
| `/auth/callback?code=…` | GET (browser navigation) | Finishes sign-in, sets cookies, redirects to `next` (default `/dashboard`). On failure → `/login?error=failed`; sign-ups full → `/login?error=closed`. |
| `/api/auth/me` | GET | `{ "user": { "email": "…", "displayName": "…", "avatarUrl": "https://lh3.googleusercontent.com/…" \| null } }` or `{ "user": null }` (200, never 401). `avatarUrl` is the Google profile photo (https on Google's photo host only, else null → show initials). Schema: `currentUserResponseSchema`. |
| `/api/auth/signout` | POST | Ends the session, clears cookies. 204. The client also clears saved assistant chats in `localStorage`. |
| `/api/auth/account` | DELETE | Permanently deletes the signed-in account: profile, logs, chats, reminders and the Google sign-in link (frees a sign-up place). The shared demo profile is only unlinked, never deleted. 204 and cookies cleared; 401 if signed out. Client: `deleteAccount()` clears saved chats and goes to `/?accountDeleted=1`. Needs migration `0005_delete_account.sql`. |

`/api/prescriptions/explain` stays public: it is deterministic, reads no user data and calls no AI.

## 1. Profile

### `GET /api/profile`

Returns the signed-in user's profile. `age` is `null` for a new account until the user enters it (PATCH still requires an integer 1–120 when `age` is sent).

```json
{
  "profile": {
    "id": "demo-profile-id",
    "displayName": "Alex",
    "age": 24,
    "gender": null,
    "location": null,
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

Accepts only editable profile fields. Return `{ "profile": { ... } }` using the same shape. Validate numeric ranges and string lengths. Gender is optional and must not be used to make unsupported inferences. `location` (added 2026-11-15, migration `0004`) is optional free text (town or country, max 100 characters; blank is stored as `null`). It is shown on the profile and summary only and is never sent to the AI.

**Onboarding:** while `displayName` is still `"New user"` or `age` is `null`, the app shell sends the user to `/welcome` (`src/components/onboarding-gate.tsx`). That page asks for full name and age (required) plus location and the other optional fields, then continues to the page they were heading to.

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

If an **urgent** safety rule triggers, return `status: "urgent"`, a non-null safety message and no ordinary LLM-generated reassurance. A **prompt-level** (NHS urgent GP / 111) rule does not stop the conversation; see `"prompt"` below. The exact urgency wording must come from the reviewed safety specification. Do not let an AI response override the deterministic safety result.

`safety.level` values:

- `"routine"`: no configured rule matched (`triggered: false`, `message: null`). This is **not** medical clearance; never show it as "safe".
- `"urgent"`: an NHS "Call 999 / A&E" item matched. Always `status: "urgent"`.
- `"prompt"`: an NHS "Ask for an urgent GP appointment or get help from NHS 111" item matched (`docs/AI_SAFETY_SPEC.md` §9.1a). `triggered: true`, `message` holds the fixed NHS wording, and `status` stays `"follow_up"` or `"assessment"`. The server has already added a GP/111 sentence to `assistantMessage` and, on an assessment, put the GP/111 step first in `nextSteps`. The UI should show `safety.message` in a prominent, non-red notice (amber), labelled e.g. "Contact a GP or NHS 111 today", alongside the normal reply. Once triggered, later turns in the session stay at least at `"prompt"`. Frontend notice: commit `950f4e8` (assistant page and popup, `role="status"`).

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

Read-only. The signed-in user's **completed** assistant conversations, newest first (by `completedAt`). In-progress conversations (still at a follow-up question) are not returned. Schemas: `src/lib/validations/assessment-history.ts` (`assessmentHistoryResponseSchema`, type `PastAssessment`). `limit` is an integer 1–20 (default 5); any other query key → 400.

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
- `urgencyLevel: "prompt"` means the conversation matched an NHS urgent-GP / 111 item; the assessment is present and its first next step is the GP/111 advice. Show it as "Urgent GP / NHS 111 advice was given" (amber, the same style as the §3 notice), never as a diagnosis.
- `urgencyLevel: "urgent"` with `assessment: null` means the warning-sign rules fired and the user was told to seek urgent care. Show it as "Urgent-care guidance was given" — never as a diagnosis or a result.
- `assessment` can also be `null` for a routine conversation if the stored data no longer matches the contract; show "Summary not available".
- `sessions` may be empty: show an empty state ("No completed assistant conversations yet").
- Anything shown from an assessment must keep its `disclaimer`; label `initialConcern` as what the user reported, not a recorded fact.

## 3d. Weekly AI summary (added 2026-11-15)

### `POST /api/insights/weekly`

Signed-in only. No request body (send `{}`). Generated on demand from the user's own logs of the last 7 days; nothing is stored, scheduled or emailed. Schema: `src/lib/validations/weekly-summary.ts` (`weeklySummaryResponseSchema`).

```json
{
  "status": "summary",
  "weekStart": "2026-11-08",
  "weekEnd": "2026-11-15",
  "logCount": 7,
  "safety": { "level": "routine", "triggered": false, "message": null },
  "assistantMessage": "Here is a brief summary of your week's health logs.",
  "assessment": { "summary": "…", "possibleExplanations": [], "nextSteps": ["…"], "sources": [], "disclaimer": "…" }
}
```

- `status: "no_data"`: no logs in the last 7 days. `logCount: 0`, `assessment: null`, and no AI call. Show `assistantMessage` with a prompt to add a log.
- `status: "urgent"`: a log this week matched an urgent warning rule. `assessment: null`, no AI call. Show `safety.message` prominently, the same way as an urgent chat reply.
- `status: "summary"`: same assessment shape and the same server checks as chat. `possibleExplanations` are patterns recorded together, with dated `supportingHistory`; they are associations, not causes. Sources are curated only, and the disclaimer is always present. When `safety.level` is `"prompt"`, show the GP / NHS 111 notice; the first next step is the fixed GP/111 step.
- Errors: 401, 404 (no profile), 429 with `Retry-After` (shares the assistant limit), 503, 500.

UI: the "This week's summary" card on `/dashboard` (`src/components/weekly-summary.tsx`).

## 4. Status and error behavior

- `400`: malformed or invalid request.
- `401` (`UNAUTHENTICATED`): not signed in or the session expired; see §0a.
- `404`: requested session/profile/log/reminder does not exist.
- `429` (`RATE_LIMITED`): `POST /api/assistant/chat` only, when a turn would call the AI model and the limit is reached (6 turns per minute per client address, 20 per minute per server instance; best-effort, in memory). Includes a `Retry-After` header (seconds) and a message saying how long to wait. Nothing is saved. Urgent safety replies are never rate-limited. The UI should show the message and offer Retry.
- `500`: generic unexpected server error; no internal details to client.
- `503`: configured AI provider unavailable or timed out; return a safe fallback message.

The frontend must handle loading, empty, error and retry states.

## 5. Shared types

Create shared TypeScript types/schemas in one location (for example `src/lib/validations/` and `src/types/`). Infer TypeScript types from Zod schemas where practical. Do not hand-maintain duplicate, slightly different request/response definitions in frontend and backend.
