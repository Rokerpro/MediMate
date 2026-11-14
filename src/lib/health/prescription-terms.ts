// Deterministic prescription-abbreviation explainer. No AI model: it only expands
// the abbreviations listed by the approved source, using the source's wording
// (docs/AI_SAFETY_SPEC.md §9.3). It never interprets doses, drug names, purpose
// or timing. Source approved by Person A on 2026-11-14.
import type { PrescriptionExplainResponse, PrescriptionTerm } from "../validations/prescription.ts";

export const PATIENT_INFO_PRESCRIBING_SOURCE = {
  title: "General prescribing guidance",
  publisher: "Patient.info",
  url: "https://patient.info/doctor/general-prescribing-guidance",
} as const;

export const PRESCRIPTION_GUIDANCE =
  "This only explains common prescription abbreviations. It does not check your medicine, dose or timing. " +
  "Follow the label and the instructions from your pharmacist or prescriber, and ask them if anything is unclear.";

const OD_CAUTION =
  "On eye prescriptions \"o.d.\" can mean the right eye instead. Check with your pharmacist which meaning applies.";

type TermDefinition = Omit<PrescriptionTerm, "matchedText"> & { pattern: RegExp };

// Letters may be written with or without dots ("bd", "b.d."), except "o.n.",
// which needs its dots because "on" is an ordinary word.
const letters = (...chars: string[]) =>
  new RegExp(`(?<![a-z0-9.])${chars.map((c) => `${c}\\.?`).join("\\s?")}(?![a-z0-9])`, "i");

const TERMS: readonly TermDefinition[] = [
  { abbreviation: "stat", latin: null, meaning: "immediately", caution: null, pattern: /(?<![a-z0-9])stat(?![a-z0-9])/i },
  { abbreviation: "p.r.n.", latin: "pro re nata", meaning: "when required", caution: null, pattern: letters("p", "r", "n") },
  { abbreviation: "o.d.", latin: "omni die", meaning: "every day", caution: OD_CAUTION, pattern: letters("o", "d") },
  { abbreviation: "o.n.", latin: "omni nocte", meaning: "every night", caution: null, pattern: /(?<![a-z0-9.])o\.\s?n\.(?![a-z0-9])/i },
  { abbreviation: "b.d.", latin: "bis die", meaning: "twice daily", caution: null, pattern: letters("b", "d") },
  { abbreviation: "t.d.s.", latin: "ter die sumendum", meaning: "to be taken three times daily", caution: null, pattern: letters("t", "d", "s") },
  { abbreviation: "q.d.s.", latin: "quater die sumendum", meaning: "to be taken four times daily", caution: null, pattern: letters("q", "d", "s") },
];

/** Recognised abbreviations in order of first appearance, with fixed guidance and the source. */
export function explainPrescription(text: string): PrescriptionExplainResponse {
  const found = TERMS.flatMap(({ pattern, ...term }) => {
    const match = pattern.exec(text);
    return match ? [{ index: match.index, term: { ...term, matchedText: match[0] } }] : [];
  });
  return {
    terms: found.sort((a, b) => a.index - b.index).map((entry) => entry.term),
    guidance: PRESCRIPTION_GUIDANCE,
    source: { ...PATIENT_INFO_PRESCRIBING_SOURCE },
  };
}
