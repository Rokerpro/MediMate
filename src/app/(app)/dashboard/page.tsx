"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { TodayCheckIn } from "@/components/today-check-in";
import { WeeklySummary } from "@/components/weekly-summary";
import { ApiClientError, getHealthLogs, getProfile, listReminders } from "@/lib/api-client";
import type { HealthLog } from "@/lib/validations";
import { logsInWindow, summaryFigures } from "@/lib/health/trends";

type LogsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; logs: HealthLog[]; loadedAt: number };

type NextReminder = { title: string; dueAt: string; category: string } | null;

async function fetchLogs(): Promise<LogsState> {
  try {
    const response = await getHealthLogs(100);
    return { status: "ready", logs: response.logs, loadedAt: Date.now() };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ApiClientError
        ? error.message
        : "We could not load your recent logs. Please try again.",
    };
  }
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
    .toUpperCase();
}

function formatDue(value: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatSleep(minutes: number | null): string {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Pain per day for the last 7 days (null when nothing was recorded that day). */
function dailyPain(logs: readonly HealthLog[], now: number): { date: string; pain: number | null }[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * 86_400_000).toISOString().slice(0, 10);
    const levels = logs
      .filter((log) => log.loggedAt.slice(0, 10) === date && log.painLevel !== null)
      .map((log) => log.painLevel as number);
    return { date, pain: levels.length ? Math.max(...levels) : null };
  });
}

export default function DashboardPage() {
  const [logsState, setLogsState] = useState<LogsState>({ status: "loading" });
  const [name, setName] = useState<string | null>(null);
  const [nextReminder, setNextReminder] = useState<NextReminder | "loading">("loading");
  const [now] = useState(() => new Date());

  const reloadLogs = useCallback(async () => {
    setLogsState(await fetchLogs());
  }, []);

  useEffect(() => {
    let active = true;
    fetchLogs().then((result) => {
      if (active) setLogsState(result);
    });
    getProfile()
      .then(({ profile }) => {
        if (active) setName(profile.displayName.split(" ")[0] ?? null);
      })
      .catch(() => undefined);
    listReminders(false)
      .then(({ reminders }) => {
        if (!active) return;
        const upcoming = reminders.find((reminder) => reminder.nextDueAt);
        setNextReminder(
          upcoming?.nextDueAt
            ? { title: upcoming.title, dueAt: upcoming.nextDueAt, category: upcoming.category }
            : null,
        );
      })
      .catch(() => {
        if (active) setNextReminder(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const weekLogs = logsState.status === "ready"
    ? logsInWindow(logsState.logs, 7, logsState.loadedAt)
    : [];
  const figures = summaryFigures(weekLogs);
  const pains = weekLogs.map((log) => log.painLevel).filter((value): value is number => value !== null);
  const averagePain = pains.length
    ? Math.round((pains.reduce((sum, value) => sum + value, 0) / pains.length) * 10) / 10
    : null;
  const sleeps = weekLogs
    .map((log) => log.sleepDurationMinutes)
    .filter((value): value is number => value !== null);
  const averageSleep = sleeps.length ? sleeps.reduce((sum, value) => sum + value, 0) / sleeps.length : null;
  const bars = logsState.status === "ready" ? dailyPain(weekLogs, logsState.loadedAt) : [];
  const recent = logsState.status === "ready" ? logsState.logs.slice(0, 3) : [];

  const dateLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="landing-kicker">{dateLabel}</p>
          <h1 className="display-font mt-2 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-[#254a38] sm:text-5xl">
            {greeting(now.getHours())}{name ? `, ${name}` : ""}
          </h1>
        </div>
        <Link
          href="/assistant"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-[#254a38] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1c3a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 sm:self-auto"
        >
          Ask the assistant <span aria-hidden="true">→</span>
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <TodayCheckIn onSaved={() => void reloadLogs()} />

        <section
          aria-labelledby="week-heading"
          className="flex flex-col gap-4 rounded-3xl bg-[#254a38] p-5 text-[#f2eee2] sm:p-6"
        >
          <h2 id="week-heading" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d9c99f]">
            Last 7 days · recorded
          </h2>
          {logsState.status === "loading" ? (
            <p role="status" className="text-sm text-[#cfe0d2]">Loading…</p>
          ) : logsState.status === "error" ? (
            <p role="alert" className="text-sm text-[#f2eee2]">{logsState.message}</p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  { label: "Avg pain", value: averagePain === null ? "—" : `${averagePain}` },
                  { label: "Avg sleep", value: formatSleep(averageSleep) },
                  { label: "Logs", value: `${figures.logCount}` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-white/10 p-3 sm:p-4">
                    <dt className="text-xs text-[#d9c99f]">{stat.label}</dt>
                    <dd className="display-font mt-1 text-2xl font-semibold text-white">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <div aria-hidden="true" className="flex h-20 items-end gap-1.5">
                  {bars.map((bar, index) => (
                    <span
                      key={bar.date}
                      className={`flex-1 rounded-t-md ${
                        bar.pain === null ? "bg-white/10" : index === bars.length - 1 ? "bg-[#d9c99f]" : "bg-[#c8d4bf]"
                      }`}
                      style={{ height: bar.pain === null ? "6%" : `${Math.max(10, bar.pain * 10)}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#cfe0d2]">
                  Highest pain recorded each day. User-reported values, not diagnostic indicators.
                </p>
              </div>
            </>
          )}
          <Link
            href="/insights"
            className="dashboard-cta mt-auto inline-flex min-h-11 items-center gap-2 self-start rounded-full px-5 text-sm font-semibold transition-colors"
          >
            Open insights <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="recent-heading" className="rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="recent-heading" className="text-lg font-semibold text-[#243b30]">Recent history</h2>
            <Link href="/logs" className="rounded-md text-sm font-semibold text-[#254a38] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
              All logs →
            </Link>
          </div>
          {logsState.status === "loading" ? (
            <LoadingSkeleton label="Loading recent logs…" rows={2} />
          ) : logsState.status === "error" ? (
            <div role="alert" className="space-y-3 rounded-2xl bg-[#f3ede3] p-4 text-sm text-[#594a39]">
              <p>{logsState.message}</p>
              <button
                type="button"
                onClick={() => {
                  setLogsState({ status: "loading" });
                  void reloadLogs();
                }}
                className="rounded-full border border-[#aa916c] px-4 py-2 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
              >
                Retry
              </button>
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#cbd6c5] p-4 text-sm text-[#5b6b61]">
              No logs yet. Use today&apos;s check-in to add your first one.
            </p>
          ) : (
            <ol>
              {recent.map((log) => (
                <li key={log.id} className="flex gap-4 border-t border-[#eeece1] py-3.5 first:border-t-0">
                  <time dateTime={log.loggedAt} className="w-14 shrink-0 pt-0.5 text-xs font-bold text-[#8a6a47]">
                    {formatShortDate(log.loggedAt)}
                  </time>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-[#24352d]">{log.symptoms}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-[#40564a]">
                      {log.painLevel !== null && <span className="rounded-full bg-[#eeece1] px-2.5 py-1">Pain {log.painLevel}/10</span>}
                      {log.sleepDurationMinutes !== null && <span className="rounded-full bg-[#eeece1] px-2.5 py-1">Sleep {formatSleep(log.sleepDurationMinutes)}</span>}
                      {log.mood && <span className="rounded-full bg-[#eeece1] px-2.5 py-1">Mood {log.mood}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="reminder-heading" className="rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="reminder-heading" className="text-lg font-semibold text-[#243b30]">Next reminder</h2>
              <Link href="/reminders" className="rounded-md text-sm font-semibold text-[#254a38] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
                Manage →
              </Link>
            </div>
            {nextReminder === "loading" ? (
              <p role="status" className="text-sm text-[#5b6b61]">Loading…</p>
            ) : nextReminder ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f3f4ec] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#24352d]">{nextReminder.title}</p>
                  <p className="text-xs text-[#5b6b61]">{formatDue(nextReminder.dueAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#eeece1] px-2.5 py-1 text-xs font-semibold capitalize text-[#40564a]">
                  {nextReminder.category.replace("_", " ")}
                </span>
              </div>
            ) : (
              <p className="text-sm text-[#5b6b61]">No upcoming reminders.</p>
            )}
          </section>

          <Link
            href="/summary"
            className="group flex items-center justify-between gap-4 rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-5 transition-colors hover:bg-[#f3f4ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] sm:p-6"
          >
            <div>
              <p className="text-lg font-semibold text-[#243b30]">Doctor summary</p>
              <p className="mt-1 text-sm text-[#5b6b61]">Printable, clinician-readable</p>
            </div>
            <span className="rounded-full border border-[#cbd6c5] px-4 py-2 text-sm font-semibold text-[#254a38]">
              Open <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      </div>

      <WeeklySummary />
    </div>
  );
}
