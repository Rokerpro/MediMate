"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/logs", label: "Daily logs" },
  { href: "/assistant", label: "Assistant" },
  { href: "/reminders", label: "Reminders" },
  { href: "/prescriptions", label: "Prescriptions" },
  { href: "/summary", label: "Summary" },
];

const subscribeToPortalTarget = () => () => {};
const getPortalTarget = () => document.body;
const getServerPortalTarget = () => null;

function NavigationLinks({
  pathname,
  mobile = false,
  onNavigate,
}: {
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return navigation.map((item) => {
    const isActive = pathname === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={`rounded-full font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
          mobile
            ? "block px-5 py-4 text-lg"
            : "px-3 py-2 text-sm"
        } ${
          isActive
            ? "bg-[#dfe8d8] text-[#254a38]"
            : "text-[#66766b] hover:bg-[#eef0e5] hover:text-[#254a38]"
        }`}
      >
        {item.label}
      </Link>
    );
  });
}

export function PrimaryNavigation() {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const portalTarget = useSyncExternalStore(
    subscribeToPortalTarget,
    getPortalTarget,
    getServerPortalTarget,
  );
  const isOpen = openForPath === pathname;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLAnchorElement>("nav a")?.focus();

    function handlePopState() {
      setOpenForPath(null);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", handlePopState);
      menuButton?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  function closeMenu() {
    setOpenForPath(null);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );
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

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="hidden min-w-0 flex-wrap justify-end gap-2 md:flex"
      >
        <NavigationLinks pathname={pathname} />
      </nav>

      <button
        ref={menuButtonRef}
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-primary-navigation"
        onClick={() => setOpenForPath(isOpen ? null : pathname)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#dfe3d6] bg-[#fbfaf5] text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] md:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d={isOpen ? "m6 6 12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {portalTarget &&
        createPortal(
          <div
            id="mobile-primary-navigation"
            ref={dialogRef}
            role="dialog"
            aria-label="Mobile navigation"
            aria-modal="true"
            aria-hidden={!isOpen}
            inert={!isOpen}
            onKeyDown={handleDialogKeyDown}
            className={`fixed inset-0 z-[100] flex flex-col bg-[#f7f5ed] p-5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none md:hidden ${
              isOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-2 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#dfe3d6] pb-5">
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="display-font rounded-md text-2xl font-semibold tracking-[-0.04em] text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
              >
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#bd7e3e] align-middle" />
                MediMate
              </Link>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMenu}
                aria-label="Close navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dfe3d6] text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
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

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6a47]">
              Your workspace
            </p>
            <nav aria-label="Mobile primary navigation" className="mt-4 flex flex-col gap-2">
              <NavigationLinks pathname={pathname} mobile onNavigate={closeMenu} />
            </nav>

            <p className="mt-auto border-t border-[#dec9a8] pt-5 text-sm text-[#654a2e]">
              Synthetic demo data — do not enter real health information.
            </p>
          </div>,
          portalTarget,
        )}
    </>
  );
}
