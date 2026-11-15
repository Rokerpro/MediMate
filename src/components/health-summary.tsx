"use client";

import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { useCallback, useEffect, useRef, useState } from "react";
import { downloadSummaryPdf } from "@/lib/summary-pdf";
import type { HealthLog, Profile } from "@/lib/validations";
import { getHealthLogs, getProfile } from "@/lib/api-client";
import { TREND_DAYS, logsInWindow, recurringSymptoms, summaryFigures } from "@/lib/health/trends";
import { HealthTrends } from "@/components/health-trends";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; profile: Profile; logs: HealthLog[]; generatedAt: number };

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function sleepText(minutes: number | null): string {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function listOrNone(values: readonly string[]): string {
  return values.length ? values.join(", ") : "None recorded";
}

export function HealthSummary() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const articleRef = useRef<HTMLElement>(null);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "working" | "error">("idle");

  async function handleDownload() {
    if (!articleRef.current || pdfStatus === "working") return;
    setPdfStatus("working");
    try {
      const date = new Date().toISOString().slice(0, 10);
      await downloadSummaryPdf(articleRef.current, `medimate-health-summary-${date}.pdf`);
      setPdfStatus("idle");
    } catch {
      setPdfStatus("error");
    }
  }

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [profileResponse, logResponse] = await Promise.all([getProfile(), getHealthLogs(100)]);
      setState({ status: "ready", profile: profileResponse.profile, logs: logResponse.logs, generatedAt: Date.now() });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getProfile(), getHealthLogs(100)])
      .then(([profileResponse, logResponse]) => {
        if (active) setState({ status: "ready", profile: profileResponse.profile, logs: logResponse.logs, generatedAt: Date.now() });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") return <LoadingSkeleton label="Preparing your health summary…" rows={4} />;
  if (state.status === "error") {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <p>We could not load your profile and health logs. Please try again.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  const { profile, logs, generatedAt } = state;
  const windowLogs = logsInWindow(logs, TREND_DAYS, generatedAt);
  const figures = summaryFigures(windowLogs);
  const recurring = recurringSymptoms(windowLogs);

  return (
    <article ref={articleRef} className="space-y-6 print:space-y-4">
      <PageHeader
        eyebrow="Patient-provided summary"
        title="Health summary for a clinician"
        description={
          <p className="text-sm">
            Prepared on {formatDate(new Date(generatedAt).toISOString())} from information the patient recorded in MediMate.
          </p>
        }
        actions={
          <div data-pdf-exclude className="flex flex-col items-start gap-2 sm:items-end print:hidden">
            <div className="inline-flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={pdfStatus === "working"}
                aria-busy={pdfStatus === "working"}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#254a38] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1c3a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 disabled:opacity-70"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {pdfStatus === "working" ? "Preparing PDF…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#cbd6c5] bg-[#fffdf8] px-5 py-2.5 text-sm font-semibold text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                Print
              </button>
            </div>
            <p role="status" aria-live="polite" className="text-xs text-[#7a3520]">
              {pdfStatus === "error" ? "Could not create the PDF. Try again, or use Print and choose “Save as PDF”." : ""}
            </p>
          </div>
        }
      />

      <p role="note" className="rounded-lg border border-[#cbd6c5] bg-[#f3f4ec] p-4 text-sm text-[#24352d]">
        This summary contains user-reported information only. It is <strong>not a medical diagnosis</strong> and has not been
        checked by a clinician. Synthetic demo data.
      </p>

      <Section title="Profile">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Item label="Name" value={profile.displayName} />
          <Item label="Age" value={profile.age !== null ? String(profile.age) : "Not recorded"} />
          <Item label="Gender" value={profile.gender ?? "Not recorded"} />
          <Item label="Location" value={profile.location ?? "Not recorded"} />
          <Item label="Height" value={profile.heightCm !== null ? `${profile.heightCm} cm` : "Not recorded"} />
          <Item label="Weight" value={profile.weightKg !== null ? `${profile.weightKg} kg` : "Not recorded"} />
        </dl>
      </Section>

      <Section title="Health background">
        <dl className="grid gap-y-2 text-sm">
          <Item label="Conditions" value={listOrNone(profile.conditions)} />
          <Item label="Allergies" value={listOrNone(profile.allergies)} />
          <Item label="Medical history note" value={profile.medicalHistory || "None recorded"} />
        </dl>
      </Section>

      <Section title="Medications">
        <p className="text-sm text-[#24352d]">{listOrNone(profile.medications)}</p>
        <p className="mt-1 text-xs text-[#6b776f]">As recorded by the patient. MediMate does not check or advise on medications.</p>
      </Section>

      <Section title={`Trends (last ${TREND_DAYS} days)`}>
        <HealthTrends logs={logs} now={generatedAt} />
      </Section>

      <Section title={`Recorded observations (last ${TREND_DAYS} days)`}>
        {windowLogs.length === 0 ? (
          <p className="text-sm text-[#5b6b61]">No health logs were recorded in the last {TREND_DAYS} days.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#24352d]">
            <li>
              {figures.logCount} daily {figures.logCount === 1 ? "log" : "logs"} recorded.
            </li>
            {recurring.map((item) => (
              <li key={item.symptom}>
                &ldquo;{item.symptom}&rdquo; recorded on {item.count} days ({formatDate(item.firstDate)} to {formatDate(item.lastDate)}).
              </li>
            ))}
            {figures.highestPain && (
              <li>
                Highest pain level recorded: {figures.highestPain.level}/10 on {formatDate(figures.highestPain.date)}.
              </li>
            )}
            {figures.averageSleepHours !== null && <li>Average recorded sleep: {figures.averageSleepHours} hours.</li>}
          </ul>
        )}
        <p className="mt-2 text-xs text-[#6b776f]">Counts of what was recorded. They do not show what caused any symptom.</p>
      </Section>

      <Section title={`Recent history (last ${TREND_DAYS} days)`} avoidBreak={false}>
        {windowLogs.length === 0 ? (
          <p className="text-sm text-[#5b6b61]">No entries.</p>
        ) : (
          <>
            <ul className="space-y-3 sm:hidden print:hidden">
              {windowLogs.map((log) => (
                <li key={log.id} className="rounded-lg border border-[#dfe3d6] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6b776f]">Date</p>
                  <time dateTime={log.loggedAt} className="mt-1 block text-sm font-medium text-[#24352d]">
                    {formatDate(log.loggedAt)}
                  </time>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="col-span-2 min-w-0">
                      <dt className="text-xs font-semibold text-[#5b6b61]">Symptoms</dt>
                      <dd className="break-words text-[#24352d]">
                        {log.symptoms}
                        {log.painLocation && <span className="text-[#6b776f]"> ({log.painLocation})</span>}
                        {log.notes && <span className="mt-1 block text-xs text-[#6b776f]">{log.notes}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#5b6b61]">Pain</dt>
                      <dd className="text-[#24352d]">{log.painLevel !== null ? `${log.painLevel}/10` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#5b6b61]">Sleep</dt>
                      <dd className="text-[#24352d]">
                        {sleepText(log.sleepDurationMinutes)}
                        {log.sleepQuality !== null && <span className="text-[#6b776f]"> ({log.sleepQuality}/5)</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#5b6b61]">Water</dt>
                      <dd className="text-[#24352d]">{log.waterMl !== null ? `${log.waterMl} ml` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#5b6b61]">Activity</dt>
                      <dd className="text-[#24352d]">{log.activityMinutes !== null ? `${log.activityMinutes} min` : "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs font-semibold text-[#5b6b61]">Mood</dt>
                      <dd className="break-words text-[#24352d]">{log.mood ?? "—"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block print:block print:overflow-visible">
              <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm print:min-w-0 print:text-[9px]">
                <thead>
                  <tr className="border-b border-[#cbd6c5] text-[#40564a]">
                    <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Symptoms</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Pain</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Sleep</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Water</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Activity</th>
                    <th scope="col" className="py-2 font-semibold">Mood</th>
                  </tr>
                </thead>
                <tbody>
                  {windowLogs.map((log) => (
                    <tr key={log.id} className="border-b border-[#dfe3d6] align-top print:break-inside-avoid">
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">{formatDate(log.loggedAt)}</td>
                      <td className="py-2 pr-3 break-words">
                        {log.symptoms}
                        {log.painLocation && <span className="text-[#6b776f]"> ({log.painLocation})</span>}
                        {log.notes && <span className="block text-xs text-[#6b776f]">{log.notes}</span>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">{log.painLevel !== null ? `${log.painLevel}/10` : "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">
                        {sleepText(log.sleepDurationMinutes)}
                        {log.sleepQuality !== null && <span className="text-[#6b776f]"> ({log.sleepQuality}/5)</span>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">{log.waterMl !== null ? `${log.waterMl} ml` : "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">{log.activityMinutes !== null ? `${log.activityMinutes} min` : "—"}</td>
                      <td className="py-2 break-words">{log.mood ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section title="Notes for the appointment">
        <p className="text-sm text-[#5b6b61]">Questions or points the patient wants to raise:</p>
        <div className="mt-2 h-24 rounded-lg border border-dashed border-[#cbd6c5]" aria-hidden="true" />
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
  avoidBreak = true,
}: {
  title: string;
  children: React.ReactNode;
  avoidBreak?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm ${
        avoidBreak ? "print:break-inside-avoid" : ""
      } print:border-[#cbd6c5] print:p-3 print:shadow-none`}
    >
      <h2 className="mb-3 text-lg font-semibold text-[#24352d]">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-medium text-[#24352d]">{label}: </dt>
      <dd className="inline text-[#40564a]">{value}</dd>
    </div>
  );
}
