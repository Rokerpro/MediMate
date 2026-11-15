"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  storageWarning: string | null;
};

const STORAGE_KEY = "medimate-theme-v1";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    let warning: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      warning = "Theme preference is only available for this visit.";
    }

    const frame = window.requestAnimationFrame(() => {
      if (saved === "light" || saved === "dark") setTheme(saved);
      if (warning) setStorageWarning(warning);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      setStorageWarning(null);
    } catch {
      setStorageWarning("Theme preference could not be saved in this browser.");
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, storageWarning }),
    [storageWarning, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
