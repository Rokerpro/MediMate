"use client";

import { useState } from "react";
import type { HealthLog } from "@/lib/validations";
import { PageHeader } from "@/components/page-header";
import { HealthLogForm } from "@/components/health-log-form";
import { HealthLogTimeline } from "@/components/health-log-timeline";

export default function LogsPage() {
  const [newLog, setNewLog] = useState<HealthLog | null>(null);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Daily health history"
        title="Daily logs"
        description="Record observations in a simple timeline. These are user-reported notes, not diagnoses."
      />
      <section className="rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:p-8">
        <h2 className="mb-5 text-xl font-semibold tracking-[-0.02em] text-[#243b30]">Add today&apos;s observation</h2>
        <HealthLogForm onCreated={setNewLog} />
      </section>
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="mb-5 text-xl font-semibold tracking-[-0.02em] text-[#243b30]">Your timeline</h2>
        <HealthLogTimeline newLog={newLog} />
      </section>
    </div>
  );
}
