"use client";

import { useState } from "react";
import type { HealthLog } from "@/lib/validations";
import { HealthLogForm } from "@/components/health-log-form";
import { HealthLogTimeline } from "@/components/health-log-timeline";

export default function LogsPage() {
  const [newLog, setNewLog] = useState<HealthLog | null>(null);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-blue-700">Daily health history</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Daily logs</h1>
        <p className="mt-2 text-slate-600">
          Record observations in a simple timeline. These are user-reported notes, not diagnoses.
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h2 className="mb-5 text-xl font-semibold">Add today&apos;s observation</h2>
        <HealthLogForm onCreated={setNewLog} />
      </section>
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="mb-5 text-xl font-semibold">Your timeline</h2>
        <HealthLogTimeline newLog={newLog} />
      </section>
    </div>
  );
}
