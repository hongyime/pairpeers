import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const alice = localFont({
  src: "./fonts/Alice.woff2",
  variable: "--font-alice",
  weight: "400",
  display: "swap",
});

const raleway = localFont({
  src: [
    { path: "./fonts/Raleway.woff2", weight: "400" },
    { path: "./fonts/Raleway-Bold.woff2", weight: "700" },
  ],
  variable: "--font-raleway",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PairPeers — Vouched, not swiped.",
  description:
    "Vouched, not swiped. Invite only dating through friends who know you best.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PairPeers",
  },
};

export const viewport: Viewport = {
  themeColor: "#FDFBF9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className={`${alice.variable} ${raleway.variable}`}>{children}</body>
    </html>
  );
}
