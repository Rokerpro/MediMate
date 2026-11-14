import "server-only";

// Provider for any OpenAI-compatible chat-completions API (Groq, Gemini's
// OpenAI layer, ...). The key stays server-side; provider error bodies are
// never forwarded to the client.
import { AiUnavailableError, type LlmProvider, type ModelRequest } from "./types";

const REQUEST_TIMEOUT_MS = 25_000;

export type OpenAiCompatibleConfig = {
  name: string;
  /** Base URL ending before `/chat/completions`, e.g. https://api.groq.com/openai/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Models to try, in order, when the previous one is rate-limited (HTTP 429). */
  fallbackModels?: readonly string[];
  /** Provider-specific body fields, e.g. { reasoning_effort: "low" }. */
  extraBody?: Record<string, unknown>;
};

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LlmProvider {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  async function call(model: string, system: string, user: string): Promise<Response> {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          // Enough for an assessment plus short reasoning. Kept low because free
          // tiers count reserved output tokens against tokens-per-minute limits.
          max_tokens: 1200,
          response_format: { type: "json_object" },
          ...(model.startsWith("openai/gpt-oss") ? config.extraBody : undefined),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error";
      throw new AiUnavailableError(`${config.name} ${reason}`);
    }
  }

  return {
    name: config.name,
    async complete({ system, user }: ModelRequest): Promise<string> {
      const models = [config.model, ...(config.fallbackModels ?? [])];
      let response: Response | undefined;
      for (const model of models) {
        response = await call(model, system, user);
        if (response.status !== 429) break;
      }
      if (!response || !response.ok) {
        // Keep only the status (e.g. 401 bad key, 429 rate limit).
        throw new AiUnavailableError(`${config.name} HTTP ${response?.status ?? "none"}`);
      }

      const body: unknown = await response.json().catch(() => null);
      const content =
        body && typeof body === "object" && "choices" in body && Array.isArray(body.choices)
          ? (body.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content
          : undefined;
      if (typeof content !== "string" || content.length === 0) {
        throw new AiUnavailableError(`${config.name} response had no message content`);
      }
      return content;
    },
  };
}
