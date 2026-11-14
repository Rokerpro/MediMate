export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
      <p
        role="note"
        className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      >
        Synthetic demo data — do not enter real health information.
      </p>
      <h1 className="text-3xl font-semibold">MediMate</h1>
      <p>
        History-aware, educational health information. MediMate is not a doctor and does not
        provide diagnoses.
      </p>
    </main>
  );
}
