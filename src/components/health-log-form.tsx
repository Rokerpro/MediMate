"use client";

import { useState } from "react";
import {
  healthLogCreateSchema,
  type HealthLog,
} from "@/lib/validations";
import { createHealthLog } from "@/lib/api-client";

type FieldErrors = Record<string, string>;
type FormValues = {
  symptoms: string;
  painLocation: string;
  painLevel: string;
  sleepDurationMinutes: string;
  sleepQuality: string;
  mood: string;
  waterMl: string;
  activityMinutes: string;
  notes: string;
};

const initialValues: FormValues = {
  symptoms: "",
  painLocation: "",
  painLevel: "",
  sleepDurationMinutes: "",
  sleepQuality: "",
  mood: "",
  waterMl: "",
  activityMinutes: "",
  notes: "",
};

function getFieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

export function HealthLogForm({ onCreated }: { onCreated: (log: HealthLog) => void }) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setSuccessMessage(null);
    setErrorMessage(null);

    const input = {
      symptoms: values.symptoms,
      painLocation: values.painLocation || undefined,
      painLevel: optionalNumber(values.painLevel),
      sleepDurationMinutes: optionalNumber(values.sleepDurationMinutes),
      sleepQuality: optionalNumber(values.sleepQuality),
      mood: values.mood || undefined,
      waterMl: optionalNumber(values.waterMl),
      activityMinutes: optionalNumber(values.activityMinutes),
      notes: values.notes || undefined,
    };
    const parsed = healthLogCreateSchema.safeParse(input);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setSaving(true);
    try {
      const response = await createHealthLog(parsed.data);
      onCreated(response.log);
      setValues(initialValues);
      setSuccessMessage("Daily log saved.");
    } catch {
      setErrorMessage("We could not save this log. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">{errorMessage}</div>}
      {successMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{successMessage}</div>}
      <Field id="symptoms" label="Symptoms" value={values.symptoms} error={fieldErrors.symptoms} required onChange={(value) => updateField("symptoms", value)} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="painLocation" label="Pain location (optional)" value={values.painLocation} error={fieldErrors.painLocation} onChange={(value) => updateField("painLocation", value)} />
        <Field id="painLevel" label="Pain level (0–10)" type="number" min="0" max="10" value={values.painLevel} error={fieldErrors.painLevel} onChange={(value) => updateField("painLevel", value)} />
        <Field id="sleepDurationMinutes" label="Sleep duration (minutes)" type="number" min="0" value={values.sleepDurationMinutes} error={fieldErrors.sleepDurationMinutes} onChange={(value) => updateField("sleepDurationMinutes", value)} />
        <Field id="sleepQuality" label="Sleep quality (1–5)" type="number" min="1" max="5" value={values.sleepQuality} error={fieldErrors.sleepQuality} onChange={(value) => updateField("sleepQuality", value)} />
        <Field id="mood" label="Mood (optional)" value={values.mood} error={fieldErrors.mood} onChange={(value) => updateField("mood", value)} />
        <Field id="waterMl" label="Water (ml)" type="number" min="0" value={values.waterMl} error={fieldErrors.waterMl} onChange={(value) => updateField("waterMl", value)} />
        <Field id="activityMinutes" label="Activity (minutes)" type="number" min="0" value={values.activityMinutes} error={fieldErrors.activityMinutes} onChange={(value) => updateField("activityMinutes", value)} />
      </div>
      <Field id="notes" label="Notes (optional)" value={values.notes} error={fieldErrors.notes} multiline onChange={(value) => updateField("notes", value)} />
      <button type="submit" disabled={saving} className="rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600">
        {saving ? "Saving…" : "Save daily log"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  error,
  type = "text",
  min,
  max,
  multiline = false,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  type?: "text" | "number";
  min?: string;
  max?: string;
  multiline?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const className = `mt-1 w-full rounded-md border bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:ring-2 ${
    error ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-600"
  }`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      {multiline ? (
        <textarea id={id} rows={4} value={value} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={className} />
      ) : (
        <input id={id} type={type} min={min} max={max} value={value} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={className} />
      )}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
