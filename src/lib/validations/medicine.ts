import { z } from "zod";
import { safetyResultSchema, sourceSchema } from "./assistant.ts";

/** POST /api/prescriptions/medicine body. A medicine name or a short description. Not stored. */
export const medicineExplainRequestSchema = z.strictObject({
  query: z.string().trim().min(2).max(200),
});

/** General, educational information about a medicine. Never doses, timing or start/stop advice. */
export const medicineExplanationSchema = z.strictObject({
  /** The medicine as the model understood it, e.g. "Ibuprofen". */
  name: z.string().min(1).max(120),
  /** Other common names, e.g. brand or generic names. */
  alsoKnownAs: z.array(z.string().min(1).max(80)).max(5),
  /** The kind of medicine, e.g. "Non-steroidal anti-inflammatory drug (NSAID)". */
  medicineType: z.string().min(1).max(160),
  /** One or two plain sentences on what it is generally used for. */
  whatItIsFor: z.string().min(1).max(600),
  /** Up to five common uses. */
  commonUses: z.array(z.string().min(1).max(160)).max(5),
  /** One or two plain sentences on how it works. */
  howItWorks: z.string().min(1).max(600),
  /** Up to four questions worth asking a pharmacist or prescriber. */
  questionsToAsk: z.array(z.string().min(1).max(200)).max(4),
});

export const medicineExplainResponseSchema = z
  .strictObject({
    /** "explained", "not_recognised" (not a medicine the model could identify), or "urgent" (a warning sign in the text). */
    status: z.enum(["explained", "not_recognised", "urgent"]),
    safety: safetyResultSchema,
    explanation: medicineExplanationSchema.nullable(),
    /** Fixed server text; always shown. */
    guidance: z.string().min(1),
    /** Fixed server text; always shown. */
    disclaimer: z.string().min(1),
    /** Where to read the official patient information; always shown. */
    source: sourceSchema,
  })
  .superRefine((value, ctx) => {
    if ((value.status === "explained") !== (value.explanation !== null)) {
      ctx.addIssue({ code: "custom", message: "explanation is required exactly when status is explained" });
    }
    if (value.status === "urgent" && !value.safety.triggered) {
      ctx.addIssue({ code: "custom", message: "urgent status needs a triggered safety result" });
    }
  });

export type MedicineExplainRequest = z.infer<typeof medicineExplainRequestSchema>;
export type MedicineExplanation = z.infer<typeof medicineExplanationSchema>;
export type MedicineExplainResponse = z.infer<typeof medicineExplainResponseSchema>;
