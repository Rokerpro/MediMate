// MediMate service worker: medicine-reminder notifications + installable app (PWA).
// Privacy: only the offline page is cached. Pages and API responses (which hold
// health data) are never stored by this worker.
const CACHE = "medimate-shell-v2";
const OFFLINE_URL = "/offline.html";
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, ICON]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Page navigations: always the network; the offline page only when it fails.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
  );
});

// A medicine reminder from /api/notifications/dispatch.
self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || data.type !== "medication-reminder" || typeof data.doseId !== "string") return;

  event.waitUntil(
    self.registration.showNotification(data.title || "Medicine reminder", {
      body: data.body || "Tap to confirm once you have taken it.",
      tag: `dose-${data.doseId}`,
      renotify: true,
      requireInteraction: true,
      icon: ICON,
      badge: BADGE,
      data: { doseId: data.doseId, url: data.url || `/reminders?dose=${encodeURIComponent(data.doseId)}` },
      actions: [{ action: "confirm", title: "I took it" }],
    }),
  );
});

async function openApp(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if (new URL(client.url).origin === self.location.origin && "focus" in client) {
      await client.focus();
      if ("navigate" in client) return client.navigate(target);
      return client;
    }
  }
  return self.clients.openWindow(target);
}

// Tapping the notification opens the dose so the user can confirm it.
// "I took it" confirms straight away; if that fails (signed out, too late,
// offline) the dose page opens instead.
self.addEventListener("notificationclick", (event) => {
  const { doseId, url } = event.notification.data || {};
  event.notification.close();
  if (typeof doseId !== "string") return;

  if (event.action === "confirm") {
    event.waitUntil(
      fetch(`/api/reminders/doses/${encodeURIComponent(doseId)}/confirm`, {
        method: "POST",
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) return openApp(`${url}&confirm=failed`);
          return self.registration.showNotification("Marked as taken", {
            body: "MediMate will not remind you about this dose again.",
            tag: `dose-${doseId}`,
            icon: ICON,
            badge: BADGE,
            silent: true,
          });
        })
        .catch(() => openApp(url)),
    );
    return;
  }
  event.waitUntil(openApp(url));
});
