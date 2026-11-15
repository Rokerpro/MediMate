"use client";

import { type FormEvent, useState } from "react";

import { ApiClientError, explainMedicine } from "@/lib/api-client";
import type { MedicineExplainResponse } from "@/lib/validations";

const EXAMPLES = ["Ibuprofen", "Salbutamol inhaler", "Sertraline", "Blue inhaler for asthma"];
const MAX_LENGTH = 200;

function ListBlock({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-[#3e5045]">
            <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#527158]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MedicineLookup() {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [result, setResult] = useState<MedicineExplainResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookUp(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || loading) return;
    setLoading(true);
    setError("");
    setLastQuery(trimmed);
    try {
      setResult(await explainMedicine({ query: trimmed }));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof ApiClientError ? caught.message : "We could not look that up. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookUp(query);
  }

  const explanation = result?.explanation ?? null;

  return (
    <section aria-labelledby="medicine-lookup-heading" className="rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="medicine-lookup-heading" className="text-xl font-semibold text-[#243b30]">
            What is this medicine for?
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#5b6b61]">
            Type a medicine name, a brand, or anything you know about it. AI explains what it is generally used for, in plain English.
          </p>
        </div>
        <span className="rounded-full bg-[#eef0e5] px-3 py-1 text-xs font-semibold text-[#40564a]">AI-generated</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="medicine-query" className="sr-only">
          Medicine name or description
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="medicine-query"
            value={query}
            maxLength={MAX_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Ibuprofen, or “the blue inhaler”"
            autoComplete="off"
            className="min-h-12 flex-1 rounded-full border border-[#cbd6c5] bg-white px-5 text-[#24352d] placeholder:text-[#94a096] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#254a38] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1c3a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Looking up…" : "Explain"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6b776f]">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                void lookUp(example);
              }}
              disabled={loading}
              className="min-h-8 rounded-full border border-[#cbd6c5] px-3 text-xs font-semibold text-[#40564a] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      <div aria-live="polite" className="mt-6 space-y-4">
        {loading ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">Looking up the medicine…</span>
            <div className="h-6 w-1/3 animate-pulse rounded-lg bg-[#eef0e5]" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-[#eef0e5]" />
            <div className="h-4 w-2/3 animate-pulse rounded-lg bg-[#eef0e5]" />
          </div>
        ) : null}

        {!loading && error ? (
          <div role="alert" className="rounded-2xl border border-[#e7b9a8] bg-[#fbeee8] p-4 text-sm text-[#7a3520]">
            <p>{error}</p>
            {lastQuery ? (
              <button
                type="button"
                onClick={() => void lookUp(lastQuery)}
                className="mt-3 min-h-10 rounded-full border border-[#b7775e] px-4 font-semibold transition hover:bg-[#f5ddd2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && result ? (
          <>
            {result.safety.triggered && result.safety.message ? (
              <div
                role="alert"
                className={`rounded-2xl border p-4 text-sm leading-6 ${
                  result.safety.level === "urgent"
                    ? "border-[#e7b9a8] bg-[#fbeee8] text-[#7a3520]"
                    : "border-[#dec9a8] bg-[#f5ead9] text-[#654a2e]"
                }`}
              >
                <p className="font-semibold">{result.safety.level === "urgent" ? "Get help now" : "Worth getting checked soon"}</p>
                <p className="mt-1">{result.safety.message}</p>
              </div>
            ) : null}

            {result.status === "not_recognised" ? (
              <p className="rounded-2xl border border-[#dfe3d6] bg-[#f7f5ed] px-4 py-3 text-sm text-[#40564a]">
                MediMate could not confidently identify a medicine from “{lastQuery}”. Check the spelling, or try the name printed on the box or leaflet.
              </p>
            ) : null}

            {explanation ? (
              <article className="rounded-2xl border border-[#dfe3d6] bg-white/70 p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="display-font text-3xl tracking-[-0.03em] text-[#254a38]">{explanation.name}</h3>
                  {explanation.alsoKnownAs.length ? (
                    <p className="text-sm text-[#6b776f]">Also known as {explanation.alsoKnownAs.join(", ")}</p>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-semibold text-[#bd7e3e]">{explanation.medicineType}</p>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">What it is for</h4>
                      <p className="mt-2 leading-7 text-[#24352d]">{explanation.whatItIsFor}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b776f]">How it works</h4>
                      <p className="mt-2 text-sm leading-6 text-[#3e5045]">{explanation.howItWorks}</p>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <ListBlock title="Commonly used for" items={explanation.commonUses} />
                    <ListBlock title="Questions to ask your pharmacist" items={explanation.questionsToAsk} />
                  </div>
                </div>
              </article>
            ) : null}

            <div className="rounded-2xl border border-[#dec9a8] bg-[#f5ead9] p-4 text-sm leading-6 text-[#654a2e]">
              <p>{result.guidance}</p>
              <p className="mt-2 font-semibold">{result.disclaimer}</p>
              <p className="mt-2">
                Official patient information:{" "}
                <a
                  href={result.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
                >
                  {result.source.title} ({result.source.publisher})
                </a>
              </p>
            </div>
          </>
        ) : null}

        {!loading && !result && !error ? (
          <p className="text-xs leading-5 text-[#6b776f]">
            General information only — never doses, timing or whether to take it. Use made-up or common examples; do not enter real health information.
          </p>
        ) : null}
      </div>
    </section>
  );
}
