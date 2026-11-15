"use client";

import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { useEffect, useState } from "react";

import { TrendChart } from "@/components/health-trends";
import { ApiClientError, getHealthAnalytics } from "@/lib/api-client";
import type { AnalyticsMeasure, AnalyticsResponse, SymptomAnalytics } from "@/lib/validations";

type WindowDays = 7 | 14 | 30;
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AnalyticsResponse };

const directionLabels: Record<SymptomAnalytics["severityChange"]["direction"], string> = {
  higher: "Higher in the later half of the selected period.",
  lower: "Lower in the later half of the selected period.",
  about_the_same: "About the same across the two halves.",
  not_enough_data: "Not enough data yet.",
};

const measureLabels: Record<AnalyticsMeasure, string> = {
  sleepHours: "sleep",
  sleepQuality: "sleep quality",
  activityMinutes: "activity",
  waterMl: "water",
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatAverage(measure: AnalyticsMeasure, value: number): string {
  switch (measure) {
    case "sleepHours":
      return `${value.toFixed(1)} h`;
    case "sleepQuality":
      return `${value.toFixed(1)}/5`;
    case "activityMinutes":
      return `${Math.round(value)} min`;
    case "waterMl":
      return `${Math.round(value)} ml`;
  }
}

function evidenceLinks(ids: string[], datesByLogId: Map<string, string>) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {ids.map((id) => {
        const date = datesByLogId.get(id);
        return (
          <li key={id}>
            <Link
              href="/logs"
              aria-label={date ? `View daily logs, including the record dated ${formatDate(date)}` : "View daily logs"}
              className="font-medium text-[#254a38] underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
            >
              {date ? formatDate(date) : "View recorded log"}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SymptomCard({
  symptom,
  maxLogCount,
  datesByLogId,
}: {
  symptom: SymptomAnalytics;
  maxLogCount: number;
  datesByLogId: Map<string, string>;
}) {
  const { severity, severityChange, recurrence } = symptom;
  const painRange = severity.lowest === severity.highest
    ? `${severity.lowest}`
    : `${severity.lowest}–${severity.highest}`;

  return (
    <article className="rounded-2xl border border-[#deded4] bg-[#fbfaf6] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold capitalize text-[#304739]">{symptom.topic}</h3>
        <p className="text-sm text-[#657168]">
          {symptom.logCount} {symptom.logCount === 1 ? "log" : "logs"} · {symptom.dayCount}{" "}
          {symptom.dayCount === 1 ? "day" : "days"}
        </p>
      </div>
      <div
        role="meter"
        aria-label={`${symptom.topic}: ${symptom.logCount} symptom logs`}
        aria-valuemin={0}
        aria-valuemax={maxLogCount}
        aria-valuenow={symptom.logCount}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e8eadf]"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-[#788467]"
          style={{ width: `${(symptom.logCount / maxLogCount) * 100}%` }}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-[#40564a]">Recorded pain</h4>
          {severity.recordedCount > 0 && severity.lowest !== null && severity.highest !== null && severity.average !== null ? (
            <p className="mt-1 text-sm text-[#657168]">
              {painRange}/10 range, average {severity.average.toFixed(1)}/10 ({severity.recordedCount}{" "}
              {severity.recordedCount === 1 ? "measurement" : "measurements"}).
            </p>
          ) : (
            <p className="mt-1 text-sm text-[#657168]">No pain level recorded for this topic.</p>
          )}
          {severityChange.direction === "not_enough_data" ? (
            <p className="mt-2 text-sm font-medium text-[#526258]">Not enough data yet.</p>
          ) : (
            <>
              {severityChange.earlierAverage !== null && severityChange.laterAverage !== null && (
                <p className="mt-2 text-sm text-[#657168]">
                  Average recorded pain: {severityChange.earlierAverage.toFixed(1)}/10 earlier →{" "}
                  {severityChange.laterAverage.toFixed(1)}/10 later.
                </p>
              )}
              <p className="mt-1 text-sm font-medium text-[#526258]">{directionLabels[severityChange.direction]}</p>
            </>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-[#40564a]">Recurrence</h4>
          <p className="mt-1 text-sm text-[#657168]">
            {recurrence.episodes} separate {recurrence.episodes === 1 ? "stretch" : "stretches"}; longest{" "}
            {recurrence.longestEpisodeDays} {recurrence.longestEpisodeDays === 1 ? "day" : "days"}.
          </p>
          <p className="mt-1 text-xs text-[#657168]">
            First recorded {formatDate(recurrence.firstDate)} · most recent {formatDate(recurrence.lastDate)}
          </p>
        </div>
      </div>

      {symptom.evidenceLogIds.length > 0 && (
        <details className="mt-4 border-t border-[#e7e5dc] pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#40564a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]">
            Evidence ({symptom.evidenceLogIds.length} {symptom.evidenceLogIds.length === 1 ? "log" : "logs"})
          </summary>
          {evidenceLinks(symptom.evidenceLogIds, datesByLogId)}
        </details>
      )}
    </article>
  );
}

function TrendCharts({ data }: { data: AnalyticsResponse }) {
  const maxSleep = Math.max(10, ...data.daily.map((point) => point.sleepHours ?? 0));
  const sleepMax = Math.ceil(maxSleep / 2) * 2;

  return (
    <section aria-labelledby="daily-trends-heading" className="space-y-4">
      <div>
        <h2 id="daily-trends-heading" className="text-xl font-semibold text-[#304739]">Daily trends</h2>
        <p className="mt-1 text-sm text-[#657168]">Only recorded values are plotted; missing values remain gaps.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TrendChart
          title="Pain level"
          unitLabel="0–10, highest recorded each day"
          points={data.daily}
          value={(point) => point.painLevel}
          yMax={10}
          yTicks={[0, 5, 10]}
          format={(value) => `${value}/10`}
        />
        <TrendChart
          title="Sleep duration"
          unitLabel="hours"
          points={data.daily}
          value={(point) => point.sleepHours}
          yMax={sleepMax}
          yTicks={[0, sleepMax / 2, sleepMax]}
          format={(value) => `${value} h`}
        />
      </div>
    </section>
  );
}

const INITIAL_TOPICS = 3;
const INITIAL_ASSOCIATIONS = 3;

function ShowMoreButton({
  expanded,
  hiddenCount,
  noun,
  controls,
  onToggle,
}: {
  expanded: boolean;
  hiddenCount: number;
  noun: string;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#cbd6c5] px-5 py-2 text-sm font-semibold text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
    >
      {expanded ? `Show fewer ${noun}` : `Show ${hiddenCount} more ${noun}`}
      <span aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
    </button>
  );
}

function AnalyticsResults({ data }: { data: AnalyticsResponse }) {
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllAssociations, setShowAllAssociations] = useState(false);
  const visibleSymptoms = showAllTopics ? data.symptoms : data.symptoms.slice(0, INITIAL_TOPICS);
  const visibleAssociations = showAllAssociations
    ? data.associations
    : data.associations.slice(0, INITIAL_ASSOCIATIONS);
  const datesByLogId = new Map<string, string>();
  const maxSymptomLogCount = Math.max(0, ...data.symptoms.map((symptom) => symptom.logCount));
  for (const day of data.daily) {
    for (const id of day.logIds) datesByLogId.set(id, day.date);
  }

  if (data.logCount === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-dashed border-[#d8d6c9] bg-[#fbfaf6] p-6 text-sm leading-6 text-[#657168]">
          Add a few daily logs to see patterns.
        </p>
        <p className="rounded-xl bg-[#f5ead9] px-4 py-3 text-sm leading-6 text-[#654a2e]">{data.note}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-[#657168]">
        {formatDate(data.windowStart)} – {formatDate(data.windowEnd)} · {data.logCount}{" "}
        {data.logCount === 1 ? "log" : "logs"}
      </p>

      <section aria-labelledby="symptom-frequency-heading" className="space-y-4">
        <div>
          <h2 id="symptom-frequency-heading" className="text-xl font-semibold text-[#304739]">Symptom frequency</h2>
          <p className="mt-1 text-sm text-[#657168]">Topics are counted from the words in your logs.</p>
        </div>
        {data.symptoms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d8d6c9] p-4 text-sm text-[#657168]">
            No symptom topics were recorded in this period.
          </p>
        ) : (
          <div className="space-y-4">
            <div id="symptom-topic-list" className="space-y-4">
              {visibleSymptoms.map((symptom) => (
                <SymptomCard
                  key={symptom.topic}
                  symptom={symptom}
                  maxLogCount={maxSymptomLogCount}
                  datesByLogId={datesByLogId}
                />
              ))}
            </div>
            {data.symptoms.length > INITIAL_TOPICS && (
              <ShowMoreButton
                expanded={showAllTopics}
                hiddenCount={data.symptoms.length - INITIAL_TOPICS}
                noun={data.symptoms.length - INITIAL_TOPICS === 1 && !showAllTopics ? "topic" : "topics"}
                controls="symptom-topic-list"
                onToggle={() => setShowAllTopics((value) => !value)}
              />
            )}
          </div>
        )}
      </section>

      <TrendCharts data={data} />

      <section aria-labelledby="recorded-together-heading" className="space-y-4">
        <div>
          <h2 id="recorded-together-heading" className="text-xl font-semibold text-[#304739]">Recorded together</h2>
        </div>
        {data.associations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d8d6c9] p-4 text-sm text-[#657168]">
            There are not enough recorded days to compare patterns yet.
          </p>
        ) : (
          <div className="space-y-4">
          <ul id="recorded-together-list" className="space-y-3">
            {visibleAssociations.map((association, index) => (
              <li key={`${association.topic}-${association.measure}-${index}`} className="rounded-2xl border border-[#deded4] bg-[#fbfaf6] p-5">
                <p className="text-sm leading-6 text-[#40564a]">
                  On days with <span className="font-semibold">{association.topic}</span> logged:{" "}
                  <span className="font-semibold">{formatAverage(association.measure, association.averageWithTopic)}</span>{" "}
                  {measureLabels[association.measure]} on average ({association.daysWithTopic}{" "}
                  {association.daysWithTopic === 1 ? "day" : "days"}) vs{" "}
                  <span className="font-semibold">{formatAverage(association.measure, association.averageWithout)}</span>{" "}
                  on other days ({association.daysWithout} {association.daysWithout === 1 ? "day" : "days"}).
                </p>
                {association.evidenceLogIds.length > 0 && (
                  <details className="mt-3 border-t border-[#e7e5dc] pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-[#40564a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]">
                      Evidence ({association.evidenceLogIds.length}{" "}
                      {association.evidenceLogIds.length === 1 ? "log" : "logs"})
                    </summary>
                    {evidenceLinks(association.evidenceLogIds, datesByLogId)}
                  </details>
                )}
              </li>
            ))}
          </ul>
            {data.associations.length > INITIAL_ASSOCIATIONS && (
              <ShowMoreButton
                expanded={showAllAssociations}
                hiddenCount={data.associations.length - INITIAL_ASSOCIATIONS}
                noun={data.associations.length - INITIAL_ASSOCIATIONS === 1 && !showAllAssociations ? "comparison" : "comparisons"}
                controls="recorded-together-list"
                onToggle={() => setShowAllAssociations((value) => !value)}
              />
            )}
          </div>
        )}
      </section>

      <p className="rounded-xl bg-[#f5ead9] px-4 py-3 text-sm leading-6 text-[#654a2e]">{data.note}</p>
      <Link
        href="/logs"
        className="inline-flex rounded-lg font-semibold text-[#254a38] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
      >
        Review daily logs
      </Link>
    </div>
  );
}

export function HealthAnalytics() {
  const [days, setDays] = useState<WindowDays>(30);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getHealthAnalytics(days)
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof ApiClientError
            ? error.message
            : "The analytics response could not be verified. Please try again.",
        });
      });
    return () => {
      active = false;
    };
  }, [days, retry]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-8">
      <PageHeader
        eyebrow="Your workspace / Insights"
        title="Health insights"
        description="A descriptive view of patterns in your own logs, based only on what was recorded."
        actions={
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-[#40564a]">Time period</legend>
            <div className="inline-flex rounded-full border border-[#cbd6c5] bg-[#fffdf8] p-1">
              {([7, 14, 30] as const).map((option) => (
                <label
                  key={option}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#c98b48] ${
                    days === option ? "bg-[#254a38] text-[#fbfaf5]" : "text-[#40564a] hover:bg-[#eef0e5]"
                  }`}
                >
                  <input
                    type="radio"
                    name="analytics-window"
                    value={option}
                    checked={days === option}
                    onChange={() => {
                      setState({ status: "loading" });
                      setDays(option);
                    }}
                    className="sr-only"
                  />
                  {option} days
                </label>
              ))}
            </div>
          </fieldset>
        }
      />

      {state.status === "loading" && (
        <LoadingSkeleton label="Loading your health insights…" rows={3} />
      )}

      {state.status === "error" && (
        <div role="alert" className="rounded-2xl border border-[#d8c6b1] bg-[#f3ede3] p-5 text-sm text-[#594a39]">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setRetry((current) => current + 1);
            }}
            className="mt-4 rounded-lg border border-[#aa916c] px-4 py-2 font-semibold text-[#4c5c48] transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7949]"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "ready" && <AnalyticsResults data={state.data} />}
    </div>
  );
}
