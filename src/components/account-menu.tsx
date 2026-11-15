"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PROFILE_SAVED_EVENT, getCurrentUser } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/validations";

type AccountMenuProps = {
  variant?: "app" | "landing";
  /** App variant only: show the user's name next to the avatar (desktop sidebar). */
  showName?: boolean;
};

/** Signed-in user's avatar with a link to their profile. */
export function AccountMenu({ variant = "app", showName = false }: AccountMenuProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

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
    // The header stays mounted across pages, so refresh the current user after a profile save.
    window.addEventListener(PROFILE_SAVED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_SAVED_EVENT, load);
    };
  }, [retryCount]);

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
      <Link
        href="/profile"
        aria-label="Open profile"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#bdc8bb] bg-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
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
      </Link>
    );
  }

  if (!loaded) {
    return (
      <span
        role="status"
        className="inline-flex h-8 w-8 rounded-full border border-[#dfe3d6] bg-white/70"
      >
        <span className="sr-only">Loading profile menu</span>
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

  if (!user) return null;

  if (showName) {
    return (
      <Link
        href="/profile"
        aria-label={`Open profile for ${user.displayName}`}
        className="flex min-w-0 items-center gap-3 rounded-xl p-1 transition-colors hover:bg-[#eef0e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#bdc8bb] bg-white">
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
            <span aria-hidden="true" className="text-xs font-semibold text-[#254a38]">
              {initial}
            </span>
          )}
        </span>
        <span className="min-w-0 text-xs leading-5 text-[#5b6b61]">
          <span className="block truncate font-semibold text-[#24352d]">{user.displayName}</span>
          <span className="block truncate">Demo profile</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      aria-label="Open profile"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#bdc8bb] bg-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] focus-visible:ring-offset-2"
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
        <span aria-hidden="true" className="text-xs font-semibold text-[#254a38]">
          {initial}
        </span>
      )}
    </Link>
  );
}
