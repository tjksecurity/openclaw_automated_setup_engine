import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenClaw Setup Engine",
  description:
    "Web-based setup wizard for OpenClaw. Configure models, agents, integrations, and deploy — with tooltips and one-click auto-fixes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
