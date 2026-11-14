"use client";

import { useEffect, useState } from "react";
import {
  profileUpdateSchema,
  type Profile,
} from "@/lib/validations";
import { getProfile, updateProfile } from "@/lib/api-client";

type FieldErrors = Record<string, string>;
type ProfileDraft = Omit<Profile, "age"> & { age: number | null };

function getFieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
    return errors;
  }, {});
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setLoadError(null);
    try {
      setProfile((await getProfile()).profile);
    } catch {
      setLoadError("We could not load the profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getProfile()
      .then((response) => {
        if (active) setProfile(response.profile);
      })
      .catch(() => {
        if (active) setLoadError("We could not load the profile. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setSuccessMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaveError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const editableFields = { ...profile };
    Reflect.deleteProperty(editableFields, "id");
    const parsed = profileUpdateSchema.safeParse(editableFields);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setSaving(true);
    try {
      const response = await updateProfile(parsed.data);
      setProfile(response.profile);
      setSuccessMessage("Profile saved.");
    } catch {
      setSaveError("We could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p role="status">Loading your profile…</p>;
  }

  if (loadError || !profile) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <p>{loadError ?? "Profile data is unavailable."}</p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          {saveError}
        </div>
      )}
      {successMessage && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          {successMessage}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          id="displayName"
          label="Display name"
          value={profile.displayName}
          error={fieldErrors.displayName}
          onChange={(value) => updateField("displayName", value)}
        />
        <NumberField
          id="age"
          label="Age"
          value={profile.age}
          error={fieldErrors.age}
          onChange={(value) => updateField("age", value)}
        />
        <TextField
          id="gender"
          label="Gender"
          value={profile.gender ?? ""}
          error={fieldErrors.gender}
          onChange={(value) => updateField("gender", value || null)}
        />
        <NumberField
          id="heightCm"
          label="Height (cm)"
          value={profile.heightCm}
          error={fieldErrors.heightCm}
          onChange={(value) => updateField("heightCm", value)}
        />
        <NumberField
          id="weightKg"
          label="Weight (kg)"
          value={profile.weightKg}
          error={fieldErrors.weightKg}
          onChange={(value) => updateField("weightKg", value)}
        />
      </div>
      <TextField
        id="conditions"
        label="Conditions (comma-separated)"
        value={profile.conditions.join(", ")}
        error={fieldErrors.conditions}
        onChange={(value) => updateField("conditions", parseList(value))}
      />
      <TextField
        id="allergies"
        label="Allergies (comma-separated)"
        value={profile.allergies.join(", ")}
        error={fieldErrors.allergies}
        onChange={(value) => updateField("allergies", parseList(value))}
      />
      <TextField
        id="medications"
        label="Medications (comma-separated)"
        value={profile.medications.join(", ")}
        error={fieldErrors.medications}
        onChange={(value) => updateField("medications", parseList(value))}
      />
      <TextAreaField
        id="medicalHistory"
        label="Relevant medical history"
        value={profile.medicalHistory}
        error={fieldErrors.medicalHistory}
        onChange={(value) => updateField("medicalHistory", value)}
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function fieldClass(error?: string) {
  return `mt-1 w-full rounded-md border bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:ring-2 ${
    error ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-600"
  }`;
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error)}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  error?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <input
        id={id}
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error)}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <textarea
        id={id}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error)}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
