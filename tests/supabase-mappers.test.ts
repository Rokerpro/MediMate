// Unit tests for DB row <-> API contract mapping (no network, synthetic data only).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstRow,
  healthLogCreateToRow,
  profileUpdateToRow,
  rowToHealthLog,
  rowToProfile,
} from "../src/lib/supabase/mappers.ts";
import { DEMO_PROFILE_ID } from "../src/lib/validations/profile.ts";

const profileRow = {
  id: DEMO_PROFILE_ID,
  display_name: "Alex Demo",
  age: 24,
  gender: null,
  height_cm: 175,
  weight_kg: "70.0",
  conditions: [],
  allergies: [],
  medications: [],
  medical_history: null,
};

const logRow = {
  id: "5b0c1d7e-2f4a-4c8b-9e1d-3a6f7b8c9d0e",
  logged_at: "2026-11-13T09:00:00+00:00",
  symptoms: "Mild lower back discomfort",
  pain_location: "Lower back",
  pain_level: 3,
  sleep_duration_minutes: 420,
  sleep_quality: 3,
  mood: "okay",
  water_ml: 1600,
  activity_minutes: 15,
  notes: "Synthetic note.",
};

describe("rowToProfile", () => {
  it("maps snake_case to the contract and normalizes numeric strings and null history", () => {
    const profile = rowToProfile(profileRow);
    assert.equal(profile.displayName, "Alex Demo");
    assert.equal(profile.weightKg, 70);
    assert.equal(profile.medicalHistory, "");
    assert.deepEqual(profile.medications, []);
  });

  it("rejects rows that violate the contract", () => {
    assert.throws(() => rowToProfile({ ...profileRow, age: 0 }));
    assert.throws(() => rowToProfile({ ...profileRow, medications: [{ name: "x" }] }));
  });
});

describe("rowToHealthLog", () => {
  it("normalizes logged_at to UTC ISO with milliseconds", () => {
    const log = rowToHealthLog(logRow);
    assert.equal(log.loggedAt, "2026-11-13T09:00:00.000Z");
    assert.equal(log.painLevel, 3);
  });

  it("rejects out-of-range values", () => {
    assert.throws(() => rowToHealthLog({ ...logRow, pain_level: 11 }));
  });
});

describe("profileUpdateToRow", () => {
  it("writes only provided fields plus updated_at", () => {
    const now = new Date("2026-11-14T00:00:00.000Z");
    assert.deepEqual(profileUpdateToRow({ age: 25, gender: "  " }, now), {
      age: 25,
      gender: null,
      updated_at: "2026-11-14T00:00:00.000Z",
    });
  });
});

describe("healthLogCreateToRow", () => {
  it("uses the server profile id, omits loggedAt when absent and blanks to null", () => {
    const row = healthLogCreateToRow({ symptoms: "Headache", mood: "", painLevel: 0 }, DEMO_PROFILE_ID);
    assert.deepEqual(row, {
      profile_id: DEMO_PROFILE_ID,
      symptoms: "Headache",
      mood: null,
      pain_level: 0,
    });
  });
});

describe("firstRow", () => {
  it("returns the first element or undefined", () => {
    assert.equal(firstRow([]), undefined);
    assert.equal(firstRow({}), undefined);
    assert.equal(firstRow([1, 2]), 1);
  });
});
