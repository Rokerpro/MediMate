"use client";

import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createReminder,
  deleteReminder,
  listReminders,
  updateReminder,
  ApiClientError,
} from "@/lib/api-client";
import { ReminderDoses } from "@/components/reminder-doses";
import { ReminderNotifications } from "@/components/reminder-notifications";
import {
  REMINDER_CATEGORIES,
  REMINDER_REPEATS,
  reminderCreateSchema,
  type Reminder,
  type ReminderCategory,
  type ReminderRepeat,
} from "@/lib/validations";

type FormValues = {
  title: string;
  category: ReminderCategory;
  notes: string;
  remindAt: string;
  repeat: ReminderRepeat;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;
type LoadState = "loading" | "ready" | "error";

const EMPTY_FORM: FormValues = {
  title: "",
  category: "other",
  notes: "",
  remindAt: "",
  repeat: "none",
};

const categoryLabels: Record<ReminderCategory, string> = {
  medication: "Medication",
  appointment: "Appointment",
  health_log: "Health log",
  other: "Other",
};

const repeatLabels: Record<ReminderRepeat, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
};

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toOffsetIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const minutes = String(absoluteOffset % 60).padStart(2, "0");
  return `${value}:00${sign}${hours}:${minutes}`;
}

function displayDate(value: string | null): string {
  if (!value) return "Paused";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formValuesFromReminder(reminder: Reminder): FormValues {
  return {
    title: reminder.title,
    category: reminder.category,
    notes: reminder.notes ?? "",
    remindAt: toLocalDateTime(reminder.remindAt),
    repeat: reminder.repeat,
  };
}

function validateForm(values: FormValues): { payload?: FormValues; errors: FieldErrors } {
  const parsed = reminderCreateSchema.safeParse({
    ...values,
    notes: values.notes || undefined,
    remindAt: values.remindAt ? toOffsetIso(values.remindAt) : values.remindAt,
    userConfirmed: true,
  });
  if (parsed.success) return { payload: values, errors: {} };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in EMPTY_FORM) {
      errors[field as keyof FormValues] ??= issue.message;
    }
  }
  return { errors };
}

export function Reminders({
  targetDoseId,
  confirmFailed,
}: {
  targetDoseId?: string;
  confirmFailed?: boolean;
}) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState<FormValues | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    try {
      const response = await listReminders(true);
      setReminders(response.reminders);
      setCurrentTime(Date.now());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setLoadError(error instanceof ApiClientError ? error.message : "We could not load your reminders.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    listReminders(true)
      .then((response) => {
        if (active) {
          setReminders(response.reminders);
          setCurrentTime(Date.now());
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState("error");
          setLoadError(error instanceof ApiClientError ? error.message : "We could not load your reminders.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const sortedReminders = useMemo(
    () => [...reminders].sort((a, b) => {
      if (a.active !== b.active) return Number(b.active) - Number(a.active);
      if (!a.nextDueAt && !b.nextDueAt) return 0;
      if (!a.nextDueAt) return 1;
      if (!b.nextDueAt) return -1;
      return new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime();
    }),
    [reminders],
  );

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setActionError("");
  }

  function startEdit(reminder: Reminder) {
    setEditingId(reminder.id);
    setForm(formValuesFromReminder(reminder));
    setFieldErrors({});
    setPendingCreate(null);
    setActionError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
  }

  function reviewCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateForm(form);
    if (!result.payload) {
      setFieldErrors(result.errors);
      return;
    }
    setPendingCreate(result.payload);
    setActionError("");
  }

  async function saveReminder() {
    if (editingId) {
      const result = validateForm(form);
      if (!result.payload) {
        setFieldErrors(result.errors);
        return;
      }
      setSaving(true);
      setActionError("");
      try {
        const response = await updateReminder(editingId, {
          title: form.title,
          category: form.category,
          notes: form.notes || null,
          remindAt: toOffsetIso(form.remindAt),
          repeat: form.repeat,
        });
        setReminders((current) => current.map((item) => item.id === editingId ? response.reminder : item));
        cancelEdit();
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          await load();
          cancelEdit();
        } else {
          setActionError(error instanceof ApiClientError ? error.message : "We could not save this reminder.");
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!pendingCreate) return;
    setSaving(true);
    setActionError("");
    try {
      const response = await createReminder({
        title: pendingCreate.title,
        category: pendingCreate.category,
        notes: pendingCreate.notes || undefined,
        remindAt: toOffsetIso(pendingCreate.remindAt),
        repeat: pendingCreate.repeat,
        userConfirmed: true,
      });
      setReminders((current) => [response.reminder, ...current]);
      setPendingCreate(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "We could not create this reminder.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(reminder: Reminder) {
    setActionError("");
    try {
      const response = await updateReminder(reminder.id, { active: !reminder.active });
      setReminders((current) => current.map((item) => item.id === reminder.id ? response.reminder : item));
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        await load();
      } else {
        setActionError(error instanceof ApiClientError ? error.message : "We could not update this reminder.");
      }
    }
  }

  async function removeReminder() {
    if (!pendingDelete) return;
    setActionError("");
    try {
      await deleteReminder(pendingDelete);
      setReminders((current) => current.filter((item) => item.id !== pendingDelete));
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        await load();
        setPendingDelete(null);
      } else {
        setActionError(error instanceof ApiClientError ? error.message : "We could not delete this reminder.");
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="In-app reminders"
        title="Reminders"
        description="You set these yourself. MediMate never advises on medicine timing or doses; ask your pharmacist or prescriber."
      />

      <ReminderNotifications />
      <ReminderDoses targetDoseId={targetDoseId} confirmFailed={confirmFailed} />

      <section aria-labelledby="reminder-form-heading" className="rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:p-8">
        <h2 id="reminder-form-heading" className="text-xl font-semibold">
          {editingId ? "Edit reminder" : "Create a reminder"}
        </h2>
        <form className="mt-5 space-y-4" onSubmit={editingId ? (event) => { event.preventDefault(); void saveReminder(); } : reviewCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Title
              <input value={form.title} onChange={(event) => updateField("title", event.target.value)} aria-invalid={Boolean(fieldErrors.title)} className="w-full rounded-full border border-[#cbd6c5] px-3 py-2 font-normal focus:border-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#d8e1cf]" maxLength={120} required />
              {fieldErrors.title && <span className="block text-xs font-normal text-red-700">{fieldErrors.title}</span>}
            </label>
            <label className="space-y-1 text-sm font-medium">
              Remind at
              <input type="datetime-local" value={form.remindAt} onChange={(event) => updateField("remindAt", event.target.value)} aria-invalid={Boolean(fieldErrors.remindAt)} className="w-full rounded-full border border-[#cbd6c5] px-3 py-2 font-normal focus:border-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#d8e1cf]" required />
              {fieldErrors.remindAt && <span className="block text-xs font-normal text-red-700">{fieldErrors.remindAt}</span>}
            </label>
            <label className="space-y-1 text-sm font-medium">
              Category
              <select value={form.category} onChange={(event) => updateField("category", event.target.value as ReminderCategory)} className="w-full rounded-full border border-[#cbd6c5] px-3 py-2 font-normal focus:border-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#d8e1cf]">
                {REMINDER_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
              </select>
              {form.category === "medication" && (
                <span className="block text-xs font-normal text-[#5b6b61]">
                  You&apos;ll be notified until you confirm you took it.
                </span>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium">
              Repeat
              <select value={form.repeat} onChange={(event) => updateField("repeat", event.target.value as ReminderRepeat)} className="w-full rounded-full border border-[#cbd6c5] px-3 py-2 font-normal focus:border-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#d8e1cf]">
                {REMINDER_REPEATS.map((repeat) => <option key={repeat} value={repeat}>{repeatLabels[repeat]}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Notes <span className="font-normal text-[#6b776f]">(optional)</span>
            <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} aria-invalid={Boolean(fieldErrors.notes)} className="min-h-24 w-full rounded-full border border-[#cbd6c5] px-3 py-2 font-normal focus:border-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#d8e1cf]" maxLength={500} />
            {fieldErrors.notes && <span className="block text-xs font-normal text-red-700">{fieldErrors.notes}</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-[#254a38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c3a2c] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
              {editingId ? "Save changes" : "Review reminder"}
            </button>
            {editingId && <button type="button" onClick={cancelEdit} className="rounded-full border border-[#cbd6c5] px-4 py-2.5 text-sm font-semibold text-[#24352d] hover:bg-[#f3f4ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">Cancel</button>}
          </div>
        </form>

        {pendingCreate && (
          <div className="mt-5 space-y-3 rounded-lg border border-[#cbd6c5] bg-[#eef0e5] p-4" role="dialog" aria-labelledby="confirm-reminder-heading">
            <h3 id="confirm-reminder-heading" className="font-semibold text-[#24352d]">Confirm this reminder</h3>
            <p className="text-sm text-[#24352d]">
              “{pendingCreate.title}” on {displayDate(toOffsetIso(pendingCreate.remindAt))}. You are choosing this wording and timing yourself.
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void saveReminder()} disabled={saving} className="rounded-full bg-[#1c3a2c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#16301f] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">Confirm and save</button>
              <button type="button" onClick={() => setPendingCreate(null)} disabled={saving} className="rounded-full border border-[#cbd6c5] px-3 py-2 text-sm font-semibold text-[#254a38] hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">Change</button>
            </div>
          </div>
        )}
      </section>

      {actionError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{actionError}</div>}

      <section aria-labelledby="reminders-list-heading" className="space-y-4">
        <h2 id="reminders-list-heading" className="text-xl font-semibold">Your reminders</h2>
        {loadState === "loading" && <LoadingSkeleton label="Loading reminders…" rows={2} />}
        {loadState === "error" && (
          <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
            <p>{loadError || "We could not load your reminders. Please try again."}</p>
            <button type="button" onClick={() => void load()} className="rounded-full bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">Retry</button>
          </div>
        )}
        {loadState === "ready" && sortedReminders.length === 0 && <p className="rounded-2xl border border-dashed border-[#cbd6c5] bg-[#fffdf8]/70 p-5 text-[#5b6b61]">No reminders yet</p>}
        {loadState === "ready" && sortedReminders.length > 0 && (
          <ul className="space-y-3">
            {sortedReminders.map((reminder) => (
              <li key={reminder.id} className={`rounded-2xl border bg-[#fffdf8] p-5 shadow-sm ${reminder.active ? "border-[#dfe3d6]" : "border-[#cbd6c5] opacity-80"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-lg font-semibold">{reminder.title}</h3>
                      <span className="rounded-full bg-[#eeece1] px-2 py-1 text-xs text-[#40564a]">{categoryLabels[reminder.category]}</span>
                      {!reminder.active && <span className="rounded-full bg-[#e4e1d2] px-2 py-1 text-xs text-[#40564a]">Paused</span>}
                    </div>
                    <p className="mt-2 text-sm text-[#40564a]">
                      {reminder.active && reminder.nextDueAt && currentTime !== null && new Date(reminder.nextDueAt).getTime() < currentTime ? "Overdue · " : ""}
                      {reminder.active ? `Due ${displayDate(reminder.nextDueAt)}` : "Paused"}
                      {reminder.repeat !== "none" && ` · ${repeatLabels[reminder.repeat]}`}
                    </p>
                    {reminder.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#5b6b61]">{reminder.notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => void toggleActive(reminder)} className="rounded-full border border-[#cbd6c5] px-3 py-2 text-sm font-semibold hover:bg-[#f3f4ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">{reminder.active ? "Pause" : "Resume"}</button>
                    <button type="button" onClick={() => startEdit(reminder)} className="rounded-full border border-[#cbd6c5] px-3 py-2 text-sm font-semibold hover:bg-[#f3f4ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">Edit</button>
                    <button type="button" onClick={() => setPendingDelete(reminder.id)} className="rounded-full border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">Delete</button>
                  </div>
                </div>
                {pendingDelete === reminder.id && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
                    <span className="text-sm text-red-900">Delete this reminder?</span>
                    <button type="button" onClick={() => void removeReminder()} className="rounded-full bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">Delete</button>
                    <button type="button" onClick={() => setPendingDelete(null)} className="rounded-full border border-red-300 px-3 py-2 text-sm font-semibold text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">Cancel</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
