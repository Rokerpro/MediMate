"use client";

import { useState } from "react";
import type { ChatResponse } from "@/lib/validations";
import { sendAssistantMessage } from "@/lib/api-client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AssistantChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitMessage(message = input) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || loading) return;

    setInput("");
    setErrorMessage(null);
    setLastSubmittedMessage(trimmedMessage);
    setMessages((current) => [
      ...current,
      { id: makeMessageId(), role: "user", content: trimmedMessage },
    ]);
    setLoading(true);

    try {
      const response = await sendAssistantMessage({ sessionId, message: trimmedMessage });
      setSessionId(response.sessionId);
      setLatestResponse(response);
      setMessages((current) => [
        ...current,
        { id: makeMessageId(), role: "assistant", content: response.assistantMessage },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The assistant is temporarily unavailable. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setSessionId(null);
    setMessages([]);
    setLatestResponse(null);
    setInput("");
    setLastSubmittedMessage(null);
    setErrorMessage(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Conversation</h2>
            <p className="mt-1 text-sm text-slate-600">
              Share one concern at a time. This demo provides educational information, not a diagnosis.
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startOver}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              Start over
            </button>
          )}
        </div>

        <div
          aria-live="polite"
          className="mt-6 min-h-56 space-y-4 rounded-lg bg-slate-50 p-4"
        >
          {messages.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              No messages yet. Describe what you have noticed.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))
          )}
          {loading && (
            <p role="status" className="text-sm text-slate-600">
              Assistant is thinking…
            </p>
          )}
        </div>

        {latestResponse?.status === "follow_up" && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-950">Helpful follow-up questions</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {latestResponse.followUpQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void submitMessage(question)}
                  disabled={loading}
                  className="rounded-full border border-blue-300 bg-white px-3 py-2 text-left text-sm text-blue-950 hover:bg-blue-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
            <p>{errorMessage}</p>
            {lastSubmittedMessage && (
              <button
                type="button"
                onClick={() => void submitMessage(lastSubmittedMessage)}
                disabled={loading}
                className="mt-3 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage();
          }}
          className="mt-5"
        >
          <label htmlFor="assistant-message" className="block text-sm font-medium text-slate-800">
            Message
          </label>
          <textarea
            id="assistant-message"
            rows={3}
            maxLength={2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="For example: My lower back has been uncomfortable since yesterday."
            disabled={loading}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">Do not enter real health information.</p>
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              className="rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {loading ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </section>

      <AssistantResult response={latestResponse} />
    </div>
  );
}

function AssistantResult({ response }: { response: ChatResponse | null }) {
  if (!response) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
        Your follow-up questions and educational assessment will appear here.
      </aside>
    );
  }

  if (response.status === "urgent") {
    return (
      <aside
        role="alert"
        className="h-fit rounded-xl border-2 border-red-600 bg-red-50 p-6 text-red-950 shadow-sm"
      >
        <p className="text-sm font-bold uppercase tracking-wide">Urgent safety guidance</p>
        <h2 className="mt-2 text-xl font-semibold">Please seek professional help</h2>
        <p className="mt-3">{response.safety.message}</p>
        <p className="mt-4 text-sm">{response.assistantMessage}</p>
      </aside>
    );
  }

  if (response.status === "follow_up") {
    return (
      <aside className="h-fit rounded-xl border border-blue-200 bg-blue-50 p-6 text-blue-950">
        <h2 className="text-xl font-semibold">More information needed</h2>
        <p className="mt-2 text-sm">
          The assistant is asking focused questions before offering an educational summary.
        </p>
      </aside>
    );
  }

  const assessment = response.assessment;
  if (!assessment) return null;

  return (
    <aside className="h-fit space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Educational assessment</p>
        <h2 className="mt-1 text-xl font-semibold">What the information may suggest</h2>
        <p className="mt-3 text-slate-700">{assessment.summary}</p>
      </div>

      <section aria-labelledby="explanations-heading">
        <h3 id="explanations-heading" className="font-semibold">Possible explanations to discuss with a clinician</h3>
        <div className="mt-3 space-y-4">
          {assessment.possibleExplanations.map((explanation) => (
            <article key={explanation.title} className="rounded-lg border border-slate-200 p-4">
              <h4 className="font-medium">{explanation.title}</h4>
              <p className="mt-2 text-sm text-slate-600">{explanation.whyItMayBeRelevant}</p>
              {explanation.supportingHistory.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <h5 className="text-sm font-semibold">Historical observations used</h5>
                  <ul className="mt-2 space-y-2 text-sm text-slate-600">
                    {explanation.supportingHistory.map((history) => (
                      <li key={`${history.logId}-${history.date}`}>
                        <time dateTime={history.date} className="font-medium text-slate-800">{history.date}</time>
                        : {history.observation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {explanation.unknowns.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-semibold">Unknowns</h5>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {explanation.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="next-steps-heading">
        <h3 id="next-steps-heading" className="font-semibold">Next steps</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {assessment.nextSteps.map((step) => <li key={step}>{step}</li>)}
        </ul>
      </section>

      <section aria-labelledby="sources-heading">
        <h3 id="sources-heading" className="font-semibold">References</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {assessment.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {source.title}
              </a>
              <span className="text-slate-600"> — {source.publisher}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="border-t border-slate-200 pt-4 text-sm font-medium text-slate-700">
        {assessment.disclaimer}
      </p>
    </aside>
  );
}
