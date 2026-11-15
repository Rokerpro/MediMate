"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  API_REQUEST_ACTIVITY_EVENT,
  getActiveApiRequestIds,
} from "@/lib/api-client";

const MINIMUM_DISPLAY_MS = 1_000;
const REQUEST_QUIET_PERIOD_MS = 200;
const NAVIGATION_TIMEOUT_MS = 30_000;

type NavigationState = {
  startedAt: number;
  routeChanged: boolean;
  routeChangedAt: number;
};

function normalizedPath(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function destinationPath(anchor: HTMLAnchorElement) {
  if (!anchor.href || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) {
    return null;
  }

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return null;
  return normalizedPath(destination.pathname);
}

export function RoutePreloader() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const currentPath = useRef(pathname);
  const navigation = useRef<NavigationState | null>(null);
  const pendingRequests = useRef(new Set<string>());
  const lastRequestActivityAt = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const monitorNavigationRef = useRef<((state: NavigationState) => void) | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    function clearNavigation() {
      navigation.current = null;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVisible(false);
    }

    function monitorNavigation(state: NavigationState) {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        if (navigation.current !== state || !state.routeChanged) return;

        const minimumElapsed =
          Date.now() - state.startedAt >= MINIMUM_DISPLAY_MS;
        const requestsComplete = pendingRequests.current.size === 0;
        const routeSettled =
          Date.now() - state.routeChangedAt >= REQUEST_QUIET_PERIOD_MS;
        const requestsSettled =
          Date.now() - lastRequestActivityAt.current >= REQUEST_QUIET_PERIOD_MS;

        if (minimumElapsed && routeSettled && requestsComplete && requestsSettled) {
          clearNavigation();
        }
      }, 50);
    }

    monitorNavigationRef.current = monitorNavigation;

    function beginNavigation() {
      if (navigation.current) return;
      const state: NavigationState = {
        startedAt: Date.now(),
        routeChanged: false,
        routeChangedAt: 0,
      };
      navigation.current = state;
      setVisible(true);
      timeoutRef.current = window.setTimeout(clearNavigation, NAVIGATION_TIMEOUT_MS);
      return state;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const path = destinationPath(anchor);
      if (path === null || path === currentPath.current) return;
      beginNavigation();
    }

    function handlePopState() {
      if (normalizedPath(window.location.pathname) === currentPath.current) return;
      beginNavigation();
    }

    function handleApiRequestActivity(event: Event) {
      const { requestId, active } = (
        event as CustomEvent<{ requestId: string; active: boolean }>
      ).detail;
      lastRequestActivityAt.current = Date.now();
      if (active) pendingRequests.current.add(requestId);
      else pendingRequests.current.delete(requestId);
    }

    pendingRequests.current = new Set(getActiveApiRequestIds());
    if (pendingRequests.current.size > 0) lastRequestActivityAt.current = Date.now();
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener(API_REQUEST_ACTIVITY_EVENT, handleApiRequestActivity);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(API_REQUEST_ACTIVITY_EVENT, handleApiRequestActivity);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      monitorNavigationRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = navigation.current;
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      if (state) {
        state.routeChanged = true;
        state.routeChangedAt = Date.now();
        monitorNavigationRef.current?.(state);
      }
    }
  }, [pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      aria-hidden={!visible}
      className={`fixed inset-0 z-[200] flex print:hidden items-center justify-center bg-[#f7f5ed] transition-opacity duration-300 motion-reduce:transition-none ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-[#dfe3d6] border-t-[#bd7e3e] motion-reduce:animate-none" />
          <span className="h-10 w-10 rounded-full bg-[#254a38] shadow-[0_8px_24px_rgba(37,74,56,0.2)]" />
          <span className="absolute h-2.5 w-2.5 translate-x-5 -translate-y-5 rounded-full bg-[#bd7e3e]" />
        </div>
        <p className="display-font text-5xl font-semibold tracking-[-0.06em] text-[#254a38] sm:text-6xl">
          MediMate
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6a47]">
          Preparing your workspace
        </p>
        <div className="mt-7 flex gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#bd7e3e]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#bd7e3e] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#bd7e3e] [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
