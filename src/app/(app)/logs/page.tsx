"use client";

import { useState } from "react";
import type { HealthLog } from "@/lib/validations";
import Link from "next/link";
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
        actions={
          <Link href="/insights" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#cbd6c5] bg-[#fffdf8] px-5 py-2.5 text-sm font-semibold text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2">
            View insights <span aria-hidden="true">→</span>
          </Link>
        }
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
