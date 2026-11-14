"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HealthLog } from "@/lib/validations";
import { getHealthLogs } from "@/lib/api-client";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateHeading(date: string, today: string) {
  if (date === today) return "Today";

  const yesterday = new Date(`${today}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Yesterday";

  return formatDate(`${date}T00:00:00.000Z`);
}

function formatSleep(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `Sleep ${hours}h ${remainingMinutes}m`;
}

export function HealthLogTimeline({ newLog }: { newLog: HealthLog | null }) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await getHealthLogs();
      setLogs(response.logs);
      setLoadedAt(Date.now());
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
        if (active) {
          setLogs(response.logs);
          setLoadedAt(Date.now());
        }
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
  const sortedLogs = [...displayedLogs].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  const groupedLogs: { date: string; logs: HealthLog[] }[] = [];

  for (const log of sortedLogs) {
    const date = log.loggedAt.slice(0, 10);
    const currentGroup = groupedLogs[groupedLogs.length - 1];
    if (currentGroup?.date === date) {
      currentGroup.logs.push(log);
    } else {
      groupedLogs.push({ date, logs: [log] });
    }
  }

  const today = loadedAt === null ? "" : new Date(loadedAt).toISOString().slice(0, 10);
  const summaryLink = (
    <Link
      href="/summary"
      className="inline-flex items-center gap-2 text-sm font-semibold text-[#3d6149] underline decoration-[#aab49b] underline-offset-4 hover:text-[#284537] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
    >
      View health summary <span aria-hidden="true">→</span>
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-[#5e6b61]">Loading your daily logs…</p>
        {summaryLink}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <div role="alert" className="space-y-3 rounded-xl border border-[#d8c6b1] bg-[#f3ede3] p-4 text-[#594a39]">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="rounded-lg border border-[#aa916c] px-3 py-2 text-sm font-semibold text-[#4c5c48] transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
          >
            Retry
          </button>
        </div>
        {summaryLink}
      </div>
    );
  }

  if (sortedLogs.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-dashed border-[#d8d6c9] p-6 text-[#657168]">
          No daily logs yet. Add your first observation above.
        </p>
        {summaryLink}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {groupedLogs.map((group) => (
        <section
          key={group.date}
          aria-labelledby={`timeline-date-${group.date}`}
          className="space-y-3"
        >
          <h3
            id={`timeline-date-${group.date}`}
            className="text-sm font-semibold uppercase tracking-[0.12em] text-[#756b50]"
          >
            {formatDateHeading(group.date, today)}
          </h3>
          <ol className="relative space-y-4 border-l border-[#d6d8cc] pl-5 sm:pl-6">
            {group.logs.map((log) => (
              <li key={log.id} className="relative">
                <span
                  className="absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-[#f7f5ed] bg-[#788467] sm:-left-[31px]"
                  aria-hidden="true"
                />
                <article className="rounded-2xl border border-[#deded4] bg-[#fbfaf6] p-4 sm:p-5">
                  <time dateTime={log.loggedAt} className="text-xs font-medium text-[#746b52]">
                    {formatDate(log.loggedAt)}
                  </time>
                  <h4 className="mt-2 font-semibold text-[#304739]">{log.symptoms}</h4>
                  <ul aria-label="Recorded measurements" className="mt-3 flex flex-wrap gap-2 text-xs text-[#526258]">
                    {log.painLevel !== null ? (
                      <li className="rounded-full border border-[#d9d8ca] bg-[#f0eee3] px-3 py-1.5">
                        Pain {log.painLevel}/10
                      </li>
                    ) : null}
                    {log.sleepDurationMinutes !== null ? (
                      <li className="rounded-full border border-[#d9d8ca] bg-[#f0eee3] px-3 py-1.5">
                        {formatSleep(log.sleepDurationMinutes)}
                      </li>
                    ) : null}
                    {log.sleepQuality !== null ? (
                      <li className="rounded-full border border-[#deded4] bg-white px-3 py-1.5">
                        Sleep quality {log.sleepQuality}/5
                      </li>
                    ) : null}
                  </ul>
                  <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm text-[#657168] sm:grid-cols-2">
                    {log.painLocation ? (
                      <div><dt className="inline font-medium text-[#46564b]">Location: </dt><dd className="inline">{log.painLocation}</dd></div>
                    ) : null}
                    {log.mood ? (
                      <div><dt className="inline font-medium text-[#46564b]">Mood: </dt><dd className="inline">{log.mood}</dd></div>
                    ) : null}
                    {log.waterMl !== null ? (
                      <div><dt className="inline font-medium text-[#46564b]">Water: </dt><dd className="inline">{log.waterMl} ml</dd></div>
                    ) : null}
                    {log.activityMinutes !== null ? (
                      <div><dt className="inline font-medium text-[#46564b]">Activity: </dt><dd className="inline">{log.activityMinutes} minutes</dd></div>
                    ) : null}
                  </dl>
                  {log.notes ? (
                    <p className="mt-3 border-t border-[#e7e5dc] pt-3 text-sm leading-6 text-[#657168]">
                      {log.notes}
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {summaryLink}
    </div>
  );
}
