import "server-only";

// Minimal server-only client for Supabase's REST API (PostgREST).
// Uses the platform `fetch` instead of @supabase/supabase-js: the P0 routes only
// need simple select/insert/update calls, so no extra dependency is required.
//
// Security model (CLAUDE.md §5, nextjs-supabase skill §2):
// - SUPABASE_URL / SUPABASE_ANON_KEY are server-only env vars (no NEXT_PUBLIC_ prefix).
// - Only the anon/publishable key is used as `apikey`. Every data call also sends
//   the signed-in user's access token, so Supabase verifies it and RLS limits
//   rows to that user's own profile (migration 0003).
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
  /** The signed-in user's Supabase access token (JWT). Required: no data call runs as anon. */
  accessToken: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
  { accessToken, method = "GET", body, returnRepresentation = false }: SupabaseRestOptions,
): Promise<unknown> {
  const { baseUrl, key } = readConfig();

  const headers: Record<string, string> = {
    apikey: key,
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (returnRepresentation) headers.Prefer = "return=representation";

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new SupabaseRequestError(response.status, await errorCode(response));

  // Writes without `returnRepresentation` come back with an empty body (201/204).
  const text = await response.text();
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
}

/** Reads only the short error code from a failed Supabase response; the body is never forwarded. */
async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const errorBody: unknown = await response.json();
    if (errorBody && typeof errorBody === "object") {
      for (const field of ["code", "error_code", "error"]) {
        const value = (errorBody as Record<string, unknown>)[field];
        if (typeof value === "string") return value.slice(0, 64);
      }
    }
  } catch {
    // Ignore unparsable error bodies.
  }
  return undefined;
}

/** The Supabase project URL, for building the Google authorize redirect. */
export function supabaseAuthUrl(path: string): string {
  return `${readConfig().baseUrl}/auth/v1/${path}`;
}

/**
 * Calls Supabase Auth (`/auth/v1/<path>`) with the anon key, and the user's
 * token when given (logout). Returns parsed JSON or null for an empty body.
 */
export async function supabaseAuth(
  path: string,
  { body, accessToken }: { body?: unknown; accessToken?: string } = {},
): Promise<unknown> {
  const { baseUrl, key } = readConfig();
  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new SupabaseRequestError(response.status, await errorCode(response));
  const text = await response.text();
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
}
