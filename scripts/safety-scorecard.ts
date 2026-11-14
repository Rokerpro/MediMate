// Safety scorecard: runs MediMate's fixed safety examples through the real
// pipeline code and prints pass counts. Offline: no AI provider, no database,
// no network. Every message is synthetic.
//
//   npm run scorecard            # text report, exit code 1 if anything fails
//   npm run scorecard -- --json  # machine-readable result
//
// The model is replaced by a scripted stand-in, so these numbers describe the
// server's deterministic checks, not the behaviour of any particular model.
import { fileURLToPath } from "node:url";

import { runAssistantTurn } from "../src/lib/ai/assistant.ts";
import type { LlmProvider } from "../src/lib/ai/types.ts";
import { SAFETY_RULES, evaluateSafety } from "../src/lib/health/safety-rules.ts";
import type { Profile } from "../src/lib/validations/profile.ts";
import {
  ORDINARY_MESSAGES,
  RULE_CASES,
  SAFE_OUTPUTS,
  UNSAFE_FOLLOW_UPS,
  UNSAFE_OUTPUTS,
  type OutputCase,
} from "../tests/fixtures/safety-cases.ts";

export type ScoreLine = { label: string; passed: number; total: number; failures: string[] };
export type Scorecard = { lines: ScoreLine[]; allPassed: boolean };

const PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Scorecard Demo",
  age: 30,
  gender: null,
  heightCm: null,
  weightKg: null,
  conditions: [],
  allergies: [],
  medications: [],
  medicalHistory: "Synthetic scorecard profile.",
};

/** Stand-in model that always returns the same text and counts its calls. */
function scriptedProvider(reply: string): LlmProvider & { calls: number } {
  return {
    name: "scorecard",
    calls: 0,
    complete() {
      this.calls += 1;
      return Promise.resolve(reply);
    },
  };
}

function modelReply({ field, text }: OutputCase): string {
  return JSON.stringify({
    status: "assessment",
    assistantMessage: "Thanks for the details.",
    followUpQuestions: [],
    assessment: {
      summary: field === "summary" ? text : "You reported a dull ache that has lasted a few days.",
      possibleExplanations: [
        {
          title: "Discomfort to discuss with a clinician",
          whyItMayBeRelevant: field === "why" ? text : "You described it as recurring.",
          supportingLogIds: [],
          unknowns: ["How long each episode lasts"],
        },
      ],
      nextSteps: [field === "nextStep" ? text : "Speak to a GP if it does not improve."],
    },
  });
}

/** Runs one final-round turn (the model must assess) and reports whether the reply reached the user. */
async function deliverModelReply(reply: string): Promise<boolean> {
  try {
    const turn = await runAssistantTurn(
      {
        message: "It is a dull ache, about 4 out of 10.",
        priorMessages: [
          { role: "user", content: "I have had an ache for a few days." },
          { role: "assistant", content: "How strong is it?" },
        ],
        profile: PROFILE,
        candidateLogs: [],
      },
      { provider: scriptedProvider(reply), evaluateSafety },
    );
    return turn.status === "assessment";
  } catch {
    return false; // AiUnavailableError: blocked after the repair attempt, user sees a safe 503 message
  }
}

function line(label: string, results: readonly { ok: boolean; name: string }[]): ScoreLine {
  return {
    label,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
    failures: results.filter((r) => !r.ok).map((r) => r.name),
  };
}

export async function runScorecard(): Promise<Scorecard> {
  const lines: ScoreLine[] = [];

  lines.push(
    line(
      "Safety rules with a cited NHS source and review date",
      SAFETY_RULES.map((rule) => ({
        name: rule.id,
        ok: /^https:\/\/www\.nhs\.uk\/conditions\//.test(rule.sourceUrl) && /^\d{4}-\d{2}-\d{2}$/.test(rule.reviewedOn),
      })),
    ),
  );

  // Urgent path through the real turn function, with a model that would say something unsafe if asked.
  const warningSigns = RULE_CASES.flatMap((c) => c.positive.map((text) => ({ ruleId: c.ruleId, text })));
  const urgentResults = await Promise.all(
    warningSigns.map(async ({ ruleId, text }) => {
      const provider = scriptedProvider(modelReply({ category: "", field: "summary", text: "Nothing to worry about." }));
      const turn = await runAssistantTurn(
        { message: text, priorMessages: [], profile: PROFILE, candidateLogs: [] },
        { provider, evaluateSafety },
      );
      const ok =
        turn.status === "urgent" &&
        turn.safetyRuleId === ruleId &&
        turn.assessment === null &&
        provider.calls === 0 &&
        /local emergency number/.test(turn.safety.message ?? "");
      return { ok, name: text };
    }),
  );
  lines.push(line("NHS warning signs escalated to urgent care (AI model never called)", urgentResults));

  const quiet = (texts: readonly string[]) =>
    texts.map((text) => ({ ok: !evaluateSafety([text]).result.triggered, name: text }));
  lines.push(line("Negated warning signs (\"no numbness\") with no false alarm", quiet(RULE_CASES.flatMap((c) => c.negative))));
  lines.push(line("Near-miss messages not on the NHS lists with no false alarm", quiet(RULE_CASES.flatMap((c) => c.ambiguous))));
  lines.push(line("Everyday messages with no false alarm", quiet(ORDINARY_MESSAGES)));

  const categories = [...new Set(UNSAFE_OUTPUTS.map((c) => c.category))];
  for (const category of categories) {
    const cases = UNSAFE_OUTPUTS.filter((c) => c.category === category);
    const results = await Promise.all(
      cases.map(async (c) => ({ ok: !(await deliverModelReply(modelReply(c))), name: c.text })),
    );
    lines.push(line(`Unsafe AI output blocked: ${category.toLowerCase()}`, results));
  }

  const followUpResults = await Promise.all(
    UNSAFE_FOLLOW_UPS.map(async (question) => {
      const reply = JSON.stringify({ status: "follow_up", assistantMessage: "Thanks.", followUpQuestions: [question], assessment: null });
      try {
        await runAssistantTurn(
          { message: "I have had a mild ache for two days.", priorMessages: [], profile: PROFILE, candidateLogs: [] },
          { provider: scriptedProvider(reply), evaluateSafety },
        );
        return { ok: false, name: question };
      } catch {
        return { ok: true, name: question };
      }
    }),
  );
  lines.push(line("Unsafe AI output blocked: dose follow-up question", followUpResults));

  const safeResults = await Promise.all(
    SAFE_OUTPUTS.map(async (c) => ({ ok: await deliverModelReply(modelReply(c)), name: c.text })),
  );
  lines.push(line("Careful AI wording still delivered (not over-blocked)", safeResults));

  return { lines, allPassed: lines.every((l) => l.passed === l.total) };
}

function printText({ lines, allPassed }: Scorecard): void {
  const width = Math.max(...lines.map((l) => l.label.length));
  console.log("MediMate safety scorecard (offline, synthetic examples)\n");
  for (const l of lines) {
    const mark = l.passed === l.total ? "PASS" : "FAIL";
    console.log(`${mark}  ${l.label.padEnd(width)}  ${l.passed}/${l.total}`);
    for (const failure of l.failures) console.log(`        failed: ${failure}`);
  }
  const passed = lines.reduce((n, l) => n + l.passed, 0);
  const total = lines.reduce((n, l) => n + l.total, 0);
  console.log(`\n${passed}/${total} checks passed${allPassed ? "" : " — see failures above"}.`);
  console.log(
    "Scope: fixed examples only. The rules use keyword matching and are not comprehensive emergency detection;\n" +
      "output checks are tested with a scripted stand-in for the AI model.",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scorecard = await runScorecard();
  if (process.argv.includes("--json")) console.log(JSON.stringify(scorecard, null, 2));
  else printText(scorecard);
  process.exitCode = scorecard.allPassed ? 0 : 1;
}
