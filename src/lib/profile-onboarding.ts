import type { Profile } from "@/lib/validations";

/** Placeholder name given to new accounts (migration 0003); onboarding asks for a real one. */
export const NEW_USER_NAME = "New user";

/** A new account still needs its name and age before using the app. */
export function needsOnboarding(profile: Pick<Profile, "displayName" | "age">): boolean {
  return profile.age === null || profile.displayName.trim() === NEW_USER_NAME;
}
