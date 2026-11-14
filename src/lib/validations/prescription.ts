import { z } from "zod";
import { sourceSchema } from "./assistant.ts";

/** POST /api/prescriptions/explain body. The text is not stored or sent to an AI model. */
export const prescriptionExplainRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(2000),
});

export const prescriptionTermSchema = z.strictObject({
  /** Canonical form, e.g. "b.d." */
  abbreviation: z.string().min(1),
  /** Latin origin as given by the source, or null (e.g. "stat"). */
  latin: z.string().min(1).nullable(),
  /** Meaning quoted from the source. */
  meaning: z.string().min(1),
  /** Exactly how it appeared in the user's text (first occurrence). */
  matchedText: z.string().min(1),
  /** Caution when the abbreviation can mean something else; null otherwise. */
  caution: z.string().min(1).nullable(),
});

export const prescriptionExplainResponseSchema = z.strictObject({
  /** Recognised abbreviations in order of first appearance; empty if none. */
  terms: z.array(prescriptionTermSchema),
  /** Fixed guidance; always shown. */
  guidance: z.string().min(1),
  source: sourceSchema,
});

export type PrescriptionExplainRequest = z.infer<typeof prescriptionExplainRequestSchema>;
export type PrescriptionTerm = z.infer<typeof prescriptionTermSchema>;
export type PrescriptionExplainResponse = z.infer<typeof prescriptionExplainResponseSchema>;
