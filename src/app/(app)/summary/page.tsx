import type { Metadata } from "next";
import { HealthSummary } from "@/components/health-summary";

export const metadata: Metadata = { title: "Health summary · MediMate" };

export default function SummaryPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <HealthSummary />
    </div>
  );
}
