import type { Metadata } from "next";
import { Reminders } from "@/components/reminders";

export const metadata: Metadata = {
  title: "Reminders · MediMate",
  description: "Manage reminders that you set for this synthetic demo.",
};

export default function RemindersPage() {
  return <Reminders />;
}
