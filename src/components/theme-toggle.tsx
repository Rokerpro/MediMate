"use client";

import { useTheme } from "@/components/theme-provider";

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

/** One icon button: shows a moon in light mode (switch to dark) and a sun in dark mode. */
export function ThemeToggle() {
  const { theme, toggleTheme, storageWarning } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={toggleTheme}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfe3d6] text-[#40564a] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
      {storageWarning && (
        <span role="status" className="max-w-40 text-xs text-[#7a3520]">
          {storageWarning}
        </span>
      )}
    </div>
  );
}
