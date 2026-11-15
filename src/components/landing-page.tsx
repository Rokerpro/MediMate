import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/brand-mark";
import { WorkspaceLink } from "@/components/workspace-link";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { ThemeToggle } from "@/components/theme-toggle";

const steps = [
  {
    number: "01",
    title: "Check in",
    text: "Tap your pain, sleep and mood, and add a few words. It takes under a minute.",
  },
  {
    number: "02",
    title: "Ask",
    text: "Describe a concern. MediMate asks follow-up questions and pulls in only the records that relate to it.",
  },
  {
    number: "03",
    title: "Bring it to care",
    text: "Print a dated, doctor-readable summary of what you noticed and what you want to ask.",
  },
];

const features: { title: string; text: string; wide?: boolean; preview?: ReactNode }[] = [
  {
    title: "Today",
    text: "A daily check-in, your last 7 days at a glance and what is coming up next.",
    wide: true,
    preview: (
      <div className="mt-6 flex h-20 items-end gap-2">
        {[35, 60, 25, 75, 45, 55, 40].map((height, index) => (
          <span
            key={index}
            className={`flex-1 rounded-t-md ${index === 6 ? "bg-[#c98b48]" : "bg-[#cbd6c5]"}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    ),
  },
  {
    title: "Assistant with history",
    text: "Every answer lists the dated records it used, and keeps your history apart from medical references.",
  },
  {
    title: "Insights",
    text: "Trends over 7, 14 or 30 days. Associations to talk about, never causes.",
  },
  {
    title: "Medicines & reminders",
    text: "Look up what a medicine is generally for, in plain English, and set your own reminders. Never doses or advice on taking it.",
  },
  {
    title: "Doctor summary",
    text: "A print-ready summary of your profile, recent logs and charts.",
    preview: (
      <div className="mt-6 space-y-2">
        {["Profile & conditions", "Last 14 days of logs", "Pain and sleep charts"].map((line) => (
          <div key={line} className="flex items-center gap-3 rounded-xl border border-[#dfe3d6] bg-[#fffdf8] px-3 py-2 text-sm text-[#40564a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#527158]" />
            {line}
          </div>
        ))}
      </div>
    ),
  },
];

const safety = [
  ["Checks for warning signs first", "Fixed rules based on NHS guidance run before the AI. If one matches, you see urgent-care guidance and the AI cannot override it."],
  ["Shows its sources", "Your records, cited references and the AI's interpretation are labelled separately."],
  ["Says what it does not know", "Answers list uncertainty and missing information, and never give probabilities or a diagnosis."],
];

const faqs = [
  ["Is MediMate a doctor?", "No. MediMate is an educational prototype. It cannot diagnose, replace professional care or confirm what is causing a symptom."],
  ["What happens to my health history?", "Your records are visible only to your account. For each conversation, MediMate picks the relevant recent records and shows them with their dates."],
  ["Does it send reminders or notifications?", "Only if you turn them on. Reminders use your own wording, by web push or email, until you confirm. MediMate never advises on medicines or doses."],
  ["Can I use real health information?", "No. This public prototype is for synthetic demo data only. Please use made-up details."],
];

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M3 13 13 3M5 3h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Static, decorative preview of the app: Today check-in plus an assistant answer. */
function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-[#dbe2ce]/70 blur-2xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-[#dfe3d6] bg-[#f7f5ed] shadow-[0_40px_80px_-40px_rgba(37,74,56,.45)]">
        <div className="flex items-center gap-1.5 border-b border-[#dfe3d6] bg-[#fffdf8] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#dfe3d6]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dfe3d6]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dfe3d6]" />
          <span className="ml-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#66766b]">Today</span>
        </div>
        <div className="space-y-4 p-5">
          <p className="display-font text-2xl tracking-[-.03em] text-[#254a38]">Good afternoon, Sam</p>
          <div className="rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#66766b]">Pain level</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((level) => (
                <span
                  key={level}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                    level === 3 ? "border-[#254a38] bg-[#254a38] text-[#fbfaf5]" : "border-[#cbd6c5] text-[#40564a]"
                  }`}
                >
                  {level}
                </span>
              ))}
            </div>
            <p className="mt-3 rounded-xl border border-[#cbd6c5] bg-white px-3 py-2 text-xs text-[#5b6b61]">
              Lower back stiff after a long desk day
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
            <div className="rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#bd7e3e]">Assistant</p>
              <p className="mt-2 text-sm leading-6 text-[#40564a]">
                You logged similar stiffness on 11 Nov after a long day sitting. That is an association to mention to a clinician, not a cause.
              </p>
            </div>
            <div className="rounded-2xl bg-[#254a38] p-4 text-[#f7f5ed]">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#d9c99f]">History used</p>
              <ul className="mt-2 space-y-1.5 text-xs">
                <li className="rounded-lg bg-white/10 px-2.5 py-1.5">Log · 11 Nov</li>
                <li className="rounded-lg bg-white/10 px-2.5 py-1.5">Log · 15 Nov</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <>
      <ScrollAwareHeader
        className="w-full border-b border-[#dfe3d6] bg-[#f7f5ed]/95 backdrop-blur"
        spacerClassName="h-[73px]"
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="group flex items-center gap-2 rounded-md text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
            <BrandMark className="h-8 w-8 transition-transform duration-500 group-hover:scale-110" />
            <span className="display-font text-2xl font-semibold tracking-[-0.04em]">MediMate</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-[#52655a] md:flex">
            <a href="#how" className="inline-flex min-h-10 items-center transition-colors hover:text-[#254a38]">How it works</a>
            <a href="#features" className="inline-flex min-h-10 items-center transition-colors hover:text-[#254a38]">Features</a>
            <a href="#safety" className="inline-flex min-h-10 items-center transition-colors hover:text-[#254a38]">Safety</a>
            <a href="#questions" className="inline-flex min-h-10 items-center transition-colors hover:text-[#254a38]">Questions</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu variant="landing" />
          </div>
        </nav>
      </ScrollAwareHeader>

      <main className="landing-page overflow-x-clip bg-[#f7f5ed] text-[#24352d]">
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pb-24 lg:grid-cols-[1fr_1.05fr] lg:px-12 lg:pt-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#dec9a8] bg-[#f5ead9] px-3.5 py-1.5 text-xs font-semibold text-[#654a2e] reveal">
              <span className="h-1.5 w-1.5 rounded-full bg-[#bd7e3e]" />
              Synthetic demo · educational, not diagnostic
            </p>
            <h1 className="display-font mt-6 text-[clamp(3.2rem,7vw,6.5rem)] leading-[0.92] tracking-[-0.06em] text-[#254a38] reveal reveal-delay-1">
              Notice more.
              <br />
              <em className="font-normal text-[#bd7e3e]">Assume less.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#5b6b61] reveal reveal-delay-2">
              Log how you feel in a minute a day. When something worries you, MediMate looks back at your own history first, then helps you work out what to ask a clinician.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3 reveal reveal-delay-3">
              <WorkspaceLink
                className="landing-button landing-button-primary"
                signedOutLabel="Get started"
                signedInLabel="Open your dashboard"
                icon={<> <ArrowUpRight /></>}
              />
              <a href="#how" className="landing-button landing-button-quiet">How it works</a>
            </div>
            <ul className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-[#dfe3d6] pt-6 text-sm reveal reveal-delay-3">
              {[["1 min", "daily check-in"], ["Dated", "history in every answer"], ["Safety", "checks before the AI"]].map(([value, label]) => (
                <li key={label}>
                  <p className="display-font text-2xl text-[#254a38]">{value}</p>
                  <p className="mt-1 leading-5 text-[#66766b]">{label}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal reveal-delay-2">
            <ProductPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-[#dfe3d6] bg-[#eef0e5]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
            <p className="landing-kicker">How it works</p>
            <h2 className="display-font mt-4 max-w-2xl text-4xl leading-[1] tracking-[-.05em] text-[#254a38] sm:text-5xl">
              From noticing to knowing what to ask.
            </h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="landing-feature-card">
                  <span className="display-font text-3xl text-[#c98b48]">{step.number}</span>
                  <h3 className="mt-8 text-xl font-semibold text-[#254a38]">{step.title}</h3>
                  <p className="mt-3 leading-7 text-[#66766b]">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="landing-kicker">Inside the app</p>
              <h2 className="display-font mt-4 max-w-xl text-4xl leading-[1] tracking-[-.05em] text-[#254a38] sm:text-5xl">
                A quiet workspace for your health story.
              </h2>
            </div>
            <p className="max-w-sm leading-7 text-[#66766b]">Works on your phone and desktop, and installs like an app.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className={`rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-6 transition-transform duration-300 hover:-translate-y-1 ${feature.wide ? "md:col-span-2" : ""}`}
              >
                <h3 className="text-lg font-semibold text-[#254a38]">{feature.title}</h3>
                <p className="mt-2 leading-7 text-[#66766b]">{feature.text}</p>
                {feature.preview}
              </article>
            ))}
            <article className="flex flex-col gap-3 rounded-3xl bg-[#254a38] p-6 text-[#f7f5ed] md:col-span-3 md:flex-row md:items-center md:justify-between md:px-8">
              <h3 className="display-font text-2xl leading-tight tracking-[-.03em]">Your records stay yours.</h3>
              <p className="max-w-md text-sm leading-6 text-[#cfe0d2]">Sign in with Google. Each account only sees its own profile, logs and conversations.</p>
            </article>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#254a38] px-6 py-12 text-[#f7f5ed] sm:px-12 sm:py-16">
            <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full border-[40px] border-[#527158]/50" aria-hidden="true" />
            <div className="relative grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="landing-kicker landing-kicker-light">Safety first</p>
                <h2 className="display-font mt-4 text-4xl leading-[1] tracking-[-.05em] sm:text-5xl">Careful by design.</h2>
                <p className="mt-5 max-w-sm leading-7 text-[#cfe0d2]">
                  MediMate is not a doctor. In an emergency, call your local emergency number.
                </p>
              </div>
              <ul className="grid gap-3">
                {safety.map(([title, text]) => (
                  <li key={title} className="rounded-2xl border border-white/15 bg-white/[.08] p-5">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#cfe0d2]">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="questions" className="border-t border-[#dfe3d6] bg-[#eef0e5]">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="landing-kicker text-center">Questions</p>
            <h2 className="display-font mt-4 text-center text-4xl leading-[1] tracking-[-.05em] text-[#254a38] sm:text-5xl">
              Before you step inside.
            </h2>
            <div className="mt-10 divide-y divide-[#d2d9ca] border-y border-[#d2d9ca]">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md text-lg font-semibold text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
                    {question}
                    <span aria-hidden="true" className="text-2xl font-normal text-[#bd7e3e] transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="max-w-2xl pt-3 leading-7 text-[#66766b]">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#dbe2ce] px-6 py-14 text-center sm:px-12">
            <div className="relative">
              <BrandMark className="mx-auto h-10 w-10 text-[#527158]" />
              <h2 className="display-font mx-auto mt-5 max-w-2xl text-4xl leading-[1] tracking-[-.05em] text-[#254a38] sm:text-6xl">
                Your health story deserves room to breathe.
              </h2>
              <p className="mx-auto mt-5 max-w-lg leading-7 text-[#5b6b61]">Try the synthetic demo. Use made-up details only.</p>
              <WorkspaceLink
                className="landing-button landing-button-primary mt-8"
                signedOutLabel="Get started"
                signedInLabel="Open your dashboard"
                icon={<> <ArrowUpRight /></>}
              />
            </div>
          </div>
        </section>

        <footer className="border-t border-[#dfe3d6]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-[#66766b] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <div className="flex items-center gap-2 text-[#254a38]">
              <BrandMark className="h-6 w-6" />
              <span className="display-font text-lg font-semibold">MediMate</span>
            </div>
            <p>Synthetic demo data only. Educational information, not medical advice.</p>
            <WorkspaceLink
              className="inline-flex min-h-10 items-center font-semibold text-[#527158] hover:text-[#254a38]"
              signedOutLabel="Sign in"
              signedInLabel="Open your dashboard"
              icon={<span aria-hidden="true"> →</span>}
            />
          </div>
        </footer>
      </main>
    </>
  );
}
