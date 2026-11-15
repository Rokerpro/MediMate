"use client";

import { useCallback, useEffect, useState } from "react";

import { listAssistantSessions } from "@/lib/api-client";
import type { PastAssessment } from "@/lib/validations";

// "Recent assistant conversations" on the health summary (contract §3c).
// Shows only what the user was already shown, labelled as user-reported and
// educational. Never presents a conversation as a diagnosis or a recorded fact.

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; sessions: PastAssessment[] };

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function RecentAssistantConversations() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { sessions } = await listAssistantSessions(5);
      setState({ status: "ready", sessions });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listAssistantSessions(5)
      .then(({ sessions }) => {
        if (!cancelled) setState({ status: "ready", sessions });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-labelledby="recent-conversations-heading"
      className="mt-6 rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm print:mt-4 print:border-[#cbd6c5] print:p-3 print:shadow-none"
    >
      <h2 id="recent-conversations-heading" className="text-lg font-semibold text-[#24352d]">
        Recent assistant conversations
      </h2>
      <p className="mt-1 text-sm text-[#5b6b61]">
        What the patient described to the MediMate assistant and the educational information they were shown. These are
        user-reported concerns, not diagnoses or clinician-checked records.
      </p>

      {state.status === "loading" && (
        <p role="status" className="mt-4 text-sm text-[#5b6b61]">
          Loading recent conversations…
        </p>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>We could not load recent assistant conversations.</p>
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
        <p className="mt-4 text-sm text-[#5b6b61]">No completed assistant conversations yet.</p>
      )}

      {state.status === "ready" && state.sessions.length > 0 && (
        <ol className="mt-4 space-y-4">
          {state.sessions.map((session) => (
            <ConversationItem key={session.sessionId} session={session} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ConversationItem({ session }: { session: PastAssessment }) {
  const { assessment } = session;
  return (
    <li className="rounded-lg border border-[#dfe3d6] p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <time dateTime={session.completedAt} className="font-medium text-[#24352d]">
          {formatDateTime(session.completedAt)}
        </time>
        <UrgencyBadge level={session.urgencyLevel} />
      </div>
      <p className="mt-2 text-sm text-[#24352d]">
        <span className="font-medium">Patient reported:</span> “{session.initialConcern}”
      </p>

      {session.urgencyLevel === "urgent" ? (
        <p className="mt-2 text-sm text-[#40564a]">
          The patient was advised to seek urgent care. No educational summary was given.
        </p>
      ) : assessment === null ? (
        <p className="mt-2 text-sm text-[#5b6b61]">Summary not available.</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm text-[#40564a]">
          <div>
            <h3 className="font-semibold text-[#24352d]">Educational summary shown</h3>
            <p className="mt-1">{assessment.summary}</p>
          </div>
          {assessment.possibleExplanations.length > 0 && (
            <div>
              <h3 className="font-semibold text-[#24352d]">Possibilities suggested to discuss with a clinician</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {assessment.possibleExplanations.map((explanation) => (
                  <li key={explanation.title}>{explanation.title}</li>
                ))}
              </ul>
            </div>
          )}
          {assessment.nextSteps.length > 0 && (
            <div>
              <h3 className="font-semibold text-[#24352d]">Next steps suggested</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {assessment.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}
          {assessment.sources.length > 0 && (
            <p>
              <span className="font-semibold text-[#24352d]">References: </span>
              {assessment.sources.map((source, index) => (
                <span key={source.url}>
                  {index > 0 && "; "}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#254a38] underline hover:text-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#c98b48] print:text-[#24352d] print:no-underline"
                  >
                    {source.title}
                  </a>{" "}
                  ({source.publisher})
                </span>
              ))}
            </p>
          )}
          <p className="border-t border-[#dfe3d6] pt-2 font-medium text-[#40564a]">{assessment.disclaimer}</p>
        </div>
      )}
    </li>
  );
}

function UrgencyBadge({ level }: { level: PastAssessment["urgencyLevel"] }) {
  if (level === "urgent") {
    return (
      <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-900">
        Urgent-care guidance was given
      </span>
    );
  }
  if (level === "prompt") {
    return (
      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Urgent GP / NHS 111 advice was given
      </span>
    );
  }
  return null;
}
