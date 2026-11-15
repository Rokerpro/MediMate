"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiClientError,
  getNotificationConfig,
} from "@/lib/api-client";
import {
  currentPushSubscription,
  disablePushNotifications,
  enablePushNotifications,
  pushSupport,
  type PushSupport,
} from "@/lib/push-client";
import type { NotificationConfig } from "@/lib/validations";

type LoadState = "loading" | "ready" | "error";
type PushAction = "enable" | "disable";
type Feedback = {
  message: string;
  tone: "status" | "error";
  retry: PushAction | null;
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback;
}

export function ReminderNotifications() {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [busy, setBusy] = useState<PushAction | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [support, setSupport] = useState<PushSupport | null>(null);

  const loadConfig = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadState("loading");
    setLoadError("");
    try {
      const [nextConfig, subscription] = await Promise.all([
        getNotificationConfig(),
        currentPushSubscription(),
      ]);
      setConfig(nextConfig);
      setDeviceSubscribed(Boolean(subscription));
      setLoadState("ready");
    } catch (error) {
      setLoadError(errorText(error, "We could not load notification settings."));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadConfig(true));
    return () => window.cancelAnimationFrame(frame);
  }, [loadConfig]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSupport(pushSupport()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function turnOn() {
    setBusy("enable");
    setFeedback(null);
    try {
      const result = await enablePushNotifications();
      if (!result.ok) {
        const messages = {
          denied: "Notifications are blocked in your browser settings",
          "ios-needs-install": "Install MediMate to your Home Screen first",
          "not-configured": "Notifications aren't set up yet",
          unsupported: "Notifications aren't supported in this browser",
          failed: "We couldn't turn on notifications",
        } as const;
        const retry = result.reason === "failed" ? "enable" : null;
        setFeedback({
          message: messages[result.reason],
          tone: retry ? "error" : "status",
          retry,
        });
        return;
      }

      setFeedback({ message: "Notifications are on for this device.", tone: "status", retry: null });
      await loadConfig();
    } catch (error) {
      setFeedback({
        message: errorText(error, "We couldn't turn on notifications."),
        tone: "error",
        retry: "enable",
      });
    } finally {
      setBusy(null);
    }
  }

  async function turnOff() {
    setBusy("disable");
    setFeedback(null);
    try {
      await disablePushNotifications();
      setFeedback({ message: "Notifications are off on this device.", tone: "status", retry: null });
      await loadConfig();
    } catch (error) {
      setFeedback({
        message: errorText(error, "We couldn't turn off notifications."),
        tone: "error",
        retry: "disable",
      });
    } finally {
      setBusy(null);
    }
  }

  const unsupported = support === "unsupported";

  return (
    <section
      aria-labelledby="medicine-notifications-heading"
      className="space-y-4 rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 id="medicine-notifications-heading" className="text-xl font-semibold">
          Medicine notifications
        </h2>
        <p className="mt-2 text-sm text-[#5b6b61]">
          Medication reminders notify you at the due time, then 5 and 10 minutes later, until you confirm. Without notifications on, they&apos;re sent to your sign-in email.
        </p>
      </div>

      {loadState === "loading" && <p role="status">Loading notification settings…</p>}
      {loadState === "error" && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void loadConfig(true)}
            className="rounded-full bg-red-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && config && (
        <>
          <p className="text-sm font-semibold" role="status">
            {config.subscribedDevices > 0
              ? `On for ${config.subscribedDevices} ${config.subscribedDevices === 1 ? "device" : "devices"}`
              : "Off"}
          </p>
          {!config.pushAvailable && !config.emailAvailable && (
            <p className="text-sm text-[#5b6b61]">Notifications aren&apos;t set up yet.</p>
          )}
          {unsupported && (
            <p className="text-sm text-[#5b6b61]">Notifications aren&apos;t supported in this browser.</p>
          )}
          <button
            type="button"
            onClick={() => void (deviceSubscribed ? turnOff() : turnOn())}
            disabled={busy !== null || unsupported}
            className="w-full rounded-full bg-[#254a38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c3a2c] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] sm:w-auto"
          >
            {busy
              ? busy === "enable" ? "Turning on…" : "Turning off…"
              : deviceSubscribed ? "Turn off notifications on this device" : "Turn on notifications on this device"}
          </button>
        </>
      )}

      {feedback && (
        <div role={feedback.tone === "error" ? "alert" : "status"} className="space-y-2 text-sm">
          <p>{feedback.message}</p>
          {feedback.retry && (
            <button
              type="button"
              onClick={() => void (feedback.retry === "enable" ? turnOn() : turnOff())}
              disabled={busy !== null}
              className="rounded-full border border-[#cbd6c5] px-3 py-2 font-semibold hover:bg-[#f3f4ec] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48]"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </section>
  );
}
