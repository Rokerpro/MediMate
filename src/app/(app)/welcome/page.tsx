import { Suspense } from "react";

import { WelcomeForm } from "@/components/welcome-form";

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6a47]">Welcome to MediMate</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#243b30]">Set up your profile</h1>
        <p className="mt-2 text-[#5b6b61]">
          Your name and age are needed to continue; everything else is optional and can be changed later on the
          Profile page. This is a demo: use made-up details, not real health information.
        </p>
      </div>
      <section className="rounded-3xl border border-[#dfe3d6] bg-[#fbfaf5] p-5 sm:p-8">
        <Suspense fallback={<p role="status">Loading your profile…</p>}>
          <WelcomeForm />
        </Suspense>
      </section>
    </div>
  );
}
