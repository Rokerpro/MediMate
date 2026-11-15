import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "@/components/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="History-aware assistant"
        title="Talk through a concern"
        description="MediMate can ask clarifying questions and summarize educational information using relevant synthetic history. It cannot diagnose or replace professional care."
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
