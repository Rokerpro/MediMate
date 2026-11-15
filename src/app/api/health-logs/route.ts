import type { NextRequest } from "next/server";

import { authenticate } from "@/app/api/_lib/auth";
import { internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import {
  HEALTH_LOG_COLUMNS,
  firstRow,
  healthLogCreateToRow,
  rowToHealthLog,
} from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import {
  healthLogCreateResponseSchema,
  healthLogCreateSchema,
  healthLogListQuerySchema,
  healthLogListResponseSchema,
} from "@/lib/validations";

/** GET /api/health-logs?limit=30 — the signed-in user's logs, newest first. */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticate("GET /api/health-logs");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  const query = healthLogListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) return validationError(query.error);

  try {
    const rows = await supabaseRest(
      `health_logs?select=${HEALTH_LOG_COLUMNS}` +
        `&profile_id=eq.${profileId}` +
        `&order=logged_at.desc,created_at.desc` +
        `&limit=${query.data.limit}`,
      { accessToken },
    );
    if (!Array.isArray(rows)) throw new Error("Unexpected health_logs response shape");
    return Response.json(healthLogListResponseSchema.parse({ logs: rows.map(rowToHealthLog) }));
  } catch (error) {
    return internalError(error, "GET /api/health-logs");
  }
}

/** POST /api/health-logs — create a log for the signed-in user. Returns 201. */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate("POST /api/health-logs");
  if (!auth.ok) return auth.response;
  const { profileId, accessToken } = auth.ctx;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = healthLogCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rows = await supabaseRest(`health_logs?select=${HEALTH_LOG_COLUMNS}`, {
      accessToken,
      method: "POST",
      body: healthLogCreateToRow(parsed.data, profileId),
      returnRepresentation: true,
    });
    const row = firstRow(rows);
    if (row === undefined) throw new Error("Insert returned no row");
    return Response.json(healthLogCreateResponseSchema.parse({ log: rowToHealthLog(row) }), {
      status: 201,
    });
  } catch (error) {
    return internalError(error, "POST /api/health-logs");
  }
}
