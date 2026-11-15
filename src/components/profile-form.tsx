"use client";

import { useEffect, useState } from "react";
import {
  profileUpdateSchema,
  type Profile,
} from "@/lib/validations";
import { getProfile, updateProfile } from "@/lib/api-client";
import { NEW_USER_NAME } from "@/lib/profile-onboarding";

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

/** Shows the placeholder name as an empty field so the user types their own. */
function toDraft(profile: Profile, onboarding: boolean): ProfileDraft {
  return onboarding && profile.displayName === NEW_USER_NAME ? { ...profile, displayName: "" } : profile;
}

export function ProfileForm({
  onboarding = false,
  onSaved,
}: {
  /** First-run mode: name and age required, placeholder name cleared, "Continue" button. */
  onboarding?: boolean;
  onSaved?: () => void;
} = {}) {
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
      setProfile(toDraft((await getProfile()).profile, onboarding));
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
        if (active) setProfile(toDraft(response.profile, onboarding));
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
  }, [onboarding]);

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
    if (onboarding && (parsed.data.displayName?.trim() === NEW_USER_NAME || parsed.data.age == null)) {
      setFieldErrors({ displayName: "Please enter your name.", age: "Please enter your age." });
      return;
    }

    setSaving(true);
    try {
      const response = await updateProfile(parsed.data);
      setProfile(response.profile);
      setSuccessMessage("Profile saved.");
      onSaved?.();
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
    <form onSubmit={handleSubmit} className={onboarding ? "space-y-7" : "space-y-6"}>
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
          label={onboarding ? "Full name" : "Display name"}
          value={profile.displayName}
          error={fieldErrors.displayName}
          onboarding={onboarding}
          onChange={(value) => updateField("displayName", value)}
        />
        <NumberField
          id="age"
          label="Age"
          value={profile.age}
          error={fieldErrors.age}
          onboarding={onboarding}
          onChange={(value) => updateField("age", value)}
        />
        <SelectField
          id="gender"
          label="Gender"
          value={profile.gender ?? ""}
          error={fieldErrors.gender}
          options={["Male", "Female", "Other"]}
          onboarding={onboarding}
          onChange={(value) => updateField("gender", value || null)}
        />
        <TextField
          id="location"
          label="Location (town or country, optional)"
          value={profile.location ?? ""}
          error={fieldErrors.location}
          onboarding={onboarding}
          onChange={(value) => updateField("location", value || null)}
        />
        <NumberField
          id="heightCm"
          label="Height (cm)"
          value={profile.heightCm}
          error={fieldErrors.heightCm}
          onboarding={onboarding}
          onChange={(value) => updateField("heightCm", value)}
        />
        <NumberField
          id="weightKg"
          label="Weight (kg)"
          value={profile.weightKg}
          error={fieldErrors.weightKg}
          onboarding={onboarding}
          onChange={(value) => updateField("weightKg", value)}
        />
      </div>
      <TextField
        id="conditions"
        label="Conditions (comma-separated)"
        value={profile.conditions.join(", ")}
        error={fieldErrors.conditions}
        onboarding={onboarding}
        onChange={(value) => updateField("conditions", parseList(value))}
      />
      <TextField
        id="allergies"
        label="Allergies (comma-separated)"
        value={profile.allergies.join(", ")}
        error={fieldErrors.allergies}
        onboarding={onboarding}
        onChange={(value) => updateField("allergies", parseList(value))}
      />
      <TextField
        id="medications"
        label="Medications (comma-separated)"
        value={profile.medications.join(", ")}
        error={fieldErrors.medications}
        onboarding={onboarding}
        onChange={(value) => updateField("medications", parseList(value))}
      />
      <TextAreaField
        id="medicalHistory"
        label="Relevant medical history"
        value={profile.medicalHistory}
        error={fieldErrors.medicalHistory}
        onboarding={onboarding}
        onChange={(value) => updateField("medicalHistory", value)}
      />
      <button
        type="submit"
        disabled={saving}
        className={onboarding
          ? "min-h-11 rounded-full bg-[#254a38] px-6 py-2.5 font-semibold text-white transition-colors hover:bg-[#1c3a2c] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
          : "rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600"}
      >
        {saving ? "Saving…" : onboarding ? "Continue to MediMate" : "Save profile"}
      </button>
    </form>
  );
}

function fieldClass(error?: string, onboarding = false) {
  const base = onboarding
    ? "mt-1 w-full rounded-xl border bg-white px-3.5 py-3 text-[#24352d] shadow-sm outline-none transition focus:ring-2"
    : "mt-1 w-full rounded-md border bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:ring-2";
  const color = error
    ? onboarding
      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
      : "border-red-500 focus:ring-red-500"
    : onboarding
      ? "border-[#cbd6c5] focus:border-[#789078] focus:ring-[#d8e1cf]"
      : "border-slate-300 focus:ring-blue-600";
  return `${base} ${color}`;
}

function TextField({
  id,
  label,
  value,
  error,
  onboarding,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onboarding: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium ${onboarding ? "text-[#40564a]" : "text-slate-800"}`}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error, onboarding)}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  error,
  onboarding,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  error?: string;
  onboarding: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium ${onboarding ? "text-[#40564a]" : "text-slate-800"}`}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error, onboarding)}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  error,
  onboarding,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  error?: string;
  onboarding: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium ${onboarding ? "text-[#40564a]" : "text-slate-800"}`}>{label}</label>
      <input
        id={id}
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error, onboarding)}
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
  onboarding,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onboarding: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium ${onboarding ? "text-[#40564a]" : "text-slate-800"}`}>{label}</label>
      <textarea
        id={id}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error, onboarding)}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
