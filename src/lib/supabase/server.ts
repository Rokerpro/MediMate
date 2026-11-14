import "server-only";

// Minimal server-only client for Supabase's REST API (PostgREST).
// Uses the platform `fetch` instead of @supabase/supabase-js: the P0 routes only
// need simple select/insert/update calls, so no extra dependency is required.
//
// Security model (CLAUDE.md §5, nextjs-supabase skill §2):
// - SUPABASE_URL / SUPABASE_ANON_KEY are server-only env vars (no NEXT_PUBLIC_ prefix).
// - Only the anon/publishable key is used; RLS restricts access to the demo profile.
// - Never use the service-role key here.

const REQUEST_TIMEOUT_MS = 8000;

/** Env vars are missing. Read at request time so the build never crashes. */
export class SupabaseConfigError extends Error {
  constructor() {
    super("Supabase is not configured.");
    this.name = "SupabaseConfigError";
  }
}

/** Supabase returned a non-2xx response. Holds only status and PostgREST code, never the body. */
export class SupabaseRequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super(`Supabase request failed (${status}${code ? ` ${code}` : ""}).`);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.code = code;
  }
}

type SupabaseRestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  /** Ask PostgREST to return the written rows (inserts/updates). */
  returnRepresentation?: boolean;
};

function readConfig(): { baseUrl: string; key: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new SupabaseConfigError();
  // Accept the project URL with or without a trailing "/rest/v1/".
  const baseUrl = url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  return { baseUrl, key };
}

/**
 * Calls `<SUPABASE_URL>/rest/v1/<path>` and returns the parsed JSON (unknown;
 * callers validate it). `path` must be built from trusted constants and
 * already-validated values only.
 */
export async function supabaseRest(
  path: string,
  { method = "GET", body, returnRepresentation = false }: SupabaseRestOptions = {},
): Promise<unknown> {
  const { baseUrl, key } = readConfig();

  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  // Legacy anon keys are JWTs and also go in Authorization. New publishable
  // keys (sb_publishable_...) are not JWTs and must only be sent as `apikey`.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (returnRepresentation) headers.Prefer = "return=representation";

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const errorBody: unknown = await response.json();
      if (errorBody && typeof errorBody === "object" && "code" in errorBody) {
        const value = (errorBody as { code: unknown }).code;
        if (typeof value === "string") code = value;
      }
    } catch {
      // Ignore unparsable error bodies; never forward them to the client.
    }
    throw new SupabaseRequestError(response.status, code);
  }

  // Writes without `returnRepresentation` come back with an empty body (201/204).
  const text = await response.text();
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
}
