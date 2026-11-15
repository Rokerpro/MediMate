"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, confirmReminderDose, listReminderDoses } from "@/lib/api-client";
import type { ReminderDose } from "@/lib/validations";

type LoadState = "loading" | "ready" | "error";

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: ReminderDose["status"]): string {
  if (status === "pending") return "Due";
  if (status === "taken") return "Taken";
  return "Missed";
}

export function ReminderDoses({
  targetDoseId,
  confirmFailed = false,
}: {
  targetDoseId?: string;
  confirmFailed?: boolean;
}) {
  const [doses, setDoses] = useState<ReminderDose[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<{ id: string; message: string } | null>(null);
  const requestInFlight = useRef(false);
  const mounted = useRef(false);
  const scrolledTargetId = useRef<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (showLoading) setLoadState("loading");
    setLoadError("");
    try {
      const response = await listReminderDoses(24);
      if (mounted.current) {
        setDoses(response.doses);
        setLoadState("ready");
      }
    } catch (error) {
      if (mounted.current) {
        setLoadError(error instanceof ApiClientError ? error.message : "We could not load recent doses.");
        setLoadState("error");
      }
    } finally {
      requestInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const frameId = window.requestAnimationFrame(() => void load(true));
    const intervalId = window.setInterval(() => void load(), 60_000);
    return () => {
      mounted.current = false;
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
    };
  }, [load]);

  useEffect(() => {
    if (!targetDoseId || loadState !== "ready" || scrolledTargetId.current === targetDoseId) return;
    const target = document.getElementById(`dose-${targetDoseId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    scrolledTargetId.current = targetDoseId;
  }, [doses, loadState, targetDoseId]);

  async function confirmDose(dose: ReminderDose) {
    setConfirmingId(dose.id);
    setConfirmError(null);
    try {
      const response = await confirmReminderDose(dose.id);
      setDoses((current) => current.map((item) => item.id === dose.id ? response.dose : item));
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "We could not confirm this dose. Please try again.";
      setConfirmError({ id: dose.id, message });
      if (error instanceof ApiClientError && error.status === 409) {
        await load();
      }
    } finally {
      setConfirmingId(null);
    }
  }

  const targetDose = doses.find((dose) => dose.id === targetDoseId);

  return (
    <section aria-labelledby="recent-doses-heading" className="space-y-4">
      <div>
        <h2 id="recent-doses-heading" className="text-xl font-semibold">Recent medicine doses</h2>
        <p className="mt-1 text-sm text-[#5b6b61]">Recent doses from your medication reminders.</p>
      </div>

      {confirmFailed && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          We couldn&apos;t confirm from the notification. Tap I took it to confirm.
        </p>
      )}

      {loadState === "loading" && <p role="status">Loading recent doses…</p>}
      {loadState === "error" && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <p>{loadError || "We could not load recent doses."}</p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="rounded-full bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Retry
          </button>
        </div>
      )}
      {loadState === "ready" && targetDoseId && !targetDose && (
        <p role="status" className="rounded-lg border border-[#dfe3d6] bg-white p-4 text-sm text-[#40564a]">
          This reminder has expired or was not found.
        </p>
      )}
      {loadState === "ready" && doses.length === 0 && !targetDoseId && (
        <p className="rounded-2xl border border-dashed border-[#cbd6c5] bg-[#fffdf8]/70 p-5 text-[#5b6b61]">
          No medicine doses in the last 24 hours.
        </p>
      )}
      {loadState === "ready" && doses.length > 0 && (
        <ul className="space-y-3">
          {doses.map((dose) => {
            const highlighted = dose.id === targetDoseId;
            const tone = dose.status === "taken"
              ? "bg-green-50 text-green-800"
              : dose.status === "missed"
                ? "bg-amber-50 text-amber-900"
                : "bg-[#eef0e5] text-[#254a38]";
            return (
              <li
                key={dose.id}
                id={`dose-${dose.id}`}
                tabIndex={highlighted ? -1 : undefined}
                className={`rounded-2xl border bg-[#fffdf8] p-5 shadow-sm ${highlighted ? "border-[#bd7e3e] ring-2 ring-[#ead9be]" : "border-[#dfe3d6]"}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-lg font-semibold">{dose.title}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone}`}>
                        {statusLabel(dose.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#40564a]">Due {displayDate(dose.dueAt)}</p>
                    <p className="mt-1 text-sm text-[#5b6b61]">Reminder {dose.notificationsSent} of 3</p>
                    {dose.status === "missed" && dose.canConfirm && (
                      <p className="mt-2 text-sm text-amber-900">
                        Missed. You can still confirm until {displayDate(dose.confirmBy)}.
                      </p>
                    )}
                  </div>
                  {dose.canConfirm && (
                    <button
                      type="button"
                      onClick={() => void confirmDose(dose)}
                      disabled={confirmingId === dose.id}
                      className={`w-full shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto ${highlighted ? "bg-[#1c3a2c] hover:bg-[#16301f] sm:px-6 sm:py-3 sm:text-base" : "bg-[#254a38] hover:bg-[#1c3a2c]"}`}
                    >
                      {confirmingId === dose.id ? "Confirming…" : "I took it"}
                    </button>
                  )}
                </div>
                {confirmError?.id === dose.id && (
                  <p role="alert" className="mt-3 text-sm text-red-800">{confirmError.message}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
