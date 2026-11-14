import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/logs", label: "Daily logs" },
  { href: "/assistant", label: "Assistant" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
            MediMate
          </Link>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <p
          role="note"
          className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Synthetic demo data — do not enter real health information.
        </p>
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
