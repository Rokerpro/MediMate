import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContinueWithGoogle } from "@/components/continue-with-google";
import { SignedInRedirect } from "@/components/signed-in-redirect";
import { ThemeToggle } from "@/components/theme-toggle";
import { safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in · MediMate" };

const ERROR_MESSAGES: Record<string, string> = {
  closed: "Sign-ups are closed: this demo only accepts its first 5 accounts. If you already have an account, sign in with the same Google account.",
  failed: "Google sign-in did not finish. Please try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginShell errorMessage={null} signedOut={false} next="/dashboard" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const errorMessage = ERROR_MESSAGES[pick(params.error) ?? ""] ?? null;
  const signedOut = pick(params.signedOut) === "1";
  const next = safeNextPath(pick(params.next));
  return (
    <>
      {/* After sign-out or a sign-in error, stay here so the message is visible. */}
      {!signedOut && !errorMessage && <SignedInRedirect next={next} />}
      <LoginShell errorMessage={errorMessage} signedOut={signedOut} next={next} />
    </>
  );
}

function LoginShell({
  errorMessage,
  signedOut,
  next,
}: {
  errorMessage: string | null;
  signedOut: boolean;
  next: string;
}) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f5ed] px-4 py-10 text-[#24352d] sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-[min(76vw,34rem)] w-[min(76vw,34rem)] rounded-full bg-[#dbe2ce]/70 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-36 h-[min(72vw,30rem)] w-[min(72vw,30rem)] rounded-full bg-[#ead9be]/55 blur-2xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="display-font inline-flex items-center rounded-md text-2xl font-semibold tracking-[-0.04em] text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#bd7e3e]" />
            MediMate
          </Link>
          <ThemeToggle />
        </div>

        <section
          aria-labelledby="login-heading"
          className="rounded-[2rem] border border-[#dfe3d6] bg-[#fbfaf5]/95 p-6 shadow-[0_24px_60px_-40px_rgba(37,74,56,0.45)] backdrop-blur sm:p-9"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#89754d]">Your MediMate workspace</p>
          <h1 id="login-heading" className="display-font text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#254a38] sm:text-4xl">
            Sign in or create an account
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5b6b61]">
            Keep your health profile, daily logs and assistant conversations in one place. New accounts start
            empty.
          </p>

          {signedOut && !errorMessage && (
            <p role="status" className="mt-6 rounded-xl border border-[#cfe0d2] bg-[#eef5ef] px-4 py-3 text-sm text-[#254a38]">
              You have signed out.
            </p>
          )}
          {errorMessage && (
            <p role="alert" className="mt-6 rounded-xl border border-[#e7b9a8] bg-[#fbeee8] px-4 py-3 text-sm text-[#7a3520]">
              {errorMessage}
            </p>
          )}

          <div className="mt-8">
            <ContinueWithGoogle next={next} />
          </div>

          <ul className="mt-8 space-y-2 border-t border-[#e6e8df] pt-6 text-xs leading-5 text-[#6b776f]">
            <li>Hackathon demo: only the first 5 accounts can sign up.</li>
            <li>Synthetic demo data — do not enter real health information. Use made-up details only.</li>
            <li>MediMate gives general information, not a diagnosis. In an emergency call your local emergency number.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
