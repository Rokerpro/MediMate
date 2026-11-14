"use client";

import { useState } from "react";
import {
  ApiClientError,
  explainPrescription,
} from "@/lib/api-client";
import type { PrescriptionExplainResponse } from "@/lib/validations";

const MAX_LENGTH = 2000;

export function PrescriptionExplainer() {
  const [text, setText] = useState("");
  const [lastSubmittedText, setLastSubmittedText] = useState("");
  const [result, setResult] = useState<PrescriptionExplainResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setLastSubmittedText(trimmed);

    try {
      const response = await explainPrescription({ text: trimmed });
      setResult(response);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : "We could not explain that wording. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(text);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="landing-kicker">Plain-language reference</p>
        <h1 className="display-font mt-3 text-5xl font-semibold tracking-[-0.05em] text-[#254a38]">
          Understand a prescription
        </h1>
        <p className="mt-3 max-w-2xl text-[#66766b]">
          See common abbreviation meanings in the exact wording you entered.
          This does not check a prescription or tell you how to take a medicine.
        </p>
      </div>

      <section className="rounded-2xl border border-[#d6ddcf] bg-white/70 p-5 shadow-sm sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="prescription-wording" className="block text-sm font-semibold text-[#254a38]">
              Prescription wording
            </label>
            <textarea
              id="prescription-wording"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={MAX_LENGTH}
              rows={5}
              placeholder="Example: Eye drops s prn"
              aria-describedby="prescription-note prescription-count"
              className="mt-2 block w-full rounded-xl border border-[#cbd6c5] bg-[#fbfaf5] px-4 py-3 text-[#24352d] outline-none transition placeholder:text-[#94a096] focus:border-[#789078] focus:ring-2 focus:ring-[#d8e1cf]"
            />
            <div className="mt-2 flex flex-col gap-1 text-xs text-[#718078] sm:flex-row sm:items-center sm:justify-between">
              <p id="prescription-note">
                Use example text only — do not paste a real prescription.
              </p>
              <p id="prescription-count" aria-live="polite">
                {text.length}/{MAX_LENGTH}
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || text.trim().length === 0}
            className="landing-button landing-button-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Explaining…" : "Explain abbreviations"}
          </button>
        </form>
      </section>

      {error ? (
        <section role="alert" className="rounded-2xl border border-[#d9b8a8] bg-[#fbede6] p-5 text-[#713f32]">
          <p className="font-semibold">We couldn&apos;t load an explanation</p>
          <p className="mt-2 text-sm">{error}</p>
          {lastSubmittedText ? (
            <button
              type="button"
              onClick={() => void submit(lastSubmittedText)}
              disabled={loading}
              className="mt-4 rounded-full border border-[#b7775e] px-4 py-2 text-sm font-semibold transition hover:bg-[#f5ddd2] focus:outline-none focus:ring-2 focus:ring-[#c98b48] disabled:opacity-50"
            >
              Try again
            </button>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section aria-labelledby="explanation-heading" className="space-y-6">
          <div>
            <h2 id="explanation-heading" className="display-font text-3xl tracking-[-0.04em] text-[#254a38]">
              Common abbreviations
            </h2>
            <p className="mt-2 text-sm text-[#66766b]">
              These are reference meanings only. Ask your pharmacist or prescriber if anything is unclear.
            </p>
          </div>

          {result.terms.length > 0 ? (
            <div className="grid gap-4">
              {result.terms.map((term) => (
                <article key={`${term.abbreviation}-${term.matchedText}`} className="rounded-2xl border border-[#d6ddcf] bg-white/70 p-5 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-xl font-semibold text-[#254a38]">{term.abbreviation}</h3>
                    <p className="text-sm text-[#66766b]">You wrote: <span className="font-semibold text-[#254a38]">{term.matchedText}</span></p>
                  </div>
                  {term.latin ? <p className="mt-2 text-sm italic text-[#718078]">{term.latin}</p> : null}
                  <p className="mt-3 text-[#3e5045]">{term.meaning}</p>
                  {term.caution ? (
                    <p className="mt-4 rounded-xl border border-[#dec9a8] bg-[#f5ead9] px-3 py-2 text-sm text-[#654a2e]">
                      <span className="font-semibold">Note:</span> {term.caution}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-[#d6ddcf] bg-white/70 p-5 text-[#52655a]">
              No common abbreviations were recognised.
            </p>
          )}

          <div className="rounded-2xl border border-[#d6ddcf] bg-[#eef0e5] p-5">
            <h2 className="font-semibold text-[#254a38]">Guidance</h2>
            <p className="mt-2 text-sm leading-6 text-[#52655a]">{result.guidance}</p>
            <p className="mt-4 text-sm">
              <span className="font-semibold text-[#254a38]">Source: </span>
              <a
                href={result.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-[#527158] underline decoration-[#aab9a0] underline-offset-2 hover:text-[#254a38] focus:outline-none focus:ring-2 focus:ring-[#c98b48]"
              >
                {result.source.title} ({result.source.publisher})
              </a>
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
