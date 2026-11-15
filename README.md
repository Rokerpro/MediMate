# MediMate

Vertias Ai hackathon project.

MediMate is a history-aware health-information assistant. Before it answers a health concern, it looks at the user's own health log, then explains what may be worth discussing with a clinician, which past records it used, and where its background information comes from.

> **MediMate is not a doctor and does not diagnose.** It is a hackathon prototype that gives educational information only. The demo uses a **synthetic patient**: do not enter real health information.

Live demo: https://medi-mate-mauve.vercel.app

**Signing in:** use **Continue with Google**. Only one configured demo Google account sees the synthetic patient "Alex Demo" (14 days of logs). Any other account starts with an empty profile and a short welcome form. Sign-ups are capped at the first 5 accounts, so new sign-ins may be closed when you visit; the demo video shows the full flow.

## What it does

- **Google sign-in and private accounts:** each account sees only its own data (enforced by Supabase row-level security). New accounts get a welcome form (name, age, optional location), and can be deleted from the Profile page together with all their data.
- **Health profile:** view and edit a synthetic profile (age, height, weight, conditions, allergies, medications).
- **Daily health log:** record symptoms, pain, sleep, water, activity and mood, and review them on a timeline.
- **Assistant conversation:** describe a concern; the assistant asks a few follow-up questions when information is missing, then gives an educational assessment.
- **Uses your history:** the assessment shows which dated log entries it used, keeps them separate from medical-reference information, and says plainly when no related history was found.
- **Weekly AI summary:** on demand from the dashboard, a summary of the last 7 days of logs with patterns written as associations (never causes), using the same safety checks and output validation as the chat.
- **Voice input:** dictate a message with the browser's built-in speech recognition (Chrome, Edge and Safari; not Firefox or Brave). In Chrome the audio is processed by Google's speech service.
- **Reminders, summary and prescription explainer:** user-written in-app reminders, a printable summary for a clinician, and plain-language meanings of common prescription abbreviations (no dose advice).
- **Safety first:** warning signs from NHS emergency lists are checked by fixed rules *before* the AI is called. If one matches, the user gets urgent care guidance and the AI is not used. Signs the NHS lists under "ask for an urgent GP appointment or call 111" add that advice to the reply, which the AI cannot override.

## How an answer is produced

1. **Safety rules** (`src/lib/health/safety-rules.ts`) check the conversation against the NHS "Call 999" lists for back pain, headaches and chest pain. A match returns urgent guidance immediately. A match on the NHS "urgent GP / 111" lists lets the AI answer but always adds that advice.
2. **History retrieval** (`src/lib/health/retrieve-history.ts`) selects up to 5 past logs with related symptoms from the last 30 days, plus the last 7 days of sleep, water, activity and mood.
3. **References** (`src/lib/health/references.ts`) add short verbatim excerpts from checked NHS pages when the topic matches.
4. **The AI model** gets these as separate, labelled sections and must reply with structured JSON.
5. **Output checks** (`src/lib/ai/output.ts`) validate the reply and reject diagnosis-style wording, percentages, medication or dose advice, invented links and self-care that is not in the references. The model gets one retry; otherwise the user sees a clear "assistant unavailable" message.
6. The server attaches the dated history, the sources (only from the checked set) and a fixed disclaimer.

The full rules and their sources are in [`docs/AI_SAFETY_SPEC.md`](docs/AI_SAFETY_SPEC.md).

## Tech stack

Next.js (App Router) + TypeScript, Tailwind CSS, Zod, Supabase PostgreSQL and Supabase Auth with Google (both over their REST APIs, PKCE sign-in, session in httpOnly cookies), Groq (OpenAI-compatible API) for the language model, deployed on Vercel. There is no separate backend service and no vector database.

## Run it locally

Requires Node.js 22.18 or newer.

```bash
npm ci
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Environment variables (server-side only; never prefix them with `NEXT_PUBLIC_`):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key. Requests use the signed-in user's token, so row-level security limits each user to their own profile; the anon key alone reads nothing. |
| `AI_PROVIDER` | `groq`, `gemini` or `mock` (offline replies marked "[Mock]", no key needed) |
| `GROQ_API_KEY` | Groq API key, when `AI_PROVIDER=groq` |
| `GROQ_MODEL` | Optional model override |

Database: in the Supabase SQL editor, run `supabase/migrations/0001_initial_schema.sql`, `supabase/seed.sql`, then migrations `0002` to `0005` in order. The seed creates the synthetic profile "Alex Demo" and 14 days of logs (recurring lower-back discomfort after long sitting, variable sleep).

Sign-in setup:

1. Create a Google OAuth client (Web) with the redirect URI `https://<your-project>.supabase.co/auth/v1/callback`, and enable the Google provider in Supabase Auth with its client ID and secret.
2. In Supabase Auth → URL configuration, set the Site URL and allow `<your-site>/auth/callback` (and `http://localhost:3000/auth/callback` for local use).
3. Choose the Google account that should see the demo data and store it in the private settings table (never commit it):
   `insert into medimate_settings values ('demo_owner_email', 'demo-account@example.com');`

Before a demo, run `supabase/reset-demo.sql` to restore the synthetic data (logs re-dated to today) and delete all chat sessions. It is destructive for the demo profile but keeps its link to the demo account.

## Checks

```bash
npm run lint
npm run typecheck
npm test           # 288 tests: safety rules, retrieval, prompts, output checks, auth, weekly summary
npm run scorecard  # offline safety scorecard: 256/256 fixed warning-sign, false-alarm and unsafe-output checks
npm run build
```

## Demo script (3–5 minutes)

Before the demo: run `supabase/reset-demo.sql` in the Supabase SQL editor.

1. **Landing page (`/`) → Continue with Google** (demo account) **→ Dashboard → Daily logs:** introduce Alex (synthetic) and the timeline of back discomfort and sleep.
2. **Assistant:** "My lower back has been hurting since yesterday." The assistant asks follow-up questions.
3. Answer: "It started after sitting at my desk most of the day. About 4 out of 10, a dull ache that gets better when I walk around. No numbness."
4. Show the assessment: dated history entries, unknowns, next steps, the NHS source and the disclaimer.
5. **Start over**, then: "My lower back hurts and I have numbness in both legs." The urgent NHS guidance appears without calling the AI.
6. **Dashboard → This week's summary:** generate the weekly AI summary of the logs.
7. **Summary:** the printable patient-provided summary with pain and sleep charts ("Download / print PDF").
8. Optional: **Reminders** (user-written, confirm before saving) and **Prescriptions** ("Eye drops 1 drop OD, ibuprofen 200mg tds prn" → plain meanings, the eye caution and the Patient.info source).

If the AI provider is down or rate-limited during judging, the safety, history, summary, reminders and prescription features still work; the assistant shows a clear "temporarily unavailable" message with Retry.

## Limitations

- Safety rules use keyword matching with simple negation handling. They can miss unusual wording and are **not** comprehensive emergency detection. When no rule matches, that is not a sign that the user is safe.
- Only three topics (back pain, headaches, chest pain) have checked references and warning rules.
- History retrieval is keyword-based, not semantic.
- Sign-up is capped at 5 accounts for the demo, and only one configured account sees the synthetic data.
- Voice input depends on the browser's speech service and does not work in Firefox or Brave.
- The assistant is rate-limited (6 turns per minute per address, best-effort in memory) to protect the free-tier AI quota; urgent safety replies are never limited.

## Documentation

[`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) · [`docs/AI_SAFETY_SPEC.md`](docs/AI_SAFETY_SPEC.md) · [`docs/DEMO_TEST_PLAN.md`](docs/DEMO_TEST_PLAN.md) · [`docs/WORKFLOW.md`](docs/WORKFLOW.md)

## License

See [LICENSE](LICENSE).
