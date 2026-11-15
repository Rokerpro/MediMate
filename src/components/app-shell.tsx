import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { OnboardingGate } from "@/components/onboarding-gate";
import { AssistantChatPopup } from "@/components/assistant-chat-popup";
import { AssistantExperienceProvider } from "@/components/assistant-experience";
import { MobileTabBar, SidebarNavigation } from "@/components/primary-navigation";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { ThemeToggle } from "@/components/theme-toggle";

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`display-font shrink-0 rounded-md text-2xl font-semibold tracking-[-0.04em] text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${className}`}
    >
      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#bd7e3e] align-middle" />
      MediMate
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AssistantExperienceProvider>
      <div className="min-h-full bg-[#f7f5ed] text-[#24352d]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#dfe3d6] bg-[#fffdf8] px-4 py-6 lg:flex print:hidden">
          <Logo className="mb-8 px-2" />
          <SidebarNavigation />
          <div className="mt-auto space-y-4 border-t border-[#dfe3d6] px-2 pt-4">
            <ThemeToggle />
            <AccountMenu showName />
          </div>
        </aside>

        {/* Phone / tablet header */}
        <ScrollAwareHeader
          className="border-b border-[#dfe3d6] bg-[#fbfaf5]/95 backdrop-blur lg:hidden print:hidden"
          spacerClassName="h-[69px] lg:hidden print:hidden"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
            <Logo />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <AccountMenu />
            </div>
          </div>
        </ScrollAwareHeader>

        <div className="lg:pl-64">
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6 print:pt-0">
            <p
              role="note"
              className="inline-flex w-full items-center gap-2 rounded-xl border border-[#dec9a8] bg-[#f5ead9] px-4 py-2.5 text-sm text-[#654a2e] lg:w-auto lg:rounded-full"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#bd7e3e]" />
              Synthetic demo data — do not enter real health information.
            </p>
          </div>
          <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-12 print:py-4">
            {children}
          </main>
        </div>

        <MobileTabBar />
        <AssistantChatPopup />
        <OnboardingGate />
      </div>
    </AssistantExperienceProvider>
  );
}
