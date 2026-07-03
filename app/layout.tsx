import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spodgeet — Admin",
  description: "Spodgeet — race & route master data manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fjalla+One&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-sand text-ink font-body antialiased">{children}</body>
    </html>
  );
}
