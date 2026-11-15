import type { Metadata } from "next";
import { Suspense } from "react";

import { WelcomeForm } from "@/components/welcome-form";

export const metadata: Metadata = { title: "Welcome · MediMate" };

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-7 sm:space-y-9">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89754d]">Welcome to MediMate</p>
        <h1 className="display-font mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-[#243b30] sm:text-5xl">Set up your profile</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5b6b61] sm:text-base sm:leading-7">
          Your name and age are needed to continue; everything else is optional and can be changed later on the
          Profile page. This is a demo: use made-up details, not real health information.
        </p>
      </div>
      <section className="rounded-[2rem] border border-[#dfe3d6] bg-[#fbfaf5] p-5 shadow-[0_20px_55px_-42px_rgba(37,74,56,0.4)] sm:p-8">
        <Suspense fallback={<p role="status" className="text-sm text-[#5b6b61]">Loading your profile…</p>}>
          <WelcomeForm />
        </Suspense>
      </section>
    </div>
  );
}
