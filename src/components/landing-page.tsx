import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { WorkspaceLink } from "@/components/workspace-link";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    number: "01",
    title: "Keep your story together",
    text: "A calm home for your synthetic profile, daily observations, sleep, activity and mood — ready to review when you need it.",
  },
  {
    number: "02",
    title: "Ask with context",
    text: "MediMate looks for relevant recent history before it responds, so the conversation starts with what you have already recorded.",
  },
  {
    number: "03",
    title: "Stay clear about limits",
    text: "Structured answers separate observations, references, unknowns and next steps. The assistant is educational, not diagnostic.",
  },
];

const steps = [
  ["01", "Record", "Capture a small daily observation in your own words."],
  ["02", "Connect", "MediMate retrieves only relevant recent history."],
  ["03", "Reflect", "Explore a careful summary to discuss with a professional."],
];

const faqs = [
  ["Is MediMate a doctor?", "No. MediMate is an educational prototype and cannot diagnose, replace professional care or confirm what is causing a symptom."],
  ["What happens to my health history?", "The demo uses one synthetic profile. Relevant records are selected for a conversation and shown with their dates so you can see what informed the response."],
  ["Does it send reminders or notifications?", "Reminders are optional, user-written and visible inside the app only. MediMate does not send push, SMS or email notifications."],
  ["Can I use real health information?", "No. This public prototype is designed for synthetic demo data only. Do not enter real health information."],
];

function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 42 42" fill="none">
      <path d="M37.5 4.5C21.2 5.3 8.9 11.8 7.2 24.7c-.8 6.1 3.9 10.1 8.5 9.5C29.1 32.7 36.2 20.8 37.5 4.5Z" fill="currentColor" />
      <path d="M7.5 37.5C13.4 25.9 21.3 18.7 31.7 12.6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M3 13 13 3M5 3h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <>
      <ScrollAwareHeader
        className="w-full border-b border-[#dfe3d6] bg-[#f7f5ed]/95 backdrop-blur"
        spacerClassName="h-[81px]"
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" className="group flex items-center gap-2 text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
            <LeafMark className="h-8 w-8 transition-transform duration-500 group-hover:-rotate-12" />
            <span className="display-font text-2xl font-semibold tracking-[-0.04em]">MediMate</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-[#52655a] md:flex">
            <a href="#why" className="transition-colors hover:text-[#254a38]">Why MediMate</a>
            <a href="#how" className="transition-colors hover:text-[#254a38]">How it works</a>
            <a href="#questions" className="transition-colors hover:text-[#254a38]">Questions</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu variant="landing" />
          </div>
        </nav>
      </ScrollAwareHeader>

    <main className="landing-page overflow-x-clip bg-[#f7f5ed] text-[#24352d]">
      <div className="landing-grain pointer-events-none fixed inset-0 z-50 opacity-[0.035]" aria-hidden="true" />

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:pt-20">
        <div className="relative z-10 max-w-2xl">
          <p className="landing-kicker reveal">A gentler way to make sense of your health story</p>
          <h1 className="display-font mt-6 text-[clamp(3.8rem,8vw,7.8rem)] leading-[0.88] tracking-[-0.075em] text-[#254a38] reveal reveal-delay-1">
            Notice more.
            <br />
            <em className="font-normal text-[#bd7e3e]">Assume less.</em>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#5b6b61] reveal reveal-delay-2 sm:text-xl">
            MediMate brings your daily observations and thoughtful conversations into one history-aware space — so you can arrive at care with a clearer, more useful story.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4 reveal reveal-delay-3">
            <WorkspaceLink
              className="landing-button landing-button-primary"
              signedOutLabel="Get started"
              signedInLabel="Open your dashboard"
              icon={<> <ArrowUpRight /></>}
            />
            <a href="#how" className="landing-button landing-button-quiet">See the approach</a>
          </div>
          <p className="mt-6 max-w-md text-xs leading-5 text-[#77857c] reveal reveal-delay-3">
            Synthetic demo data — do not enter real health information. MediMate is educational and not a diagnostic tool.
          </p>
        </div>

        <div className="relative min-h-[430px] reveal reveal-delay-2 sm:min-h-[560px]">
          <div className="organic-orbit absolute left-1/2 top-1/2 h-[min(84vw,520px)] w-[min(84vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[46%_54%_63%_37%/47%_43%_57%_53%] bg-[#dbe2ce] opacity-80" />
          <div className="organic-orbit absolute left-[55%] top-[48%] h-[min(68vw,390px)] w-[min(68vw,390px)] -translate-x-1/2 -translate-y-1/2 rounded-[59%_41%_36%_64%/47%_61%_39%_53%] border border-[#b5c3a9] bg-[#eef0df]" />
          <div className="absolute left-[8%] top-[15%] h-20 w-20 rounded-full bg-[#d2a06c] opacity-80 blur-[1px] float-slow" />
          <div className="absolute right-[5%] top-[10%] h-4 w-4 rounded-full bg-[#7f9b72]" />
          <div className="absolute bottom-[12%] left-[12%] h-3 w-3 rounded-full bg-[#bd7e3e]" />
          <svg className="absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2" viewBox="0 0 520 520" fill="none" aria-hidden="true">
            <path d="M264 444c-3-93-3-178-5-289" stroke="#688269" strokeWidth="3" strokeLinecap="round" />
            <path d="M260 286c-51-45-84-50-112-39 26 38 60 51 112 39Zm3-47c41-39 76-43 103-29-22 37-54 48-103 29Zm-3-65c-31-32-61-39-85-31 16 31 43 43 85 31Zm2-39c28-31 58-38 83-30-14 31-41 44-83 30Z" fill="#688269" />
            <path d="M258 344c-44-31-76-28-97-12 26 30 55 35 97 12Zm7-35c39-30 70-27 92-10-24 29-52 35-92 10Z" fill="#8ca17e" />
            <path d="M203 418c-41-12-68-2-82 17 30 17 55 13 82-17Zm112 5c39-14 67-5 82 14-30 19-56 16-82-14Z" fill="#8ca17e" />
          </svg>
          <div aria-hidden="true" className="absolute bottom-[10%] right-[2%] w-60 rounded-3xl border border-white/70 bg-[#fffdf8]/90 p-4 shadow-[0_20px_50px_rgba(54,75,60,.15)] backdrop-blur-md float-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#789078]">Today&apos;s check-in</span>
              <span className="h-2 w-2 rounded-full bg-[#c98b48]" />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#8a978d]">Pain</p>
            <div className="mt-1.5 flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <span key={level} className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${level === 2 ? "border-[#254a38] bg-[#254a38] text-[#fbfaf5]" : "border-[#cbd6c5] text-[#40564a]"}`}>{level}</span>
              ))}
            </div>
            <p className="mt-3 rounded-xl border border-[#dfe3d6] bg-white/80 px-3 py-2 text-xs text-[#5b6b61]">Back stiff after a long desk day</p>
          </div>
        </div>
      </section>

      <section id="why" className="relative border-y border-[#dfe3d6] bg-[#eef0e5]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
            <div>
              <p className="landing-kicker">The idea</p>
              <h2 className="display-font mt-5 max-w-md text-5xl leading-[.95] tracking-[-.06em] text-[#254a38] sm:text-6xl">Health is a story, not a snapshot.</h2>
            </div>
            <div className="max-w-2xl text-lg leading-8 text-[#5b6b61]">
              <p>Between a symptom and a clinical conversation, there are often tiny details: a change in sleep, a recurring note, a question you forgot to ask.</p>
              <p className="mt-5">MediMate gives those details somewhere to land. It helps you organize what you have noticed and reflect on it without pretending to know more than it does.</p>
              <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-[#bd7e3e]"><span className="h-px w-10 bg-[#bd7e3e]" />Built for clarity before care</div>
            </div>
          </div>
          <div className="mt-20 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.number} className="landing-feature-card group">
                <span className="text-sm font-semibold text-[#bd7e3e]">{feature.number}</span>
                <h3 className="display-font mt-16 text-3xl leading-tight tracking-[-.04em] text-[#254a38]">{feature.title}</h3>
                <p className="mt-4 leading-7 text-[#66766b]">{feature.text}</p>
                <span className="mt-8 block h-px w-8 bg-[#aab9a0] transition-all duration-500 group-hover:w-16 group-hover:bg-[#bd7e3e]" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid items-start gap-14 lg:grid-cols-[.75fr_1.25fr] lg:gap-24">
          <div>
            <p className="landing-kicker">A considered process</p>
            <h2 className="display-font mt-5 text-5xl leading-[.95] tracking-[-.06em] text-[#254a38] sm:text-6xl">From noticing to knowing what to ask.</h2>
          </div>
          <div className="divide-y divide-[#dfe3d6] border-y border-[#dfe3d6]">
            {steps.map(([number, title, text]) => (
              <div key={number} className="group grid gap-4 py-8 sm:grid-cols-[80px_170px_1fr] sm:items-center">
                <span className="display-font text-3xl text-[#c98b48]">{number}</span>
                <h3 className="text-lg font-semibold text-[#254a38] transition-transform duration-300 group-hover:translate-x-1">{title}</h3>
                <p className="leading-7 text-[#66766b]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#254a38] px-6 py-10 text-[#f7f5ed] sm:px-12 sm:py-14">
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border-[40px] border-[#527158]/50" aria-hidden="true" />
          <div className="absolute -bottom-28 right-24 h-56 w-56 rounded-full bg-[#688269]/30 blur-2xl" aria-hidden="true" />
          <div className="relative grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="landing-kicker landing-kicker-light">Inside the workspace</p>
              <h2 className="display-font mt-5 text-5xl leading-[.92] tracking-[-.06em] sm:text-6xl">A quieter dashboard for a noisy world.</h2>
            </div>
            <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/[.08] p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#d2a06c]">Today</p>
                <p className="display-font mt-2 text-2xl">Good morning</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[["Avg pain", "3.3"], ["Avg sleep", "6h 50m"], ["Logs", "7"]].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white/10 px-2 py-3">
                      <p className="text-[10px] text-[#d9c99f]">{label}</p>
                      <p className="display-font mt-1 text-lg">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex h-12 items-end gap-1.5">
                  {[30, 55, 20, 70, 40, 50, 60].map((height, index) => (
                    <span key={index} className={`flex-1 rounded-t ${index === 6 ? "bg-[#d9c99f]" : "bg-[#c8d4bf]/80"}`} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/[.08] p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#d2a06c]">History used</p>
                <p className="mt-2 font-medium">2 records informed this answer</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {[["Log · 11 Nov", "Back stiffness, eased after a walk"], ["Log · 15 Nov", "Lower back stiff after desk day"]].map(([date, text]) => (
                    <li key={date} className="rounded-xl bg-white/10 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#d9c99f]">{date}</p>
                      <p className="mt-0.5 leading-5 text-[#eef0e5]">{text}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-[#cfe0d2]">Associations, not causes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dfe3d6] bg-[#f1eadf]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:px-12">
          <div>
            <p className="landing-kicker">Made for real conversations</p>
            <h2 className="display-font mt-5 max-w-xl text-5xl leading-[.95] tracking-[-.06em] text-[#254a38] sm:text-6xl">Less “what was that again?” More “here’s what I noticed.”</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["For the prepared patient", "Bring a dated, personal record to the appointment — without turning it into a diagnosis."],
              ["For the curious observer", "Notice routines, questions and changes in one place, at your own pace."],
              ["For the busy day", "Log a few words now and return to the bigger picture later."],
              ["For the care conversation", "Share what you know, what you do not know, and what you want to ask next."],
            ].map(([title, text]) => (
              <article key={title} className="rounded-2xl border border-[#d9d4c6] bg-[#faf8f2]/70 p-6">
                <h3 className="font-semibold text-[#254a38]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#66766b]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="landing-kicker">The foundation</p>
            <h2 className="display-font mt-5 text-5xl leading-[.95] tracking-[-.06em] text-[#254a38] sm:text-6xl">Small, deliberate, transparent.</h2>
            <p className="mt-7 max-w-xl leading-7 text-[#66766b]">MediMate is built as a focused prototype: a single Next.js app, a bounded synthetic data model, curated references and fixed safety checks before the AI is called.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end text-sm">
            {["Next.js", "TypeScript", "Tailwind CSS", "Zod", "Supabase", "Curated NHS and Patient.info sources"].map((item) => (
              <div key={item} className="rounded-xl border border-[#dfe3d6] bg-white/60 px-4 py-4 font-medium text-[#52655a]">{item}</div>
            ))}
          </div>
        </div>
        <div className="mt-20 grid gap-8 border-t border-[#dfe3d6] pt-8 md:grid-cols-3">
          <div><p className="landing-kicker">Now</p><p className="mt-3 text-lg text-[#254a38]">Profile, logs and history-aware assistant</p></div>
          <div><p className="landing-kicker">Next</p><p className="mt-3 text-lg text-[#254a38]">A more useful bridge into care conversations</p></div>
          <div><p className="landing-kicker">Always</p><p className="mt-3 text-lg text-[#254a38]">Clear limits, synthetic data and safer defaults</p></div>
        </div>
      </section>

      <section id="questions" className="border-t border-[#dfe3d6] bg-[#eef0e5]">
        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="text-center">
            <p className="landing-kicker">Good questions belong here</p>
            <h2 className="display-font mt-5 text-5xl leading-[.95] tracking-[-.06em] text-[#254a38] sm:text-6xl">Before you step inside.</h2>
          </div>
          <div className="mt-12 divide-y divide-[#d2d9ca] border-y border-[#d2d9ca]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]">
                  {question}
                  <span className="text-2xl font-normal text-[#bd7e3e] transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pt-4 leading-7 text-[#66766b]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#d8e1cf] px-6 py-14 text-center sm:px-12">
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#c4d2ba] blur-2xl" aria-hidden="true" />
          <div className="absolute -bottom-28 -right-10 h-64 w-64 rounded-full bg-[#e8d0b1] blur-2xl" aria-hidden="true" />
          <div className="relative">
            <LeafMark className="mx-auto h-10 w-10 text-[#527158]" />
            <h2 className="display-font mx-auto mt-6 max-w-2xl text-5xl leading-[.92] tracking-[-.06em] text-[#254a38] sm:text-7xl">Your health story deserves room to breathe.</h2>
            <p className="mx-auto mt-6 max-w-xl leading-7 text-[#5b6b61]">Step into the synthetic demo and see a more thoughtful way to organize what you notice.</p>
            <WorkspaceLink
              className="landing-button landing-button-primary mt-9"
              signedOutLabel="Enter MediMate"
              signedInLabel="Open your dashboard"
              icon={<> <ArrowUpRight /></>}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#dfe3d6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-[#718078] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center gap-2 text-[#254a38]"><LeafMark className="h-6 w-6" /><span className="display-font text-lg font-semibold">MediMate</span></div>
          <p>Synthetic demo data only. Educational information, not medical advice.</p>
          <WorkspaceLink
            className="font-semibold text-[#527158] hover:text-[#254a38]"
            signedOutLabel="Open workspace"
            signedInLabel="Open your dashboard"
            icon={<span aria-hidden="true"> →</span>}
          />
        </div>
      </footer>
    </main>
    </>
  );
}
