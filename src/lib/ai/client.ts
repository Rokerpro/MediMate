import "server-only";

// Selects the LLM provider from server-only env vars at request time.
//   AI_PROVIDER=github  -> GitHub Models (needs GITHUB_MODELS_TOKEN; optional GITHUB_MODELS_MODEL)
//   AI_PROVIDER=mock    -> deterministic offline provider, output marked "[Mock]"
// Anything else (or missing config) throws AiUnavailableError -> 503.
import { createGitHubModelsProvider } from "./github-models";
import { mockProvider } from "./mock-provider";
import { AiUnavailableError, type LlmProvider } from "./types";

export function getLlmProvider(): LlmProvider {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (provider === "mock") return mockProvider;

  if (provider === "github") {
    const token = process.env.GITHUB_MODELS_TOKEN?.trim();
    if (!token) throw new AiUnavailableError("GITHUB_MODELS_TOKEN missing");
    const model = process.env.GITHUB_MODELS_MODEL?.trim() || undefined;
    return createGitHubModelsProvider(token, model);
  }

  throw new AiUnavailableError("AI_PROVIDER not configured");
}
