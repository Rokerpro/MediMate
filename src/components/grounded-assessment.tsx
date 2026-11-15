import Link from "next/link";
import { useId } from "react";
import type { Assessment } from "@/lib/validations";

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function EvidenceDate({ date, dark = false }: { date: string; dark?: boolean }) {
  const formattedDate = formatDate(date);
  return (
    <Link
      href="/logs"
      aria-label={`View health logs, including the record dated ${formattedDate}`}
      className={`font-medium underline underline-offset-2 focus:outline-none focus-visible:ring-2 ${
        dark
          ? "text-slate-100 focus-visible:ring-blue-300"
          : "text-[#254a38] focus-visible:ring-[#9a7949]"
      }`}
    >
      {formattedDate}
    </Link>
  );
}

function MatchedTerms({ terms, dark = false }: { terms: string[]; dark?: boolean }) {
  if (terms.length === 0) return null;

  return (
    <ul aria-label="Matched terms" className="mt-2 flex flex-wrap gap-2">
      {terms.map((term) => (
        <li
          key={term}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            dark
              ? "border-[#526358] bg-[#26372c] text-slate-200"
              : "border-[#dfe3d6] bg-[#f3f4ec] text-[#40564a]"
          }`}
        >
          matched: {term}
        </li>
      ))}
    </ul>
  );
}

/** Keeps server-calculated facts distinct from the assistant's interpretation. */
export function GroundedAssessment({
  assessment,
  dark = false,
}: {
  assessment: Assessment;
  dark?: boolean;
}) {
  const instanceId = useId();
  const recordedFactsHeadingId = `${instanceId}-recorded-facts`;
  const interpretationHeadingId = `${instanceId}-interpretation`;
  const nextStepsHeadingId = `${instanceId}-next-steps`;
  const sourcesHeadingId = `${instanceId}-sources`;
  const muted = dark ? "text-slate-300" : "text-[#5b6b61]";
  const sectionBorder = dark ? "border-[#49574d]" : "border-[#e2e5da]";
  const card = dark ? "border-[#49574d] bg-[#202e25]" : "border-[#e2e5da] bg-[#fbfaf6]";

  return (
    <div className="space-y-5">
      {assessment.recordedFacts.length > 0 && (
        <section aria-labelledby={recordedFactsHeadingId}>
          <h3 id={recordedFactsHeadingId} className="font-semibold">
            From your records
          </h3>
          <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${muted}`}>
            {assessment.recordedFacts.map((fact, index) => (
              <li key={`${fact}-${index}`}>{fact}</li>
            ))}
          </ul>
        </section>
      )}

      {assessment.historyConsidered.length > 0 && (
        <details className={`rounded-xl border ${sectionBorder}`}>
          <summary className="cursor-pointer rounded-xl px-4 py-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bd7e3e]">
            Records MediMate looked at ({assessment.historyConsidered.length})
          </summary>
          <ul className="space-y-3 px-4 pb-4">
            {assessment.historyConsidered.map((record) => (
              <li key={record.logId} className={`rounded-lg border p-3 ${card}`}>
                <p className="text-sm">
                  <EvidenceDate date={record.date} dark={dark} />
                  <span className={`mt-1 block ${muted}`}>{record.observation}</span>
                </p>
                <MatchedTerms terms={record.matchedTerms} dark={dark} />
                {(record.reason === "recent_measurement" || record.cited) && (
                  <ul aria-label="Record context" className="mt-2 flex flex-wrap gap-2">
                    {record.reason === "recent_measurement" && (
                      <li className={`rounded-full px-2.5 py-1 text-xs ${dark ? "bg-[#35443a] text-slate-200" : "bg-[#eeece1] text-[#526258]"}`}>
                        Recent measurement
                      </li>
                    )}
                    {record.cited && (
                      <li className={`rounded-full px-2.5 py-1 text-xs ${dark ? "bg-[#35443a] text-slate-200" : "bg-[#eeece1] text-[#526258]"}`}>
                        Used in an explanation
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section aria-labelledby={interpretationHeadingId}>
        <h3 id={interpretationHeadingId} className="font-semibold">
          MediMate&apos;s interpretation
        </h3>
        <p className={`mt-2 leading-7 ${muted}`}>{assessment.summary}</p>

        {assessment.possibleExplanations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold">Possible explanations to discuss with a clinician</h4>
            <ul className="mt-3 space-y-3">
              {assessment.possibleExplanations.map((explanation, index) => (
                <li key={`${explanation.title}-${index}`} className={`rounded-xl border p-4 ${card}`}>
                  <h5 className="font-medium">{explanation.title}</h5>
                  <p className={`mt-2 text-sm leading-6 ${muted}`}>{explanation.whyItMayBeRelevant}</p>

                  {explanation.supportingHistory.length > 0 && (
                    <div className={`mt-3 border-t pt-3 ${sectionBorder}`}>
                      <p className="text-sm font-semibold">Supporting observations</p>
                      <ul className={`mt-2 space-y-3 text-sm ${muted}`}>
                        {explanation.supportingHistory.map((record) => (
                          <li key={`${record.logId}-${record.date}`}>
                            <EvidenceDate date={record.date} dark={dark} />
                            <span className="block">{record.observation}</span>
                            <MatchedTerms terms={record.matchedTerms} dark={dark} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {explanation.unknowns.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold">Unknowns</p>
                      <ul className={`mt-1 list-disc space-y-1 pl-5 text-sm ${muted}`}>
                        {explanation.unknowns.map((unknown) => (
                          <li key={unknown}>{unknown}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {assessment.nextSteps.length > 0 && (
        <section aria-labelledby={nextStepsHeadingId}>
          <h3 id={nextStepsHeadingId} className="font-semibold">Next steps</h3>
          <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${muted}`}>
            {assessment.nextSteps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </section>
      )}

      {assessment.sources.length > 0 && (
        <section aria-labelledby={sourcesHeadingId}>
          <h3 id={sourcesHeadingId} className="font-semibold">Sources</h3>
          <ul className={`mt-2 space-y-2 text-sm ${muted}`}>
            {assessment.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline underline-offset-2 focus:outline-none focus-visible:ring-2 ${
                    dark
                      ? "text-blue-300 hover:text-blue-200 focus-visible:ring-blue-300"
                      : "text-[#254a38] hover:text-[#1c3a2c] focus-visible:ring-[#9a7949]"
                  }`}
                >
                  {source.title}
                </a>{" "}
                ({source.publisher})
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={`rounded-xl border-t pt-4 text-sm font-medium ${sectionBorder} ${muted}`}>
        {assessment.disclaimer}
      </p>
    </div>
  );
}
