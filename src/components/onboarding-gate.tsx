"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { getProfile } from "@/lib/api-client";
import { needsOnboarding } from "@/lib/profile-onboarding";

/**
 * Sends a newly signed-up user to /welcome until their profile has a name and
 * age. Checks on each page change until the profile is complete, then stops.
 */
export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();
  const complete = useRef(false);

  useEffect(() => {
    if (complete.current || pathname === "/welcome") return;
    let cancelled = false;
    getProfile()
      .then(({ profile }) => {
        if (cancelled) return;
        if (needsOnboarding(profile)) router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
        else complete.current = true;
      })
      .catch(() => {
        // Pages show their own load errors; a 401 already redirects to /login.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
