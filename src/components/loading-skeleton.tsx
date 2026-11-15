/**
 * Placeholder cards shown while data loads. The visible label stays for
 * screen readers and as a text cue; the bars are decorative.
 */
export function LoadingSkeleton({
  label,
  rows = 3,
  className = "",
}: {
  label: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={`space-y-3 ${className}`}>
      <p className="text-sm text-[#5b6b61]">{label}</p>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 motion-safe:animate-pulse"
          >
            <div className="h-4 w-1/3 rounded-full bg-[#e4e1d2]" />
            <div className="mt-4 h-3 w-full rounded-full bg-[#eeece1]" />
            <div className="mt-2 h-3 w-4/5 rounded-full bg-[#eeece1]" />
          </div>
        ))}
      </div>
    </div>
  );
}
