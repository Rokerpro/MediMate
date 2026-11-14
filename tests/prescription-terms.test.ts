// Prescription abbreviation explainer: fixed positive, negative and ambiguous cases.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explainPrescription } from "../src/lib/health/prescription-terms.ts";
import { prescriptionExplainRequestSchema, prescriptionExplainResponseSchema } from "../src/lib/validations/prescription.ts";

const abbreviations = (text: string) => explainPrescription(text).terms.map((t) => t.abbreviation);

describe("explainPrescription", () => {
  it("recognises dotted and undotted forms, in order of appearance", () => {
    assert.deepEqual(abbreviations("Ibuprofen 200mg tds prn, paracetamol B.D."), ["t.d.s.", "p.r.n.", "b.d."]);
    assert.deepEqual(abbreviations("one tablet o.d. and one o.n., cream q.d.s., stat dose"), ["o.d.", "o.n.", "q.d.s.", "stat"]);
  });

  it("uses the source wording and keeps what the user typed", () => {
    const [term] = explainPrescription("take 1 BD").terms;
    assert.deepEqual(term, { abbreviation: "b.d.", latin: "bis die", meaning: "twice daily", matchedText: "BD", caution: null });
  });

  it("flags that o.d. can mean the right eye", () => {
    const [term] = explainPrescription("eye drops 1 drop OD").terms;
    assert.equal(term!.abbreviation, "o.d.");
    assert.match(term!.caution!, /right eye/);
  });

  it("does not match ordinary words or parts of words", () => {
    assert.deepEqual(abbreviations("Take on an empty stomach with food, a statin, odd bdx"), []);
    assert.deepEqual(abbreviations("Status: tdsx prnt 0.d."), []);
  });

  it("lists each abbreviation once and always returns guidance and the source", () => {
    const result = explainPrescription("bd bd b.d.");
    assert.equal(result.terms.length, 1);
    assert.match(result.guidance, /pharmacist or prescriber/);
    assert.equal(result.source.url, "https://patient.info/doctor/general-prescribing-guidance");
    assert.ok(prescriptionExplainResponseSchema.safeParse(result).success);
  });

  it("returns no terms (but guidance) when nothing is recognised", () => {
    const result = explainPrescription("Amoxicillin 500mg capsules");
    assert.deepEqual(result.terms, []);
    assert.ok(result.guidance.length > 0);
  });
});

describe("prescriptionExplainRequestSchema", () => {
  it("rejects empty, oversized and extra fields", () => {
    assert.equal(prescriptionExplainRequestSchema.safeParse({ text: "   " }).success, false);
    assert.equal(prescriptionExplainRequestSchema.safeParse({ text: "x".repeat(2001) }).success, false);
    assert.equal(prescriptionExplainRequestSchema.safeParse({ text: "bd", save: true }).success, false);
  });
});
