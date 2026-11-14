"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AssistantChat } from "@/components/assistant-chat";

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeToViewport(callback: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerMobileSnapshot(): boolean {
  return false;
}

export function AssistantChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isMobile = useSyncExternalStore(
    subscribeToViewport,
    getMobileSnapshot,
    getServerMobileSnapshot,
  );
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const launcher = launcherRef.current;
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLTextAreaElement>("textarea")
        ?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      launcher?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!isMobile || event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("inert"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  if (pathname === "/assistant") return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[70] bg-slate-950/30 transition-opacity duration-300 motion-reduce:transition-none md:hidden print:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <section
        id="assistant-chat-popup"
        ref={panelRef}
        role="dialog"
        aria-label="MediMate assistant chat"
        aria-modal={isMobile ? true : undefined}
        aria-hidden={!isOpen}
        inert={!isOpen}
        onKeyDown={handlePanelKeyDown}
        className={`fixed inset-0 z-[80] flex flex-col overflow-hidden bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none md:inset-auto md:bottom-24 md:left-auto md:right-5 md:h-[min(42rem,calc(100vh-7rem))] md:w-[26rem] md:origin-bottom-right md:rounded-2xl md:border md:border-slate-200 print:hidden ${
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0 md:translate-y-4 md:scale-95"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="font-semibold text-slate-950">MediMate assistant</p>
            <p className="text-xs text-slate-600">Educational information, not a diagnosis</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close assistant chat"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <AssistantChat variant="popup" active={isOpen} />
      </section>

      <button
        ref={launcherRef}
        type="button"
        aria-label={isOpen ? "Close assistant chat" : "Open assistant chat"}
        aria-expanded={isOpen}
        aria-controls="assistant-chat-popup"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-5 right-5 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-xl transition duration-200 hover:-translate-y-0.5 hover:bg-blue-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 motion-reduce:transition-none print:hidden"
      >
        {isOpen ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path
              d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2 1-4a7.5 7.5 0 1 1 16-5.5Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="12" r="1" fill="currentColor" />
            <circle cx="12.5" cy="12" r="1" fill="currentColor" />
            <circle cx="16" cy="12" r="1" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
