"use client";

import { useState, useSyncExternalStore } from "react";

function subscribeToLocation(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getAccountDeletedSnapshot(): boolean {
  return new URLSearchParams(window.location.search).get("accountDeleted") === "1";
}

function getServerAccountDeletedSnapshot(): boolean {
  return false;
}

export function AccountDeletedNotice() {
  const isAccountDeleted = useSyncExternalStore(
    subscribeToLocation,
    getAccountDeletedSnapshot,
    getServerAccountDeletedSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);

  if (!isAccountDeleted || dismissed) return null;

  return (
    <div
      role="status"
      className="mx-auto mt-4 flex max-w-7xl items-center justify-between gap-4 rounded-xl border border-[#bdc8bb] bg-[#eef0e5] px-4 py-3 text-sm text-[#24352d] sm:mt-6 sm:mx-8 lg:mx-auto lg:px-6"
    >
      <p>Your account and data were deleted.</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss account deletion notice"
        className="shrink-0 rounded-lg px-2 py-1 font-semibold text-[#254a38] hover:bg-[#dfe5d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254a38]"
      >
        Dismiss
      </button>
    </div>
  );
}
