import type { Metadata } from "next";
import { PrescriptionExplainer } from "@/components/prescription-explainer";

export const metadata: Metadata = {
  title: "Understand a prescription · MediMate",
  description: "Reference common prescription abbreviations using example text only.",
};

export default function PrescriptionsPage() {
  return <PrescriptionExplainer />;
}
