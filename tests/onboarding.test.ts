// New-account onboarding rule and the optional profile location.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUserContent } from "../src/lib/ai/prompts.ts";
import type { ModelContext } from "../src/lib/ai/types.ts";
import { NEW_USER_NAME, needsOnboarding } from "../src/lib/profile-onboarding.ts";
import { profileUpdateToRow, rowToProfile } from "../src/lib/supabase/mappers.ts";
import { profileSchema, profileUpdateSchema } from "../src/lib/validations/profile.ts";

const ID = "22222222-3333-4444-8555-666666666666";

describe("needsOnboarding", () => {
  it("is true for a fresh account (placeholder name or no age)", () => {
    assert.equal(needsOnboarding({ displayName: NEW_USER_NAME, age: null }), true);
    assert.equal(needsOnboarding({ displayName: "Sam Rivera", age: null }), true);
    assert.equal(needsOnboarding({ displayName: ` ${NEW_USER_NAME} `, age: 30 }), true);
  });
  it("is false once name and age are set", () => {
    assert.equal(needsOnboarding({ displayName: "Sam Rivera", age: 30 }), false);
  });
});

describe("profile location", () => {
  it("is optional, trimmed, max 100 characters; blank is stored as null", () => {
    assert.ok(profileUpdateSchema.safeParse({ location: "Kathmandu" }).success);
    assert.ok(profileUpdateSchema.safeParse({ location: null }).success);
    assert.equal(profileUpdateSchema.safeParse({ location: "x".repeat(101) }).success, false);
    assert.equal(profileUpdateToRow({ location: "  " }, new Date(0)).location, null);
  });

  it("maps from the database row", () => {
    const profile = rowToProfile({
      id: ID, display_name: "Sam", age: null, gender: null, location: "Leeds", height_cm: null, weight_kg: null,
      conditions: [], allergies: [], medications: [], medical_history: null,
    });
    assert.equal(profile.location, "Leeds");
    assert.equal(profile.age, null);
    assert.ok(profileSchema.safeParse(profile).success);
  });

  it("is never sent to the AI model", () => {
    const context = {
      currentMessage: "My back hurts.",
      priorMessages: [],
      priorUserMessageCount: 0,
      profile: {
        id: ID, displayName: "Sam", age: 30, gender: null, location: "Secretville", heightCm: null, weightKg: null,
        conditions: [], allergies: [], medications: [], medicalHistory: "",
      },
      relevantLogs: [],
      recentMeasurementLogs: [],
      references: [],
      mustAssess: false,
      isRepair: false,
    } satisfies ModelContext;
    assert.doesNotMatch(buildUserContent(context), /Secretville/);
  });
});
