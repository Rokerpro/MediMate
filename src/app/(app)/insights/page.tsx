import type { Metadata } from "next";
import { HealthAnalytics } from "@/components/health-analytics";

export const metadata: Metadata = { title: "Health insights · MediMate" };

export default function InsightsPage() {
  return <HealthAnalytics />;
}
