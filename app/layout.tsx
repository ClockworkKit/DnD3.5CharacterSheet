import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barrow Ledger — 3.5 Character Sheet",
  description: "A complete adventurer’s ledger, spellbook, and Roll20 companion for 3.5.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><Script src="/theme.js" strategy="beforeInteractive" /><Script src="/bridge.js" strategy="beforeInteractive" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
