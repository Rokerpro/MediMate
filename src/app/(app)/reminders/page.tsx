import { Suspense } from "react";
import type { Metadata } from "next";
import { Reminders } from "@/components/reminders";

export const metadata: Metadata = {
  title: "Reminders · MediMate",
  description: "Manage reminders that you set for this synthetic demo.",
};

async function RemindersContent({
  searchParams,
}: Pick<PageProps<"/reminders">, "searchParams">) {
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  return (
    <Reminders
      targetDoseId={pick(params.dose)}
      confirmFailed={pick(params.confirm) === "failed"}
    />
  );
}

export default function RemindersPage({
  searchParams,
}: PageProps<"/reminders">) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-[#5b6b61]">Loading reminders…</p>}>
      <RemindersContent searchParams={searchParams} />
    </Suspense>
  );
}
