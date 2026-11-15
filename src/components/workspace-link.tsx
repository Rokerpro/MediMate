"use client";

import Link from "next/link";
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
 * signed in, otherwise to the sign-in page. Defaults to /login until known.
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
  const [signedIn, setSignedIn] = useState(false);

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
    <Link href={signedIn ? "/dashboard" : "/login"} className={className}>
      {signedIn ? signedInLabel : signedOutLabel}
      {icon}
    </Link>
  );
}
