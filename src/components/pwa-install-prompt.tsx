"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isStandalone,
  registerServiceWorker,
  type BeforeInstallPromptEvent,
} from "@/lib/push-client";

const DISMISSED_UNTIL_KEY = "medimate-install-dismissed-until-v1";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function installPromptDismissed(): boolean {
  try {
    const dismissedUntil = Number(window.localStorage.getItem(DISMISSED_UNTIL_KEY));
    return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
  } catch {
    return false;
  }
}

// Pages where the prompt would cover a primary form action.
const HIDDEN_ON = ["/login", "/welcome"];

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    void registerServiceWorker();

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (isStandalone() || installPromptDismissed()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(
        DISMISSED_UNTIL_KEY,
        String(Date.now() + DISMISS_DURATION_MS),
      );
    } catch {
      // The prompt remains dismissed for this visit if storage is unavailable.
    }
    setInstallEvent(null);
    setInstallError("");
  }

  async function install() {
    if (!installEvent) return;
    const promptEvent = installEvent;
    setInstallEvent(null);
    setInstallError("");
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      setInstallError("The install prompt could not be opened. You can dismiss this message.");
    }
  }

  if (!installEvent && !installError) return null;
  if (HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return (
    <aside
      aria-labelledby="install-medi-mate-heading"
      className="fixed inset-x-3 bottom-24 z-[90] mx-auto max-w-lg rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-4 sm:inset-x-auto sm:left-5 sm:mx-0 sm:w-[22rem] text-[#24352d] shadow-xl sm:bottom-5 sm:p-5 print:hidden"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="install-medi-mate-heading" className="font-semibold">
            Install MediMate
          </h2>
          {installError && <p role="status" className="mt-1 text-sm text-[#5b6b61]">{installError}</p>}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-2 py-1 text-sm text-[#5b6b61] hover:bg-[#eeece1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
        >
          Not now
        </button>
      </div>
      {installEvent && (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-3 w-full rounded-full bg-[#254a38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d3b2d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bd7e3e] focus-visible:ring-offset-2"
        >
          Install
        </button>
      )}
    </aside>
  );
}
