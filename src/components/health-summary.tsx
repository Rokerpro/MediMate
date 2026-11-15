"use client";

import { useCallback, useEffect, useState } from "react";
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

  if (state.status === "loading") return <p role="status">Preparing your health summary…</p>;
  if (state.status === "error") {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <p>We could not load your profile and health logs. Please try again.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-600"
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
    <article className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700 print:text-slate-700">Patient-provided summary</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Health summary for a clinician</h1>
          <p className="mt-2 text-sm text-slate-600">
            Prepared on {formatDate(new Date(generatedAt).toISOString())} from information the patient recorded in MediMate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 print:hidden"
        >
          Download / print PDF
        </button>
      </div>

      <p role="note" className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800">
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
        <p className="text-sm text-slate-800">{listOrNone(profile.medications)}</p>
        <p className="mt-1 text-xs text-slate-500">As recorded by the patient. MediMate does not check or advise on medications.</p>
      </Section>

      <Section title={`Trends (last ${TREND_DAYS} days)`}>
        <HealthTrends logs={logs} now={generatedAt} />
      </Section>

      <Section title={`Recorded observations (last ${TREND_DAYS} days)`}>
        {windowLogs.length === 0 ? (
          <p className="text-sm text-slate-600">No health logs were recorded in the last {TREND_DAYS} days.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
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
        <p className="mt-2 text-xs text-slate-500">Counts of what was recorded. They do not show what caused any symptom.</p>
      </Section>

      <Section title={`Recent history (last ${TREND_DAYS} days)`} avoidBreak={false}>
        {windowLogs.length === 0 ? (
          <p className="text-sm text-slate-600">No entries.</p>
        ) : (
          <>
            <ul className="space-y-3 sm:hidden print:hidden">
              {windowLogs.map((log) => (
                <li key={log.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
                  <time dateTime={log.loggedAt} className="mt-1 block text-sm font-medium text-slate-800">
                    {formatDate(log.loggedAt)}
                  </time>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="col-span-2 min-w-0">
                      <dt className="text-xs font-semibold text-slate-600">Symptoms</dt>
                      <dd className="break-words text-slate-800">
                        {log.symptoms}
                        {log.painLocation && <span className="text-slate-500"> ({log.painLocation})</span>}
                        {log.notes && <span className="mt-1 block text-xs text-slate-500">{log.notes}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-600">Pain</dt>
                      <dd className="text-slate-800">{log.painLevel !== null ? `${log.painLevel}/10` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-600">Sleep</dt>
                      <dd className="text-slate-800">
                        {sleepText(log.sleepDurationMinutes)}
                        {log.sleepQuality !== null && <span className="text-slate-500"> ({log.sleepQuality}/5)</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-600">Water</dt>
                      <dd className="text-slate-800">{log.waterMl !== null ? `${log.waterMl} ml` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-600">Activity</dt>
                      <dd className="text-slate-800">{log.activityMinutes !== null ? `${log.activityMinutes} min` : "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs font-semibold text-slate-600">Mood</dt>
                      <dd className="break-words text-slate-800">{log.mood ?? "—"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block print:block print:overflow-visible">
              <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm print:min-w-0 print:text-[9px]">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-700">
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
                    <tr key={log.id} className="border-b border-slate-100 align-top print:break-inside-avoid">
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">{formatDate(log.loggedAt)}</td>
                      <td className="py-2 pr-3 break-words">
                        {log.symptoms}
                        {log.painLocation && <span className="text-slate-500"> ({log.painLocation})</span>}
                        {log.notes && <span className="block text-xs text-slate-500">{log.notes}</span>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">{log.painLevel !== null ? `${log.painLevel}/10` : "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap print:whitespace-normal">
                        {sleepText(log.sleepDurationMinutes)}
                        {log.sleepQuality !== null && <span className="text-slate-500"> ({log.sleepQuality}/5)</span>}
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
        <p className="text-sm text-slate-600">Questions or points the patient wants to raise:</p>
        <div className="mt-2 h-24 rounded-lg border border-dashed border-slate-300" aria-hidden="true" />
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
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${
        avoidBreak ? "print:break-inside-avoid" : ""
      } print:border-slate-300 print:p-3 print:shadow-none`}
    >
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-medium text-slate-800">{label}: </dt>
      <dd className="inline text-slate-700">{value}</dd>
    </div>
  );
}
