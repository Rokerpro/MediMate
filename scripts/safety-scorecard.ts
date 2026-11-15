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
import { runWeeklySummary } from "../src/lib/ai/weekly-summary.ts";
import type { LlmProvider } from "../src/lib/ai/types.ts";
import { PROMPT_NEXT_STEP, PROMPT_RULES, SAFETY_RULES, evaluateSafety } from "../src/lib/health/safety-rules.ts";
import type { HealthLog } from "../src/lib/validations/health-log.ts";
import type { Profile } from "../src/lib/validations/profile.ts";
import {
  ORDINARY_MESSAGES,
  PROMPT_RULE_CASES,
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
  location: null,
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
/** Fixed clock and synthetic logs for scripted replies, so dated wording can be checked against real records. */
const REPLY_NOW = Date.parse("2026-11-15T12:00:00Z");
const replyLog = (day: string, waterMl: number, activityMinutes: number): HealthLog => ({
  id: `00000000-0000-4000-8000-0000000011${day}`,
  loggedAt: `2026-11-${day}T09:00:00+00:00`,
  symptoms: "No specific symptom reported",
  painLevel: null,
  painLocation: null,
  sleepDurationMinutes: 420,
  sleepQuality: 3,
  waterMl,
  activityMinutes,
  mood: "okay",
  notes: null,
});
const REPLY_LOGS: HealthLog[] = [replyLog("12", 1800, 15), replyLog("13", 1500, 15), replyLog("14", 1400, 30)];

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
        candidateLogs: REPLY_LOGS,
        now: REPLY_NOW,
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
      [...SAFETY_RULES, ...PROMPT_RULES].map((rule) => ({
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

  // Urgent-GP / 111 path: the model still answers, and the server adds the fixed GP/111 advice.
  const promptSigns = PROMPT_RULE_CASES.flatMap((c) => c.positive.map((text) => ({ ruleId: c.ruleId, text })));
  const promptResults = await Promise.all(
    promptSigns.map(async ({ ruleId, text }) => {
      const turn = await runAssistantTurn(
        {
          message: "It is about 5 out of 10.",
          priorMessages: [
            { role: "user", content: text },
            { role: "assistant", content: "How strong is it?" },
          ],
          profile: PROFILE,
          candidateLogs: [],
        },
        { provider: scriptedProvider(modelReply({ category: "", field: "summary", text: "You reported discomfort." })), evaluateSafety },
      );
      const ok =
        turn.status === "assessment" &&
        turn.safety.level === "prompt" &&
        turn.safetyRuleId === ruleId &&
        turn.assessment?.nextSteps[0] === PROMPT_NEXT_STEP &&
        /NHS 111/.test(turn.assistantMessage);
      return { ok, name: text };
    }),
  );
  lines.push(line("NHS urgent-GP / 111 signs flagged, GP/111 advice added by the server", promptResults));

  const quiet = (texts: readonly string[]) =>
    texts.map((text) => ({ ok: !evaluateSafety([text]).result.triggered, name: text }));
  const allCases = [...RULE_CASES, ...PROMPT_RULE_CASES];
  lines.push(line("Negated warning signs (\"no numbness\") with no false alarm", quiet(allCases.flatMap((c) => c.negative))));
  lines.push(line("Near-miss messages not on the NHS lists with no false alarm", quiet(allCases.flatMap((c) => c.ambiguous))));
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

  // Weekly summary reuses the same checks: every unsafe reply is blocked, and an urgent log skips the model.
  const weekLog = (symptoms: string, notes: string | null = null): HealthLog => ({
    id: "cccccccc-0000-4000-8000-000000000001",
    loggedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    symptoms,
    painLocation: null,
    painLevel: null,
    sleepDurationMinutes: null,
    sleepQuality: null,
    mood: null,
    waterMl: null,
    activityMinutes: null,
    notes,
  });
  const weeklyBlocked = await Promise.all(
    UNSAFE_OUTPUTS.map(async (c) => {
      try {
        const result = await runWeeklySummary(
          { logs: [weekLog("Mild lower back discomfort")], profile: PROFILE },
          { provider: scriptedProvider(modelReply(c)), evaluateSafety },
        );
        return { ok: result.status !== "summary", name: c.text };
      } catch {
        return { ok: true, name: c.text };
      }
    }),
  );
  lines.push(line("Weekly summary: unsafe AI output blocked", weeklyBlocked));
  const weeklyUrgent = await Promise.all(
    RULE_CASES.flatMap((c) => c.positive).map(async (text) => {
      const provider = scriptedProvider(modelReply({ category: "", field: "summary", text: "You reported discomfort." }));
      const result = await runWeeklySummary(
        { logs: [weekLog("Logged symptom", text)], profile: PROFILE },
        { provider, evaluateSafety },
      );
      return { ok: result.status === "urgent" && result.assessment === null && provider.calls === 0, name: text };
    }),
  );
  lines.push(line("Weekly summary: warning sign in a log escalated (AI model never called)", weeklyUrgent));

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
