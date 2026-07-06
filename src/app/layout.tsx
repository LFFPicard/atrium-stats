import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { defaultTheme, themeToCSS } from "@/lib/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Atrium Stats',
  description: 'Your personal Plex stats dashboard and year-in-review',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fixed to the default preset for now — an admin Settings page for switching presets
  // and per-element overrides (mirroring Atrium's settings-table-backed system) comes later,
  // it isn't part of Batch 1's foundation work.
  const themeCSS = themeToCSS(defaultTheme.vars);

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
