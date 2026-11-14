import type { NextRequest } from "next/server";

import { internalError, validationError } from "@/app/api/_lib/responses";
import { PAST_ASSESSMENT_COLUMNS, rowToPastAssessment } from "@/lib/supabase/mappers";
import { supabaseRest } from "@/lib/supabase/server";
import {
  DEMO_PROFILE_ID,
  assessmentHistoryQuerySchema,
  assessmentHistoryResponseSchema,
} from "@/lib/validations";

/**
 * GET /api/assistant/sessions?limit=5 — the demo profile's completed assistant
 * conversations, newest first. Read-only; in-progress conversations are omitted.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const query = assessmentHistoryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return validationError(query.error);

  try {
    const rows = await supabaseRest(
      `symptom_sessions?select=${PAST_ASSESSMENT_COLUMNS}` +
        `&profile_id=eq.${DEMO_PROFILE_ID}&status=eq.completed` +
        `&order=updated_at.desc,id.desc&limit=${query.data.limit}`,
    );
    if (!Array.isArray(rows)) throw new Error("Unexpected symptom_sessions response shape");
    return Response.json(assessmentHistoryResponseSchema.parse({ sessions: rows.map(rowToPastAssessment) }));
  } catch (error) {
    return internalError(error, "GET /api/assistant/sessions");
  }
}
