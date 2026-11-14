import "server-only";

// Selects the LLM provider from server-only env vars at request time.
//   AI_PROVIDER=groq    -> Groq (GROQ_API_KEY; optional GROQ_MODEL)
//   AI_PROVIDER=gemini  -> Gemini via its OpenAI-compatible API (GEMINI_API_KEY, GEMINI_MODEL)
//   AI_PROVIDER=mock    -> deterministic offline provider, output marked "[Mock]"
// Anything else (or missing config) throws AiUnavailableError -> 503.
import { mockProvider } from "./mock-provider";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import { AiUnavailableError, type LlmProvider } from "./types";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
// Separate per-model rate limits on Groq: fall back here on HTTP 429.
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AiUnavailableError(`${name} missing`);
  return value;
}

export function getLlmProvider(): LlmProvider {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  switch (provider) {
    case "mock":
      return mockProvider;

    case "groq": {
      const model = process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;
      return createOpenAiCompatibleProvider({
        name: "groq",
        baseUrl: GROQ_BASE_URL,
        apiKey: requireEnv("GROQ_API_KEY"),
        model,
        fallbackModels: model === GROQ_FALLBACK_MODEL ? [] : [GROQ_FALLBACK_MODEL],
        // Applied to gpt-oss models only: they reason first; keep it short for latency.
        extraBody: { reasoning_effort: "low" },
      });
    }

    case "gemini":
      return createOpenAiCompatibleProvider({
        name: "gemini",
        baseUrl: GEMINI_BASE_URL,
        apiKey: requireEnv("GEMINI_API_KEY"),
        model: requireEnv("GEMINI_MODEL"),
      });

    default:
      throw new AiUnavailableError("AI_PROVIDER not configured");
  }
}
