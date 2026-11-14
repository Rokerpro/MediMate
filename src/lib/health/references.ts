// Curated medical references (AI_SAFETY_SPEC.md §2 step 6, §9).
//
// BLOCKED: empty until the team picks real, checked sources (title, publisher,
// URL, short excerpt) and records them in docs/AI_SAFETY_SPEC.md §9. The model
// never writes sources itself; assessment.sources only ever contains entries
// from this list. Never add placeholder or guessed URLs here.
import type { Source } from "@/lib/validations";

export type CuratedReference = Source & {
  id: string;
  /** Lowercase keywords that make this reference relevant. */
  keywords: readonly string[];
  /** Short verified text the model may use as general background. */
  excerpt: string;
};

export const CURATED_REFERENCES: readonly CuratedReference[] = [];

/** References whose keywords appear in the query terms (max 3). */
export function selectReferences(
  queryTerms: ReadonlySet<string>,
  references: readonly CuratedReference[] = CURATED_REFERENCES,
): CuratedReference[] {
  return references
    .filter((reference) => reference.keywords.some((keyword) => queryTerms.has(keyword)))
    .slice(0, 3);
}
