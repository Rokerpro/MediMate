# MediMate — Architecture and Repository Structure

## 1. Architecture principles

- One Next.js application; no separate FastAPI service for this 32-hour build.
- Server-side Route Handlers own Supabase and LLM calls.
- Supabase PostgreSQL stores the synthetic profile, logs and chat sessions.
- Retrieval is ordinary, bounded SQL filtering for the demo; no vector database by default.
- Medical references are curated separately from personal health records.
- Deterministic safety checks run before normal LLM assessment.
- LLM output is structured and validated before it reaches the UI.

## 2. Suggested repository structure

Adapt to the existing repository instead of blindly creating duplicate folders.

```text
medimate/
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── .github/
│   └── copilot-instructions.md
├── docs/
│   ├── PROJECT_PLAN.md
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACTS.md
│   ├── AI_SAFETY_SPEC.md
│   ├── WORKFLOW.md
│   └── DEMO_TEST_PLAN.md
├── public/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── logs/page.tsx
│   │   │   └── assistant/page.tsx
│   │   ├── api/
│   │   │   ├── profile/route.ts
│   │   │   ├── health-logs/route.ts
│   │   │   └── assistant/chat/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── dashboard/
│   │   ├── profile/
│   │   ├── logs/
│   │   ├── assistant/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── ai/
│   │   │   ├── client.ts
│   │   │   ├── prompts.ts
│   │   │   └── schemas.ts
│   │   ├── health/
│   │   │   ├── retrieve-history.ts
│   │   │   ├── safety-rules.ts
│   │   │   └── references.ts
│   │   └── validations/
│   └── types/
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── package.json
```

Keep the app route structure consistent with the Next.js version already installed. Use Server Components by default; add Client Components only for interactive UI.

## 3. Runtime flow

```text
Browser
  ├── Profile / Daily Log UI
  │      └── Next.js Route Handler
  │              └── Supabase PostgreSQL
  │
  └── Symptom Chat UI
         └── POST /api/assistant/chat
                1. Validate request
                2. Load profile and relevant health logs
                3. Run deterministic safety checks
                4. If urgent rule matches, return safety response
                5. Retrieve relevant curated medical references
                6. Call the LLM with bounded context
                7. Validate structured model output
                8. Persist session/message/assessment
                9. Return typed response
```

## 4. Data model

Keep the first version minimal.

### `profiles`

- `id` UUID primary key.
- `display_name` text.
- `age` smallint.
- `gender` text nullable.
- `height_cm` numeric nullable.
- `weight_kg` numeric nullable.
- `conditions` text array or JSONB.
- `allergies` text array or JSONB.
- `medications` JSONB or text array.
- `medical_history` text nullable.
- `created_at`, `updated_at` timestamps.

### `health_logs`

- `id` UUID primary key.
- `profile_id` UUID foreign key.
- `logged_at` timestamptz.
- `symptoms` text.
- `pain_location` text nullable.
- `pain_level` smallint nullable, constrained to 0–10.
- `sleep_duration_minutes` integer nullable.
- `sleep_quality` smallint nullable, constrained to 1–5.
- `mood` text nullable.
- `water_ml` integer nullable.
- `activity_minutes` integer nullable.
- `notes` text nullable.
- `created_at` timestamp.

### `symptom_sessions`

- `id` UUID primary key.
- `profile_id` UUID foreign key.
- `created_at`, `updated_at` timestamps.
- `status` text (e.g. `in_progress`, `completed`).
- `initial_symptom` text.
- `assessment` JSONB nullable.
- `urgency_level` text nullable.

### `symptom_messages` (recommended if time allows)

- `id` UUID primary key.
- `session_id` UUID foreign key.
- `role` text constrained to `user` or `assistant`.
- `content` text.
- `created_at` timestamp.

Do not store unnecessary copies of full profile data in every message. Retrieve current relevant context when processing each turn.

## 5. Security and demo data

- This hackathon build uses synthetic data only. Display a visible demo notice.
- Never use real patient data in seed files, logs, screenshots or the public presentation.
- Keep the LLM provider key server-side.
- **Sign-in (since 2026-11-15, migration `0003_user_accounts.sql`):** "Continue with Google" through Supabase Auth, using the PKCE flow over Supabase's REST API (no extra dependency). Tokens live in httpOnly, SameSite=Lax cookies set by `/auth/callback`. `src/lib/supabase/auth.ts#getRequestContext` reads them, refreshes the access token when it is near expiry, and looks up the user's own profile id.
- Every data call sends the anon key as `apikey` **and the user's access token** as `Authorization`. Supabase verifies the token and RLS limits every table to the caller's own profile (`is_medimate_demo_profile(id)` now means "profile.user_id = auth.uid()"). Signed-out requests (anon role) can read nothing.
- `claim_medimate_profile()` (security definer) is the only way to create a profile. It links the synthetic demo profile to the one demo Google account named in the private `medimate_settings` table (set in the SQL editor; never committed), and otherwise creates an empty profile for the first 5 accounts, then refuses (`MMCAP`).
- `src/proxy.ts` redirects signed-out visitors on app pages to `/login`; it only checks that cookies exist. The API (401) and RLS are the real checks.
- Data is still synthetic only. Logged-in users must not enter real health information; the demo notice stays.
- Do not use the Supabase service-role key in unauthenticated public request paths. Do not add unrestricted RLS policies.
- Do not describe this prototype as suitable for storing real medical records.
