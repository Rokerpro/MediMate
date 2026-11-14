import { internalError, readJsonBody, validationError } from "@/app/api/_lib/responses";
import { explainPrescription } from "@/lib/health/prescription-terms";
import { prescriptionExplainRequestSchema, prescriptionExplainResponseSchema } from "@/lib/validations";

/**
 * POST /api/prescriptions/explain — expands common prescription abbreviations
 * from the approved source. Deterministic: no AI call, nothing stored or logged.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = prescriptionExplainRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return Response.json(prescriptionExplainResponseSchema.parse(explainPrescription(parsed.data.text)));
  } catch (error) {
    return internalError(error, "POST /api/prescriptions/explain");
  }
}
