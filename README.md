# MediMate

Vertias Ai hackathon project.

MediMate is a history-aware health-information assistant. Before it answers a health concern, it looks at the user's own health log, then explains what may be worth discussing with a clinician, which past records it used, and where its background information comes from.

> **MediMate is not a doctor and does not diagnose.** It is a hackathon prototype that gives educational information only. The demo uses a **synthetic patient**: do not enter real health information.

Live demo: https://medi-mate-mauve.vercel.app

## What it does

- **Health profile:** view and edit a synthetic profile (age, height, weight, conditions, allergies, medications).
- **Daily health log:** record symptoms, pain, sleep, water, activity and mood, and review them on a timeline.
- **Assistant conversation:** describe a concern; the assistant asks a few follow-up questions when information is missing, then gives an educational assessment.
- **Uses your history:** the assessment shows which dated log entries it used, keeps them separate from medical-reference information, and says plainly when no related history was found.
- **Safety first:** warning signs from NHS emergency lists are checked by fixed rules *before* the AI is called. If one matches, the user gets urgent care guidance and the AI is not used.

## How an answer is produced

1. **Safety rules** (`src/lib/health/safety-rules.ts`) check the conversation against the NHS "Call 999" lists for back pain, headaches and chest pain. A match returns urgent guidance immediately.
2. **History retrieval** (`src/lib/health/retrieve-history.ts`) selects up to 5 past logs with related symptoms from the last 30 days, plus the last 7 days of sleep, water, activity and mood.
3. **References** (`src/lib/health/references.ts`) add short verbatim excerpts from checked NHS pages when the topic matches.
4. **The AI model** gets these as separate, labelled sections and must reply with structured JSON.
5. **Output checks** (`src/lib/ai/output.ts`) validate the reply and reject diagnosis-style wording, percentages, medication or dose advice, invented links and self-care that is not in the references. The model gets one retry; otherwise the user sees a clear "assistant unavailable" message.
6. The server attaches the dated history, the sources (only from the checked set) and a fixed disclaimer.

The full rules and their sources are in [`docs/AI_SAFETY_SPEC.md`](docs/AI_SAFETY_SPEC.md).

## Tech stack

Next.js (App Router) + TypeScript, Tailwind CSS, Zod, Supabase PostgreSQL (accessed over its REST API), Groq (OpenAI-compatible API) for the language model, deployed on Vercel. There is no separate backend service and no vector database.

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
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key (works with the demo-only RLS policies) |
| `AI_PROVIDER` | `groq`, `gemini` or `mock` (offline replies marked "[Mock]", no key needed) |
| `GROQ_API_KEY` | Groq API key, when `AI_PROVIDER=groq` |
| `GROQ_MODEL` | Optional model override |

Database: run `supabase/migrations/0001_initial_schema.sql` and then `supabase/seed.sql` in the Supabase SQL editor. The seed creates the synthetic profile "Alex Demo" and 14 days of logs (recurring lower-back discomfort after long sitting, variable sleep).

## Checks

```bash
npm run lint
npm run typecheck
npm test        # rule, retrieval, prompt and output tests (node:test)
npm run build
```

## Demo script (3–5 minutes)

1. **Dashboard → Daily logs:** introduce Alex (synthetic) and the timeline of back discomfort and sleep.
2. **Assistant:** "My lower back has been hurting since yesterday." The assistant asks follow-up questions.
3. Answer: "It started after sitting at my desk most of the day. About 4 out of 10, a dull ache that gets better when I walk around. No numbness."
4. Show the assessment: dated history entries, unknowns, next steps, the NHS source and the disclaimer.
5. **Start over**, then: "My lower back hurts and I have numbness in both legs." The urgent NHS guidance appears without calling the AI.

## Limitations

- Safety rules use keyword matching with simple negation handling. They can miss unusual wording and are **not** comprehensive emergency detection. When no rule matches, that is not a sign that the user is safe.
- Only three topics (back pain, headaches, chest pain) have checked references and warning rules.
- History retrieval is keyword-based, not semantic.
- Single synthetic demo profile, no authentication.

## Documentation

[`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) · [`docs/AI_SAFETY_SPEC.md`](docs/AI_SAFETY_SPEC.md) · [`docs/DEMO_TEST_PLAN.md`](docs/DEMO_TEST_PLAN.md) · [`docs/WORKFLOW.md`](docs/WORKFLOW.md)

## License

See [LICENSE](LICENSE).
