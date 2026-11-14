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
      </div>
      <AssistantChat />
    </div>
  );
}
