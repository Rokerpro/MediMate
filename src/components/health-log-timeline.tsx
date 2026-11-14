"use client";

import { useEffect, useState } from "react";
import type { HealthLog } from "@/lib/validations";
import { getHealthLogs } from "@/lib/api-client";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function HealthLogTimeline({ newLog }: { newLog: HealthLog | null }) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setErrorMessage(null);
    try {
      setLogs((await getHealthLogs()).logs);
    } catch {
      setErrorMessage("We could not load your health logs. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getHealthLogs()
      .then((response) => {
        if (active) setLogs(response.logs);
      })
      .catch(() => {
        if (active) setErrorMessage("We could not load your health logs. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const displayedLogs = newLog
    ? [newLog, ...logs.filter((log) => log.id !== newLog.id)]
    : logs;

  if (loading) return <p role="status">Loading your daily logs…</p>;
  if (errorMessage) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <p>{errorMessage}</p>
        <button type="button" onClick={() => void loadLogs()} className="rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-600">Retry</button>
      </div>
    );
  }
  if (displayedLogs.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-slate-600">No daily logs yet. Add your first observation above.</p>;
  }

  return (
    <ol className="relative space-y-5 border-l border-slate-300 pl-6">
      {displayedLogs.map((log) => (
        <li key={log.id} className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="absolute -left-[31px] top-6 h-3 w-3 rounded-full border-2 border-white bg-blue-700" aria-hidden="true" />
          <time dateTime={log.loggedAt} className="text-sm font-medium text-blue-700">{formatDate(log.loggedAt)}</time>
          <h3 className="mt-2 font-semibold">{log.symptoms}</h3>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {log.painLocation && <div><dt className="inline font-medium text-slate-800">Location: </dt><dd className="inline">{log.painLocation}</dd></div>}
            {log.painLevel !== null && <div><dt className="inline font-medium text-slate-800">Pain: </dt><dd className="inline">{log.painLevel}/10</dd></div>}
            {log.sleepDurationMinutes !== null && <div><dt className="inline font-medium text-slate-800">Sleep: </dt><dd className="inline">{log.sleepDurationMinutes} minutes</dd></div>}
            {log.sleepQuality !== null && <div><dt className="inline font-medium text-slate-800">Sleep quality: </dt><dd className="inline">{log.sleepQuality}/5</dd></div>}
            {log.mood && <div><dt className="inline font-medium text-slate-800">Mood: </dt><dd className="inline">{log.mood}</dd></div>}
            {log.waterMl !== null && <div><dt className="inline font-medium text-slate-800">Water: </dt><dd className="inline">{log.waterMl} ml</dd></div>}
            {log.activityMinutes !== null && <div><dt className="inline font-medium text-slate-800">Activity: </dt><dd className="inline">{log.activityMinutes} minutes</dd></div>}
          </dl>
          {log.notes && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{log.notes}</p>}
        </li>
      ))}
    </ol>
  );
}
