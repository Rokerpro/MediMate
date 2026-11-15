"use client";

import { useEffect, useState } from "react";

import { getCurrentUser, signOut } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/validations";

/** Signed-in user's name with a sign-out button. Shown in the app header. */
export function AccountMenu() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(({ user: current }) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        // The chip is optional; pages handle their own errors.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = (user?.displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="flex shrink-0 items-center gap-2">
      {user && (
        <span
          className="hidden items-center gap-2 rounded-full border border-[#dfe3d6] bg-[#f7f5ed] py-1 pl-1.5 pr-3 text-sm text-[#40564a] lg:inline-flex"
          title={user.email ?? undefined}
        >
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#254a38] text-xs font-semibold text-[#fbfaf5]"
          >
            {initial}
          </span>
          <span className="max-w-[10rem] truncate">{user.displayName}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          setSigningOut(true);
          void signOut();
        }}
        disabled={signingOut}
        className="min-h-10 rounded-full border border-[#d6ddcf] bg-[#f7f5ed] px-4 py-2 text-sm font-semibold text-[#254a38] transition-colors hover:border-[#b8c5b2] hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfaf5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
