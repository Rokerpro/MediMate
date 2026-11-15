"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { safeNextPath } from "@/lib/auth/session";

/** First-run profile form; continues to where the user was going once saved. */
export function WelcomeForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  return <ProfileForm onboarding onSaved={() => router.replace(next === "/welcome" ? "/dashboard" : next)} />;
}
