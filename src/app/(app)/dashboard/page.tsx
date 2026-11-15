"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HealthTrends } from "@/components/health-trends";
import { WeeklySummary } from "@/components/weekly-summary";
import { ApiClientError, getHealthLogs } from "@/lib/api-client";
import type { HealthLog } from "@/lib/validations";
import { TREND_DAYS, logsInWindow, summaryFigures } from "@/lib/health/trends";

type InsightsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; logs: HealthLog[]; loadedAt: number };

async function fetchInsights(): Promise<InsightsState> {
  try {
    const response = await getHealthLogs(100);
    return { status: "ready", logs: response.logs, loadedAt: Date.now() };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ApiClientError
        ? error.message
        : "We could not load your health insights. Please try again.",
    };
  }
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

export default function DashboardPage() {
  const [insights, setInsights] = useState<InsightsState>({ status: "loading" });

  const loadInsights = useCallback(async () => {
    setInsights({ status: "loading" });
    setInsights(await fetchInsights());
  }, []);

  useEffect(() => {
    let active = true;
    fetchInsights().then((result) => {
      if (active) setInsights(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const windowLogs = insights.status === "ready"
    ? logsInWindow(insights.logs, TREND_DAYS, insights.loadedAt)
    : [];
  const figures = insights.status === "ready" ? summaryFigures(windowLogs) : null;
  const latestObservation = windowLogs[0] ?? null;

  return (
    <div className="space-y-10 pb-8 sm:space-y-14">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89754d]">
            MediMate / Demo workspace
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-[#243b30] sm:text-5xl lg:text-6xl">
            A clearer view of your health story.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5e6b61] sm:text-lg">
            Organize your profile and daily observations, then bring that context into a conversation.
          </p>
        </div>
        <aside className="rounded-2xl border border-[#d8d6c9] bg-[#eeece1] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dce2d2] text-[#365642]">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M5 18.5V6.8c0-.7.6-1.3 1.3-1.3h11.4c.7 0 1.3.6 1.3 1.3v10.4c0 .7-.6 1.3-1.3 1.3H5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M8 9h8M8 12.5h8M8 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold tracking-wide text-[#304739]">A thoughtful starting point</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#5e6b61]">
            Keep dated observations together and review the relevant synthetic history used in a conversation.
          </p>
          <div className="mt-5 h-px bg-[#d4d3c7]" />
          <p className="mt-4 text-xs leading-5 text-[#6d7568]">
            Educational information only. MediMate does not diagnose or replace care from a qualified professional.
          </p>
        </aside>
      </section>

      <section aria-labelledby="workspace-tools-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#89754d]">Your workspace</p>
            <h2 id="workspace-tools-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#243b30]">
              Choose a starting point
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#6c756d]">
            Each space helps you keep your own information organized.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
        <Link
          href="/profile"
          className="group rounded-2xl border border-[#deded4] bg-[#fbfaf6] p-5 transition-colors duration-200 hover:border-[#aab49b] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949] sm:p-6 lg:col-span-5 lg:col-start-8 lg:row-start-1"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8eadf] text-[#536647]">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5.5 19c.6-3 2.8-4.5 6.5-4.5s5.9 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-xs font-semibold tracking-[0.14em] text-[#9a8054]">01 / PROFILE</span>
          </div>
          <h3 className="mt-8 text-xl font-semibold tracking-[-0.025em] text-[#304739]">Personal profile</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#657168]">
            Review and update your synthetic profile details.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d6149]">
            Review profile
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </Link>

        <Link
          href="/logs"
          className="group rounded-2xl border border-[#deded4] bg-[#f0eee3] p-5 transition-colors duration-200 hover:border-[#b8ac8c] hover:bg-[#f5f3e9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949] sm:p-6 lg:col-span-5 lg:col-start-8 lg:row-start-2"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4e1d2] text-[#756344]">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M6.5 4.5h11A1.5 1.5 0 0 1 19 6v14H5V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-xs font-semibold tracking-[0.14em] text-[#9a8054]">02 / DAILY LOGS</span>
          </div>
          <h3 className="mt-8 text-xl font-semibold tracking-[-0.025em] text-[#304739]">Daily observations</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#657168]">
            Add an observation and revisit your dated timeline.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d6149]">
            Open daily logs
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </Link>

        <Link
          href="/assistant"
          className="group order-first relative overflow-hidden rounded-2xl border border-[#284537] bg-[#284537] p-6 text-[#f7f5ed] transition-colors duration-200 hover:bg-[#315440] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949] sm:p-8 lg:order-none lg:col-span-7 lg:row-span-2"
        >
          <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-[#e2d3ac]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                  <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4.7A2.5 2.5 0 0 1 5 13.5v-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M8.5 8.5h7M8.5 11.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-xs font-semibold tracking-[0.14em] text-[#d9c99f]">03 / ASSISTANT</span>
            </div>
            <div className="mt-auto max-w-lg pt-14">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d9c99f]">History-aware conversation</p>
              <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                Discuss a concern with context.
              </h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#e1e7df] sm:text-base">
                Explore educational information with relevant synthetic history shown alongside the conversation.
              </p>
              <span className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#f2eee2] px-4 py-3 text-sm font-semibold text-[#284537] transition-colors duration-200 group-hover:bg-white">
                Open assistant
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </span>
            </div>
          </div>
        </Link>
        </div>
      </section>

      <section aria-labelledby="insights-heading" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#89754d]">
              Last {TREND_DAYS} days
            </p>
            <h2 id="insights-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#243b30]">
              Personal health insights
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#6c756d]">
            User-reported measurements, not diagnostic indicators.
          </p>
        </div>

        {insights.status === "loading" ? (
          <p role="status" className="rounded-2xl border border-[#deded4] bg-[#fbfaf6] p-5 text-sm text-[#5e6b61]">
            Loading your recent health insights…
          </p>
        ) : null}

        {insights.status === "error" ? (
          <div role="alert" className="rounded-2xl border border-[#d8c6b1] bg-[#f3ede3] p-5 text-[#594a39]">
            <p>{insights.message}</p>
            <button
              type="button"
              onClick={() => void loadInsights()}
              className="mt-4 rounded-lg border border-[#aa916c] px-4 py-2 text-sm font-semibold text-[#4c5c48] transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {insights.status === "ready" && figures ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InsightTile
                label="Logs recorded"
                value={`${figures.logCount}`}
                detail={`in the last ${TREND_DAYS} days`}
              />
              <InsightTile
                label="Average recorded sleep"
                value={figures.averageSleepHours === null ? "—" : `${figures.averageSleepHours} h`}
                detail="based on recorded sleep entries"
              />
              <InsightTile
                label="Highest pain recorded"
                value={figures.highestPain ? `${figures.highestPain.level}/10` : "—"}
                detail={figures.highestPain ? formatDate(figures.highestPain.date) : "No pain level recorded"}
              />
              <Link
                href="/logs"
                aria-label={latestObservation
                  ? `Open daily logs. Latest observation: ${latestObservation.symptoms}, ${formatDate(latestObservation.loggedAt)}`
                  : "Open daily logs. No recent observation recorded."}
                className="group min-w-0 rounded-2xl border border-[#d8d6c9] bg-[#eeece1] p-5 transition-colors hover:border-[#b8ac8c] hover:bg-[#f5f3e9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b704f]">
                  Latest observation
                </p>
                <p className="mt-3 line-clamp-2 min-h-12 text-base font-semibold leading-6 text-[#304739]">
                  {latestObservation?.symptoms ?? "No recent observation"}
                </p>
                <p className="mt-2 text-xs text-[#6d7568]">
                  {latestObservation ? formatDate(latestObservation.loggedAt) : "No logs in this period"}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3d6149]">
                  View daily logs
                  <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </div>

            {windowLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d8d6c9] p-4 text-sm text-[#657168]">
                No daily logs were recorded in the last {TREND_DAYS} days.
              </p>
            ) : null}

            <HealthTrends logs={windowLogs} now={insights.loadedAt} />
          </div>
        ) : null}
      </section>

      <WeeklySummary />
    </div>
  );
}

function InsightTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Link
      href="/logs"
      className="group min-w-0 rounded-2xl border border-[#deded4] bg-[#fbfaf6] p-5 transition-colors hover:border-[#aab49b] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b704f]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#304739]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#6d7568]">{detail}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3d6149]">
        View daily logs
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}
