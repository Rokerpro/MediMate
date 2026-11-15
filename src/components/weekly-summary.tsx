"use client";

import { useState } from "react";

import { ApiClientError, generateWeeklySummary } from "@/lib/api-client";
import type { WeeklySummaryResponse } from "@/lib/validations";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "ready"; result: WeeklySummaryResponse };

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** "This week's summary": an on-demand, educational AI summary of the last 7 days of logs. */
export function WeeklySummary() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function generate() {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", result: await generateWeeklySummary() });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof ApiClientError ? error.message : "The weekly summary could not be generated. Please try again.",
        retryable: error instanceof ApiClientError ? error.retryable : true,
      });
    }
  }

  const result = state.status === "ready" ? state.result : null;

  return (
    <section
      aria-labelledby="weekly-summary-heading"
      className="rounded-[2rem] border border-[#d8d6c9] bg-[#eeece1] p-5 shadow-[0_20px_55px_-42px_rgba(37,74,56,0.35)] sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89754d]">AI summary</p>
          <h2 id="weekly-summary-heading" className="display-font mt-2 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#243b30] sm:text-4xl">
            This week&apos;s summary
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5b6b61]">
            An educational look at what your logs from the last 7 days recorded. It is not a diagnosis and is not saved.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={state.status === "loading"}
          className="min-h-11 rounded-full bg-[#254a38] px-5 py-2.5 text-sm font-semibold text-[#fbfaf5] transition-colors hover:bg-[#1c3a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eeece1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.status === "loading" ? "Summarising…" : result ? "Generate again" : "Generate summary"}
        </button>
      </div>

      <div aria-live="polite" className="mt-6">
        {state.status === "loading" && (
          <p role="status" className="text-sm text-[#5b6b61]">
            Reading your logs from the last 7 days…
          </p>
        )}

        {state.status === "error" && (
          <div role="alert" className="rounded-xl border border-[#e7b9a8] bg-[#fbeee8] px-4 py-3 text-sm text-[#7a3520]">
            <p>{state.message}</p>
            {state.retryable && (
              <button
                type="button"
                onClick={() => void generate()}
                className="mt-2 font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {result?.status === "no_data" && (
          <p className="rounded-2xl border border-dashed border-[#cfd6c8] bg-[#fbfaf5]/70 px-4 py-5 text-sm leading-6 text-[#5b6b61]">
            {result.assistantMessage}
          </p>
        )}

        {result?.status === "urgent" && (
          <div role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-5 text-red-950">
            <p className="text-sm font-bold uppercase tracking-wide">Urgent safety guidance</p>
            <p className="mt-2 font-semibold">{result.safety.message}</p>
            <p className="mt-3 text-sm">{result.assistantMessage}</p>
          </div>
        )}

        {result?.status === "summary" && result.assessment && (
          <div className="space-y-5 rounded-2xl border border-[#dfe3d6] bg-[#fbfaf5] p-4 text-[#24352d] sm:p-6">
            <p className="text-xs text-[#6b776f]">
              {formatDate(result.weekStart)} – {formatDate(result.weekEnd)} · {result.logCount}{" "}
              {result.logCount === 1 ? "log" : "logs"}
            </p>

            {result.safety.level === "prompt" && (
              <p role="status" className="rounded-2xl border border-[#d5a856] bg-[#fbf0d7] px-4 py-3 text-sm leading-6 text-[#654a2e]">
                Contact a GP or NHS 111 today. {result.safety.message}
              </p>
            )}

            <div>
              <p className="text-sm text-[#40564a]">{result.assistantMessage}</p>
              <p className="mt-2 leading-7">{result.assessment.summary}</p>
            </div>

            {result.assessment.possibleExplanations.length > 0 && (
              <div>
                <h3 className="font-semibold text-[#243b30]">Patterns in your logs to discuss with a clinician</h3>
                <ul className="mt-3 space-y-3">
                  {result.assessment.possibleExplanations.map((pattern, index) => (
                    <li key={`${pattern.title}-${index}`} className="rounded-2xl border border-[#e2e5da] bg-white/80 p-4">
                      <p className="font-medium">{pattern.title}</p>
                      <p className="mt-1 text-sm text-[#5b6b61]">{pattern.whyItMayBeRelevant}</p>
                      {pattern.supportingHistory.length > 0 && (
                        <div className="mt-3 border-t border-[#eef0e8] pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b776f]">From your logs</p>
                          <ul className="mt-1 space-y-1 text-sm text-[#5b6b61]">
                            {pattern.supportingHistory.map((entry) => (
                              <li key={entry.logId}>
                                <time dateTime={entry.date} className="font-medium text-[#24352d]">
                                  {formatDate(entry.date)}
                                </time>
                                : {entry.observation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pattern.unknowns.length > 0 && (
                        <p className="mt-2 text-xs text-[#6b776f]">Not known yet: {pattern.unknowns.join("; ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-[#243b30]">Next steps</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {result.assessment.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>

            {result.assessment.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#243b30]">Sources</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.assessment.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words text-[#254a38] underline underline-offset-2 hover:text-[#1c3a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
                      >
                        {source.title}
                      </a>{" "}
                      <span className="text-[#6b776f]">({source.publisher})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="rounded-xl bg-[#f5ead9] px-4 py-3 text-xs leading-5 text-[#654a2e]">
              {result.assessment.disclaimer}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
