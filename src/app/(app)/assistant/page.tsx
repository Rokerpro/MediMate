import { AssistantChat } from "@/components/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-blue-700">History-aware assistant</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Talk through a concern</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          MediMate can ask clarifying questions and summarize educational information using
          relevant synthetic history. It cannot diagnose or replace professional care.
        </p>
        <details className="mt-3 max-w-3xl text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600">
            What MediMate&apos;s safety checks cover
          </summary>
          <p className="mt-2">
            Fixed warning-sign rules cover only the NHS emergency lists for back pain, headaches and chest pain.
            They use keyword matching, can miss unusual wording and are not comprehensive emergency detection.
            If no warning appears, that does not mean you are safe: if a symptom feels severe or sudden, call
            emergency services or seek urgent care.
          </p>
        </details>
      </div>
      <AssistantChat />
    </div>
  );
}
