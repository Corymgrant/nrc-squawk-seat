import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NRC Cockpit",
    short_name: "Cockpit",
    description: "NoRepairCost owner cockpit — private daily driver.",
    start_url: "/dashboard",
    scope: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0D0C",
    theme_color: "#0B0D0C",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
