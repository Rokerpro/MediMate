"use client";

import { useEffect, useState } from "react";

import { PROFILE_SAVED_EVENT, getCurrentUser, signOut } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/validations";

/** Signed-in user's name with a sign-out button. Shown in the app header. */
export function AccountMenu() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getCurrentUser()
        .then(({ user: current }) => {
          if (!cancelled) setUser(current);
        })
        .catch(() => {
          // The chip is optional; pages handle their own errors.
        });
    };
    load();
    // The header stays mounted across pages, so refresh the name after onboarding or a profile edit.
    window.addEventListener(PROFILE_SAVED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_SAVED_EVENT, load);
    };
  }, []);

  const initial = (user?.displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="flex shrink-0 items-center gap-2">
      {user && (
        <span
          className="hidden items-center gap-2 text-sm text-[#40564a] lg:inline-flex"
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
        className="rounded-full border border-[#dfe3d6] px-3 py-1.5 text-sm font-medium text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
