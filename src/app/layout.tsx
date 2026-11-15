import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RoutePreloader } from "@/components/route-preloader";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediMate — Notice more. Assume less.",
  description: "A history-aware, non-diagnostic health information prototype built for clearer care conversations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <RoutePreloader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
