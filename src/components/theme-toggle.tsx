"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme, storageWarning } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span aria-hidden="true" className="hidden text-xs font-medium text-[#52655a] sm:inline">
        Light
      </span>
      <button
        type="button"
        role="switch"
        aria-label="Dark mode"
        aria-checked={dark}
        title={dark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={toggleTheme}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
        style={{
          backgroundColor: "var(--theme-switch-track)",
          borderColor: "var(--theme-border)",
        }}
      >
        <span
          aria-hidden="true"
          className={`h-4 w-4 rounded-full shadow-sm transition-transform ${dark ? "translate-x-5" : "translate-x-0"}`}
          style={{ backgroundColor: "var(--theme-switch-thumb)" }}
        />
      </button>
      <span aria-hidden="true" className="hidden text-xs font-medium text-[#52655a] sm:inline">
        Dark
      </span>
      {storageWarning && (
        <span role="status" className="max-w-40 text-xs text-[#7a3520]">
          {storageWarning}
        </span>
      )}
    </div>
  );
}
