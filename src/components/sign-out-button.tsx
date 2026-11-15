"use client";

import { useState } from "react";

import { signOut } from "@/lib/api-client";

export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setSigningOut(true);
        void signOut();
      }}
      disabled={signingOut}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#dfe3d6] px-5 py-2 text-sm font-medium text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] disabled:cursor-wait disabled:opacity-60"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
