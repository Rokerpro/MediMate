import "server-only";

import { connection } from "next/server";

import { UnauthenticatedError, getRequestContext, type RequestContext } from "@/lib/supabase/auth";

import { apiError, internalError } from "./responses";

/**
 * Resolves the signed-in user for an API route. Call it first, before rate
 * limiting, database reads or any AI call. Returns a ready 401/500 response
 * when there is no usable session.
 */
export async function authenticate(
  context: string,
): Promise<{ ok: true; ctx: RequestContext } | { ok: false; response: Response }> {
  // Outside the try: during a build this signals "request-time only" and must not be caught.
  await connection();
  try {
    return { ok: true, ctx: await getRequestContext() };
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return { ok: false, response: apiError("UNAUTHENTICATED", "Please sign in to continue.") };
    }
    return { ok: false, response: internalError(error, `${context} (auth)`) };
  }
}
