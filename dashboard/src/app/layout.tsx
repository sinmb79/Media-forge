import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { StudioShell } from "@/components/studio-shell";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MediaForge Studio",
  description: "Local-first AI media production dashboard for MediaForge.",
};

const htmlClassName = `${jakartaSans.variable} ${plexMono.variable} h-full antialiased dark`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={htmlClassName}
    >
      <body className="min-h-full bg-[#05070d] text-white">
        <StudioShell>{children}</StudioShell>
      </body>
    </html>
  );
}
