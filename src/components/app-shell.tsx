import Link from "next/link";
import type { ReactNode } from "react";
import { AssistantChatPopup } from "@/components/assistant-chat-popup";
import { AssistantExperienceProvider } from "@/components/assistant-experience";
import { PrimaryNavigation } from "@/components/primary-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AssistantExperienceProvider>
      <div className="min-h-full bg-[#f7f5ed] text-[#24352d]">
        <header className="border-b border-[#dfe3d6] bg-[#fbfaf5]/95 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link
              href="/dashboard"
              className="display-font shrink-0 rounded-md text-2xl font-semibold tracking-[-0.04em] text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#bd7e3e] align-middle" />
              MediMate
            </Link>
            <PrimaryNavigation />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 print:pt-0">
          <p
            role="note"
            className="rounded-xl border border-[#dec9a8] bg-[#f5ead9] px-4 py-3 text-sm text-[#654a2e]"
          >
            Synthetic demo data — do not enter real health information.
          </p>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 print:py-4">{children}</main>
        <AssistantChatPopup />
      </div>
    </AssistantExperienceProvider>
  );
}
