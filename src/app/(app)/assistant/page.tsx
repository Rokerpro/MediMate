import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "@/components/assistant-chat";

export const metadata: Metadata = { title: "Assistant · MediMate" };

export default function AssistantPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="History-aware assistant"
        title="Talk through a concern"
        description="Educational information only. It cannot diagnose or replace professional care."
        actions={
          <Link href="/logs" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#cbd6c5] bg-[#fffdf8] px-5 py-2.5 text-sm font-semibold text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2">
            Add a daily log <span aria-hidden="true">→</span>
          </Link>
        }
      >
        <details className="mt-4 max-w-3xl rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] px-4 py-3 text-sm text-[#5b6b61]">
          <summary className="cursor-pointer rounded-md font-medium text-[#40564a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
            What MediMate&apos;s safety checks cover
          </summary>
          <p className="mt-2 leading-6">
            Fixed warning-sign rules cover only the NHS emergency lists for back pain, headaches and chest pain.
            They use keyword matching, can miss unusual wording and are not comprehensive emergency detection.
            If no warning appears, that does not mean you are safe: if a symptom feels severe or sudden, call
            emergency services or seek urgent care.
          </p>
        </details>
      </PageHeader>
      <AssistantChat />
    </div>
  );
}
