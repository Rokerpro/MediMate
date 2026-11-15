"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getCurrentUser } from "@/lib/api-client";

/**
 * On /login: a visitor who already has a valid session goes straight to
 * `next` (the dashboard by default). /api/auth/me verifies the token, so a
 * stale cookie returns no user and the sign-in page stays — no redirect loop.
 */
export function SignedInRedirect({ next }: { next: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then(({ user }) => {
        if (active && user) router.replace(next);
      })
      .catch(() => {
        // Could not check: leave the sign-in page as it is.
      });
    return () => {
      active = false;
    };
  }, [next, router]);

  return null;
}
