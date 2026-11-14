import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="landing-kicker">Synthetic health workspace</p>
        <h1 className="display-font mt-3 text-5xl font-semibold tracking-[-0.05em] text-[#254a38]">Your health overview</h1>
        <p className="mt-3 max-w-2xl text-[#66766b]">
          Keep your profile and daily observations organized before discussing them with a
          qualified professional.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/profile"
          className="rounded-2xl border border-[#d6ddcf] bg-white/70 p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#aab9a0] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#c98b48]"
        >
          <h2 className="text-lg font-semibold text-[#254a38]">Personal profile</h2>
          <p className="mt-2 text-sm text-[#66766b]">
            Review and update your synthetic profile details.
          </p>
        </Link>
        <Link
          href="/logs"
          className="rounded-2xl border border-[#d6ddcf] bg-white/70 p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#aab9a0] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#c98b48]"
        >
          <h2 className="text-lg font-semibold text-[#254a38]">Daily health logs</h2>
          <p className="mt-2 text-sm text-[#66766b]">
            Add an observation and review your timeline.
          </p>
        </Link>
        <Link
          href="/assistant"
          className="rounded-2xl border border-[#d6ddcf] bg-white/70 p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#aab9a0] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#c98b48]"
        >
          <h2 className="text-lg font-semibold text-[#254a38]">Discuss a concern</h2>
          <p className="mt-2 text-sm text-[#66766b]">
            Talk through a concern using relevant synthetic history.
          </p>
        </Link>
      </div>
    </div>
  );
}
