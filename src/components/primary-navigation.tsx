"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

type IconName =
  | "today"
  | "assistant"
  | "logs"
  | "insights"
  | "reminders"
  | "prescriptions"
  | "summary"
  | "more";

const ICON_PATHS: Record<IconName, string> = {
  today: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z",
  assistant:
    "M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4.7A2.5 2.5 0 0 1 5 13.5v-7ZM8.5 8.5h7M8.5 11.5h4",
  logs: "M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 9h7M8.5 12.5h7M8.5 16h4",
  insights: "M4 19h16M7 16v-4M12 16V7M17 16v-6",
  reminders:
    "M12 21a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2ZM18 16V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z",
  prescriptions:
    "M8.5 4h7l1 3h-9l1-3ZM7 7h10v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7ZM12 11v6M9 14h6",
  summary: "M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4M9 12h6M9 16h6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

export function NavIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d={ICON_PATHS[name]}
        stroke="currentColor"
        strokeWidth={name === "more" ? 3 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Today", icon: "today" },
  { href: "/assistant", label: "Assistant", icon: "assistant" },
  { href: "/logs", label: "Daily logs", icon: "logs" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/reminders", label: "Reminders", icon: "reminders" },
  { href: "/prescriptions", label: "Prescriptions", icon: "prescriptions" },
  { href: "/summary", label: "Summary", icon: "summary" },
];

/** Items reachable from the phone "More" sheet (not in the tab bar). */
const MORE_HREFS = ["/reminders", "/prescriptions", "/summary", "/profile"];

const subscribeToPortalTarget = () => () => {};
const getPortalTarget = () => document.body;
const getServerPortalTarget = () => null;

export function SidebarNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
              isActive
                ? "bg-[#254a38] text-[#fbfaf5]"
                : "text-[#40564a] hover:bg-[#eef0e5] hover:text-[#254a38]"
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TabLink({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: IconName;
  pathname: string;
}) {
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
        isActive ? "text-[#254a38]" : "text-[#6b776f]"
      }`}
    >
      <span
        className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
          isActive ? "bg-[#dfe8d8]" : ""
        }`}
      >
        <NavIcon name={icon} />
      </span>
      {label}
    </Link>
  );
}

/** Phone navigation: bottom tab bar with a raised assistant button and a "More" sheet. */
export function MobileTabBar({ moreFooter }: { moreFooter?: ReactNode }) {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const portalTarget = useSyncExternalStore(
    subscribeToPortalTarget,
    getPortalTarget,
    getServerPortalTarget,
  );
  const isOpen = openForPath === pathname;
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const moreActive = MORE_HREFS.includes(pathname);
  const assistantActive = pathname === "/assistant";

  useEffect(() => {
    if (!isOpen) return;
    const moreButton = moreButtonRef.current;
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
      moreButton?.focus({ preventScroll: true });
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

  const moreItems = [
    ...navigation.filter((item) => MORE_HREFS.includes(item.href)),
    { href: "/profile", label: "Profile", icon: "today" as IconName },
  ];

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-[75] border-t border-[#dfe3d6] bg-[#fffdf8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      >
        <div className="mx-auto flex max-w-lg items-end justify-between px-2 pb-2 pt-1.5">
          <TabLink href="/dashboard" label="Today" icon="today" pathname={pathname} />
          <TabLink href="/logs" label="Logs" icon="logs" pathname={pathname} />
          <Link
            href="/assistant"
            aria-current={assistantActive ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl text-[11px] font-semibold text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
          >
            <span
              className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#254a38] text-white shadow-lg shadow-[#254a38]/30 ring-4 ring-[#f7f5ed] transition-transform active:scale-95 ${
                assistantActive ? "bg-[#1c3a2c]" : ""
              }`}
            >
              <NavIcon name="assistant" className="h-6 w-6" />
            </span>
            Assistant
          </Link>
          <TabLink href="/insights" label="Insights" icon="insights" pathname={pathname} />
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={isOpen}
            aria-controls="mobile-more-navigation"
            onClick={() => setOpenForPath(isOpen ? null : pathname)}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
              moreActive || isOpen ? "text-[#254a38]" : "text-[#6b776f]"
            }`}
          >
            <span
              className={`flex h-8 w-12 items-center justify-center rounded-full ${
                moreActive ? "bg-[#dfe8d8]" : ""
              }`}
            >
              <NavIcon name="more" />
            </span>
            More
          </button>
        </div>
      </nav>

      {portalTarget &&
        createPortal(
          <div
            id="mobile-more-navigation"
            aria-hidden={!isOpen}
            inert={!isOpen}
            className={`fixed inset-0 z-[100] lg:hidden print:hidden ${isOpen ? "" : "pointer-events-none"}`}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close menu"
              onClick={closeMenu}
              className={`absolute inset-0 bg-[#111914]/40 transition-opacity duration-300 motion-reduce:transition-none ${
                isOpen ? "opacity-100" : "opacity-0"
              }`}
            />
            <div
              ref={dialogRef}
              role="dialog"
              aria-label="More pages"
              aria-modal="true"
              onKeyDown={handleDialogKeyDown}
              className={`absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[#dfe3d6] bg-[#fffdf8] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
                isOpen ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#dfe3d6]" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <p className="landing-kicker">More</p>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Close menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dfe3d6] text-[#254a38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <nav aria-label="More pages" className="mt-4 grid grid-cols-2 gap-2">
                {moreItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMenu}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
                        isActive
                          ? "border-[#254a38] bg-[#254a38] text-[#fbfaf5]"
                          : "border-[#dfe3d6] bg-[#f7f5ed] text-[#304739]"
                      }`}
                    >
                      {item.href === "/profile" ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <NavIcon name={item.icon} />
                      )}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              {moreFooter && <div className="mt-5 border-t border-[#dfe3d6] pt-4">{moreFooter}</div>}
            </div>
          </div>,
          portalTarget,
        )}
    </>
  );
}
