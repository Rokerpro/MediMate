import type { MetadataRoute } from "next";

/** Web app manifest: makes MediMate installable (Android "Add to Home screen", desktop Chrome/Edge). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MediMate",
    short_name: "MediMate",
    description: "A history-aware, non-diagnostic health information prototype with medicine reminders.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5ed",
    theme_color: "#254a38",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Reminders", url: "/reminders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Daily log", url: "/logs", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
