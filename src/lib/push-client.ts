"use client";

// Browser side of medicine-reminder notifications and the PWA (contract §3f).
// UI components call these; they never touch keys other than the VAPID public key.
import { getNotificationConfig, removePushSubscription, savePushSubscription } from "@/lib/api-client";

export const SERVICE_WORKER_URL = "/sw.js";

export type PushSupport = "supported" | "unsupported" | "ios-needs-install";

/** Whether this browser can receive web push notifications at all. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (supported) return "supported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return ios && !isStandalone() ? "ios-needs-install" : "unsupported";
}

/** True when running as an installed app (home-screen PWA). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Registers /sw.js (safe to call on every page load). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  } catch {
    return null;
  }
}

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** This browser's current push subscription, or null. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export type EnablePushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "ios-needs-install" | "denied" | "not-configured" | "failed" };

/**
 * Asks for notification permission (call from a click handler), subscribes this
 * browser and saves the subscription. Without it, reminders arrive by email.
 */
export async function enablePushNotifications(): Promise<EnablePushResult> {
  const support = pushSupport();
  if (support !== "supported") return { ok: false, reason: support };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const config = await getNotificationConfig();
    if (!config.pushAvailable || !config.vapidPublicKey) return { ok: false, reason: "not-configured" };
    const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    await navigator.serviceWorker.ready;
    const applicationServerKey = base64UrlToUint8Array(config.vapidPublicKey);
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Re-subscribe if the server's key changed.
      const current = subscription.options.applicationServerKey;
      const same =
        current !== null &&
        new Uint8Array(current).length === applicationServerKey.length &&
        new Uint8Array(current).every((byte, index) => byte === applicationServerKey[index]);
      if (!same) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    await savePushSubscription(subscription.toJSON());
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Turns notifications off for this browser (reminders then go by email). */
export async function disablePushNotifications(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => false);
  await removePushSubscription(endpoint);
}

/** The Android/desktop Chrome install prompt event (not in the TS DOM types). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}
