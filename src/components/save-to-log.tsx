"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { ApiClientError, createHealthLog } from "@/lib/api-client";
import { draftLogFromUserMessages } from "@/lib/health/log-draft";

// "Save to my log" under a completed assessment. Prefilled ONLY from the
// user's own messages; the user edits and confirms before anything is saved
// (existing POST /api/health-logs). Never shown for urgent replies.

type Phase = "closed" | "editing" | "saving" | "saved";

export function SaveToLog({ userTexts, dark = false }: { userTexts: readonly string[]; dark?: boolean }) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>("closed");
  const [symptoms, setSymptoms] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [painLevel, setPainLevel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const muted = dark ? "text-slate-300" : "text-slate-600";
  const field = `mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#bd7e3e] ${
    dark ? "border-[#49574d] bg-[#16211b] text-slate-100" : "border-slate-300 bg-white text-slate-950"
  }`;
  const panel = `rounded-xl border p-4 sm:p-5 ${dark ? "border-[#35443a] bg-[#1f2c24] text-slate-100" : "border-slate-200 bg-white text-slate-950"}`;

  function open() {
    const draft = draftLogFromUserMessages(userTexts);
    setSymptoms(draft.symptoms);
    setPainLocation(draft.painLocation ?? "");
    setPainLevel(draft.painLevel === null ? "" : String(draft.painLevel));
    setError(null);
    setPhase("editing");
  }

  const trimmedSymptoms = symptoms.trim();
  const levelNumber = painLevel === "" ? null : Number(painLevel);
  const levelValid = levelNumber === null || (Number.isInteger(levelNumber) && levelNumber >= 0 && levelNumber <= 10);
  const canSave = trimmedSymptoms.length > 0 && trimmedSymptoms.length <= 1000 && levelValid;

  async function save() {
    if (!canSave || phase === "saving") return;
    setPhase("saving");
    setError(null);
    try {
      await createHealthLog({
        symptoms: trimmedSymptoms,
        painLocation: painLocation.trim() || null,
        painLevel: levelNumber,
        notes: "Saved by the user from an assistant conversation (user-reported).",
      });
      setPhase("saved");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "The log could not be saved. Please try again.");
      setPhase("editing");
    }
  }

  if (phase === "saved") {
    return (
      <p role="status" className={`${panel} text-sm`}>
        Saved to your health log.{" "}
        <Link href="/logs" className="font-semibold underline focus:outline-none focus:ring-2 focus:ring-[#bd7e3e]">
          View your logs
        </Link>
      </p>
    );
  }

  if (phase === "closed") {
    return (
      <button
        type="button"
        onClick={open}
        className={`rounded-md border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#bd7e3e] ${
          dark ? "border-[#49574d] text-slate-100 hover:bg-white/5" : "border-slate-300 text-[#24352d] hover:bg-slate-50"
        }`}
      >
        Save to my log
      </button>
    );
  }

  return (
    <form
      className={`${panel} space-y-3`}
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <h3 id={`${id}-title`} className="font-semibold">Save to my health log</h3>
        <p className={`mt-1 text-sm ${muted}`}>
          Filled in from your own messages only, not from the assistant&apos;s reply. Check and edit it before saving.
        </p>
      </div>
      <label className="block text-sm font-medium">
        What you noticed
        <textarea
          rows={3}
          maxLength={1000}
          value={symptoms}
          onChange={(event) => setSymptoms(event.target.value)}
          className={field}
          required
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Where (optional)
          <input
            type="text"
            maxLength={200}
            value={painLocation}
            onChange={(event) => setPainLocation(event.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          Pain level 0–10 (optional)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            step={1}
            value={painLevel}
            onChange={(event) => setPainLevel(event.target.value)}
            aria-invalid={!levelValid}
            className={field}
          />
        </label>
      </div>
      {!levelValid && <p className="text-sm text-red-600">Pain level must be a whole number from 0 to 10.</p>}
      {error && (
        <p role="alert" className={`rounded-md border p-3 text-sm ${dark ? "border-red-800 bg-red-950 text-red-100" : "border-red-200 bg-red-50 text-red-900"}`}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSave || phase === "saving"}
          className="rounded-md bg-[#254a38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d3b2d] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#bd7e3e]"
        >
          {phase === "saving" ? "Saving…" : error ? "Try again" : "Confirm and save"}
        </button>
        <button
          type="button"
          onClick={() => setPhase("closed")}
          disabled={phase === "saving"}
          className={`rounded-md border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#bd7e3e] ${
            dark ? "border-[#49574d] hover:bg-white/5" : "border-slate-300 hover:bg-slate-50"
          }`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
