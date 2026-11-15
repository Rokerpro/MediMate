/**
 * MediMate "Moment lens" mark: a lens on a timeline with today's moment in
 * focus. The ring and timeline use currentColor so the mark follows the theme.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 64 64" fill="none">
      <path d="M4 32h10M50 32h10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="5.5" />
      <circle cx="32" cy="32" r="6.5" fill="#d2a06c" />
    </svg>
  );
}
