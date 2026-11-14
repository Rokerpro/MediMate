import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-blue-700">Synthetic health workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your health overview</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Keep your profile and daily observations organized before discussing them with a
          qualified professional.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/profile"
          className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <h2 className="text-lg font-semibold">Personal profile</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review and update your synthetic profile details.
          </p>
        </Link>
        <Link
          href="/logs"
          className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <h2 className="text-lg font-semibold">Daily health logs</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add an observation and review your timeline.
          </p>
        </Link>
        <Link
          href="/assistant"
          className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <h2 className="text-lg font-semibold">Discuss a concern</h2>
          <p className="mt-2 text-sm text-slate-600">
            Talk through a concern using relevant synthetic history.
          </p>
        </Link>
      </div>
    </div>
  );
}
