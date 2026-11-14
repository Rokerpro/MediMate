import Link from "next/link";
import type { ReactNode } from "react";
import { PrimaryNavigation } from "@/components/primary-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="rounded-md text-xl font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            MediMate
          </Link>
          <PrimaryNavigation />
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 print:pt-0">
        <p
          role="note"
          className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Synthetic demo data — do not enter real health information.
        </p>
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 print:py-4">{children}</main>
    </div>
  );
}
