import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PairPeers — Vouched, not swiped.",
    short_name: "PairPeers",
    description:
      "An invite-only, friends-vouch-friends way to meet someone new.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF9",
    theme_color: "#FDFBF9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
