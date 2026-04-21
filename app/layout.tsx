import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suzi Chatbox FSM Testbed",
  description: "Chat input replica and mascot finite state machine testbed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
