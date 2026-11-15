import type { Metadata } from "next";
import { MedicineLookup } from "@/components/medicine-lookup";
import { PageHeader } from "@/components/page-header";
import { PrescriptionExplainer } from "@/components/prescription-explainer";

export const metadata: Metadata = {
  title: "Medicines · MediMate",
  description: "Plain-English information about what a medicine is for, and common prescription abbreviations.",
};

export default function PrescriptionsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Medicines"
        title="Understand your medicines"
        description={
          <p>General information to help you ask better questions. It never tells you how much to take or whether to take it.</p>
        }
      />
      <MedicineLookup />
      <PrescriptionExplainer />
    </div>
  );
}
