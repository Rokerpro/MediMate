"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PROFILE_SAVED_EVENT, getCurrentUser, signOut } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/validations";

type AccountMenuProps = {
  variant?: "app" | "landing";
};

/** Signed-in user's name or avatar with a sign-out action. */
export function AccountMenu({ variant = "app" }: AccountMenuProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoaded(false);
      setLoadFailed(false);
      getCurrentUser()
        .then(({ user: current }) => {
          if (!cancelled) {
            setUser(current);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoaded(true);
            setLoadFailed(true);
          }
        });
    };
    load();
    // The header stays mounted across pages, so refresh the name after onboarding or a profile edit.
    window.addEventListener(PROFILE_SAVED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_SAVED_EVENT, load);
    };
  }, [retryCount]);

  useEffect(() => {
    if (variant !== "landing" || !menuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, variant]);

  const initial = (user?.displayName.trim()[0] ?? "?").toUpperCase();
  const avatarUrl = user?.avatarUrl && failedAvatarUrl !== user.avatarUrl ? user.avatarUrl : null;

  if (variant === "landing") {
    if (!loaded) {
      return (
        <span
          role="status"
          className="inline-flex h-11 w-11 rounded-full border border-[#dfe3d6] bg-white/70"
        >
          <span className="sr-only">Checking sign-in status</span>
        </span>
      );
    }

    if (loadFailed) {
      return (
        <div role="status" className="flex items-center gap-2 text-xs text-[#52655a]">
          <span>Could not check sign-in status.</span>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="rounded-full px-2 py-1 font-semibold text-[#254a38] underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!user) {
      return (
        <Link href="/login" className="landing-pill landing-pill-dark">
          Sign in
        </Link>
      );
    }

    return (
      <div ref={containerRef} className="relative flex shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Open account menu for ${user.displayName}`}
          aria-expanded={menuOpen}
          aria-controls="landing-account-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#bdc8bb] bg-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
        >
          {avatarUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatarUrl(avatarUrl)}
                className="h-full w-full object-cover"
              />
            </>
          ) : (
            <span aria-hidden="true" className="font-semibold text-[#254a38]">
              {initial}
            </span>
          )}
        </button>
        <div
          id="landing-account-menu"
          hidden={!menuOpen}
          className="absolute right-0 top-full z-30 mt-3 min-w-48 rounded-2xl border border-[#dfe3d6] bg-[#fbfaf5] p-3 text-[#24352d] shadow-xl"
        >
          <p className="truncate px-2 py-1 text-sm font-semibold" title={user.displayName}>
            {user.displayName}
          </p>
          <button
            type="button"
            onClick={() => {
              setSigningOut(true);
              void signOut();
            }}
            disabled={signingOut}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {user && (
        <span
          className="hidden items-center gap-2 text-sm text-[#40564a] lg:inline-flex"
          title={user.email ?? undefined}
        >
          {avatarUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatarUrl(avatarUrl)}
                className="h-8 w-8 rounded-full object-cover"
              />
            </>
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#254a38] text-xs font-semibold text-[#fbfaf5]"
            >
              {initial}
            </span>
          )}
          <span className="max-w-[10rem] truncate">{user.displayName}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          setSigningOut(true);
          void signOut();
        }}
        disabled={signingOut}
        className="rounded-full border border-[#dfe3d6] px-3 py-1.5 text-sm font-medium text-[#254a38] transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
