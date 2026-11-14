"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PastAssessment } from "@/lib/validations";
import { ApiClientError, getPastAssessments } from "@/lib/api-client";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sessions: PastAssessment[] };

async function fetchSessions(): Promise<LoadState> {
  try {
    const response = await getPastAssessments(5);
    return { status: "ready", sessions: response.sessions };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ApiClientError
          ? error.message
          : "We could not load recent assistant conversations. Please try again.",
    };
  }
}

function formatCompletedAt(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function RecentAssistantConversations() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void fetchSessions().then((nextState) => {
      if (active) setState(nextState);
    });

    return () => {
      active = false;
    };
  }, []);

  async function load() {
    setState({ status: "loading" });
    setState(await fetchSessions());
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-slate-300 print:p-3 print:shadow-none">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Recent assistant conversations
      </h2>

      {state.status === "loading" && (
        <p role="status" className="text-sm text-slate-600">
          Loading completed assistant conversations…
        </p>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-red-800 px-3 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-600 print:hidden"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "ready" && state.sessions.length === 0 && (
        <div className="space-y-2 text-sm text-slate-700">
          <p>No completed assistant conversations yet.</p>
          <Link
            href="/assistant"
            className="inline-block font-medium text-blue-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            Start an assistant conversation
          </Link>
        </div>
      )}

      {state.status === "ready" && state.sessions.length > 0 && (
        <ol className="space-y-4">
          {state.sessions.map((session) => (
            <li
              key={session.sessionId}
              className="rounded-lg border border-slate-200 p-4 print:break-inside-avoid print:border-slate-300"
            >
              <time
                dateTime={session.completedAt}
                className="text-sm font-semibold text-slate-800"
              >
                Completed {formatCompletedAt(session.completedAt)} UTC
              </time>
              <p className="mt-2 break-words text-sm text-slate-800">
                <span className="font-semibold">You reported, in your own words: </span>
                {session.initialConcern}
              </p>

              {session.urgencyLevel === "urgent" ? (
                <div className="mt-3 space-y-2">
                  <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm font-bold text-red-900">
                    Urgent
                  </span>
                  <p className="font-semibold text-red-900">
                    Urgent-care guidance was given
                  </p>
                </div>
              ) : session.assessment ? (
                <AssessmentDetails assessment={session.assessment} />
              ) : (
                <p className="mt-3 text-sm text-slate-600">Summary not available</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AssessmentDetails({
  assessment,
}: {
  assessment: NonNullable<PastAssessment["assessment"]>;
}) {
  return (
    <div className="mt-3 space-y-4 text-sm text-slate-800">
      <p className="break-words">{assessment.summary}</p>

      <div>
        <h3 className="font-semibold">Possible explanations to discuss</h3>
        {assessment.possibleExplanations.length === 0 ? (
          <p className="mt-1 text-slate-600">No possible explanations were listed.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-2 pl-5">
            {assessment.possibleExplanations.map((explanation, index) => (
              <li key={`${explanation.title}-${index}`}>
                <p className="font-medium">{explanation.title}</p>
                <p className="mt-1 font-medium">Unknowns</p>
                {explanation.unknowns.length === 0 ? (
                  <p className="text-slate-600">No unknowns were listed.</p>
                ) : (
                  <ul className="list-[circle] space-y-1 pl-5 text-slate-700">
                    {explanation.unknowns.map((unknown, unknownIndex) => (
                      <li key={`${unknown}-${unknownIndex}`} className="break-words">
                        {unknown}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-semibold">Next steps</h3>
        {assessment.nextSteps.length === 0 ? (
          <p className="mt-1 text-slate-600">No next steps were listed.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {assessment.nextSteps.map((step, index) => (
              <li key={`${step}-${index}`} className="break-words">
                {step}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-semibold">Sources</h3>
        {assessment.sources.length === 0 ? (
          <p className="mt-1 text-slate-600">No sources were listed.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {assessment.sources.map((source) => (
              <li key={source.url} className="break-words">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-600 print:text-slate-900"
                >
                  {source.title} <span>({source.publisher})</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-700 print:border-slate-300">
        <span className="font-semibold">Disclaimer: </span>
        {assessment.disclaimer}
      </p>
    </div>
  );
}
