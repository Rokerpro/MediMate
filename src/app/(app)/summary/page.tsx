import type { Metadata } from "next";
import { HealthSummary } from "@/components/health-summary";
import { RecentAssistantConversations } from "@/components/recent-assistant-conversations";

export const metadata: Metadata = { title: "Health summary · MediMate" };

export default function SummaryPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <HealthSummary />
      <RecentAssistantConversations />
    </div>
  );
}
