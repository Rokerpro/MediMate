"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { ApiClientError, createHealthLog } from "@/lib/api-client";
import type { HealthLog } from "@/lib/validations";

const PAIN_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SLEEP_OPTIONS = [
  { label: "≤5h", minutes: 300 },
  { label: "6h", minutes: 360 },
  { label: "7h", minutes: 420 },
  { label: "8h", minutes: 480 },
  { label: "9h+", minutes: 540 },
] as const;
const MOODS = ["Low", "Okay", "Good"] as const;
/** Matches the "nothing reported" placeholder that analytics already ignore. */
const NO_SYMPTOMS = "No specific symptoms reported";

function ChoicePill({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-full border px-3.5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#c98b48] ${
        checked
          ? "border-[#254a38] bg-[#254a38] text-[#fbfaf5]"
          : "border-[#cbd6c5] bg-[#fffdf8] text-[#40564a] hover:bg-[#eef0e5]"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        onClick={() => {
          // Clicking the selected option again clears it.
          if (checked) onSelect();
        }}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export function TodayCheckIn({ onSaved }: { onSaved: (log: HealthLog) => void }) {
  const id = useId();
  const [pain, setPain] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const isEmpty = pain === null && sleep === null && mood === null && note.trim() === "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEmpty) {
      setStatus("error");
      setError("Choose at least one value or write a short note.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const { log } = await createHealthLog({
        symptoms: note.trim() || NO_SYMPTOMS,
        painLevel: pain ?? undefined,
        sleepDurationMinutes: sleep ?? undefined,
        mood: mood ?? undefined,
      });
      setPain(null);
      setSleep(null);
      setMood(null);
      setNote("");
      setStatus("saved");
      onSaved(log);
    } catch (caught) {
      setStatus("error");
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "We could not save your check-in. Please try again.",
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-5 rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-lg font-semibold text-[#243b30]">
          Today&apos;s check-in
        </h2>
        <span className="text-xs text-[#6b776f]">Every field is optional</span>
      </div>

      <fieldset>
        <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">
          Pain level (0–10)
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {PAIN_LEVELS.map((level) => (
            <ChoicePill
              key={level}
              name={`${id}-pain`}
              label={String(level)}
              checked={pain === level}
              onSelect={() => setPain(pain === level ? null : level)}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">
            Sleep last night
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {SLEEP_OPTIONS.map((option) => (
              <ChoicePill
                key={option.minutes}
                name={`${id}-sleep`}
                label={option.label}
                checked={sleep === option.minutes}
                onSelect={() => setSleep(sleep === option.minutes ? null : option.minutes)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">
            Mood
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((option) => (
              <ChoicePill
                key={option}
                name={`${id}-mood`}
                label={option}
                checked={mood === option}
                onSelect={() => setMood(mood === option ? null : option)}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor={`${id}-note`} className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">
          What did you notice?
        </label>
        <input
          id={`${id}-note`}
          value={note}
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. lower back stiff after a long desk day"
          className="min-h-11 w-full rounded-xl border border-[#cbd6c5] bg-white px-4 text-sm text-[#24352d] placeholder:text-[#94a096] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex min-h-11 items-center rounded-full bg-[#254a38] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1c3a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save check-in"}
        </button>
        <Link
          href="/logs"
          className="inline-flex min-h-11 items-center rounded-full border border-[#cbd6c5] px-5 text-sm font-semibold text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
        >
          Full log form
        </Link>
        <p role="status" aria-live="polite" className="text-sm text-[#3d6149]">
          {status === "saved" ? "Saved to your daily logs." : ""}
        </p>
      </div>
      {status === "error" && error ? (
        <p role="alert" className="rounded-xl bg-[#f3ede3] px-4 py-3 text-sm text-[#7a3520]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
