"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/api-client";

// One check per page load, shared by every link on the landing page.
// Sign-out does a full page load, so the cached answer cannot go stale.
let signedInCheck: Promise<boolean> | null = null;
function checkSignedIn(): Promise<boolean> {
  signedInCheck ??= getCurrentUser()
    .then(({ user }) => user !== null)
    .catch(() => false);
  return signedInCheck;
}

/**
 * Landing-page entry link: goes to the dashboard when the visitor is already
 * signed in, otherwise to the sign-in page. A click before the check has
 * finished waits for it, so a signed-in visitor never lands on /login.
 */
export function WorkspaceLink({
  className,
  signedOutLabel,
  signedInLabel,
  icon,
}: {
  className?: string;
  signedOutLabel: string;
  signedInLabel: string;
  icon?: ReactNode;
}) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void checkSignedIn().then((value) => {
      if (active) setSignedIn(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link
      href={signedIn ? "/dashboard" : "/login"}
      className={className}
      onClick={(event) => {
        if (signedIn !== null || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        void checkSignedIn().then((value) => router.push(value ? "/dashboard" : "/login"));
      }}
    >
      {signedIn ? signedInLabel : signedOutLabel}
      {icon}
    </Link>
  );
}
