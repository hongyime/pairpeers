import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PairPeers — Vouched, not swiped.",
  description:
    "An invite-only, friends-vouch-friends way to meet someone new. One thoughtful match at a time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
