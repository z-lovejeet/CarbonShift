import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { getWebEnvironment } from "@/server/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarbonShift",
  description: "Thoughtful timing for everyday electricity use.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  getWebEnvironment();
  return <html lang="en-GB"><body><AppShell>{children}</AppShell></body></html>;
}
