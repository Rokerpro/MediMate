import "server-only";

// GitHub Models provider (OpenAI-compatible chat completions).
// Token: a GitHub fine-grained personal access token with the "Models: read"
// permission, stored server-side only in GITHUB_MODELS_TOKEN.
import { AiUnavailableError, type LlmProvider, type ModelRequest } from "./types";

const ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4.1-mini";
const REQUEST_TIMEOUT_MS = 25_000;

export function createGitHubModelsProvider(token: string, model: string = DEFAULT_MODEL): LlmProvider {
  return {
    name: "github",
    async complete({ system, user }: ModelRequest): Promise<string> {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.2,
            max_tokens: 1200,
            response_format: { type: "json_object" },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error";
        throw new AiUnavailableError(`github ${reason}`);
      }

      if (!response.ok) {
        // Never forward the provider's error body; keep only the status.
        throw new AiUnavailableError(`github HTTP ${response.status}`);
      }

      const body: unknown = await response.json().catch(() => null);
      const content =
        body && typeof body === "object" && "choices" in body && Array.isArray(body.choices)
          ? (body.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content
          : undefined;
      if (typeof content !== "string" || content.length === 0) {
        throw new AiUnavailableError("github response had no message content (check token and model)");
      }
      return content;
    },
  };
}
