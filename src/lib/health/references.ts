// Curated medical references (AI_SAFETY_SPEC.md §2 step 6, §9).
//
// Each entry is a real, checked page recorded in docs/AI_SAFETY_SPEC.md §9.
// Excerpts are verbatim NHS sentences (medication advice deliberately left
// out). The model never writes sources itself; assessment.sources only ever
// contains entries from this list. Never add placeholder or guessed URLs.
import type { Source } from "@/lib/validations";

import { NHS_BACK_PAIN_URL, NHS_CHEST_PAIN_URL, NHS_HEADACHES_URL } from "./safety-rules.ts";

export type CuratedReference = Source & {
  id: string;
  /** Lowercase keywords (as produced by extractTerms) that make this reference relevant. */
  keywords: readonly string[];
  /** Short verified text the model may use as general background. */
  excerpt: string;
};

export const CURATED_REFERENCES: readonly CuratedReference[] = [
  {
    id: "nhs-back-pain",
    title: "Back pain",
    publisher: "NHS",
    url: NHS_BACK_PAIN_URL,
    keywords: ["back", "backache", "spine", "spinal", "lumbar"],
    excerpt:
      'NHS: "Back pain, particularly lower back pain, is very common." "It usually improves within a few weeks but can sometimes last longer or keep coming back." ' +
      'Self-help: "stay active and try to continue with your daily activities". ' +
      'See a GP if: "it does not improve after treating it at home for a few weeks", "it\'s stopping you doing your day-to-day activities", "you\'re worried about the pain or you\'re struggling to cope".',
  },
  {
    id: "nhs-headaches",
    title: "Headaches",
    publisher: "NHS",
    url: NHS_HEADACHES_URL,
    keywords: ["headache", "migraine"],
    excerpt:
      'NHS: "Most headaches are not serious but sometimes you may need medical help." ' +
      'Common causes include: "stress", "bad posture", "not eating regular meals", "not drinking enough fluids (dehydration)". ' +
      'Self-help: "drink plenty of water", "try to relax – stress can make headaches worse". ' +
      'See a GP if: "you\'ve tried treating a headache yourself and it\'s not getting better or is getting worse", "you regularly get headaches".',
  },
  {
    id: "nhs-chest-pain",
    title: "Chest pain",
    publisher: "NHS",
    url: NHS_CHEST_PAIN_URL,
    keywords: ["chest"],
    excerpt:
      'NHS: "Most chest pain is not a sign of anything serious but get medical advice just in case." ' +
      '"Get immediate medical help if you think you\'re having a heart attack." ' +
      'See a GP if: "you have chest pain that comes and goes", "you have chest pain that goes away quickly but you\'re still worried".',
  },
];

/** References whose keywords appear in the query terms (max 3). */
export function selectReferences(
  queryTerms: ReadonlySet<string>,
  references: readonly CuratedReference[] = CURATED_REFERENCES,
): CuratedReference[] {
  return references
    .filter((reference) => reference.keywords.some((keyword) => queryTerms.has(keyword)))
    .slice(0, 3);
}
