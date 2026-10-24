import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Werkplan",
    short_name: "Werkplan",
    description: "All-in-One für den Handwerksalltag, vom Erstkontakt bis zur Abrechnung.",
    start_url: "/baustelle",
    scope: "/",
    display: "standalone",
    background_color: "#f3f0ea",
    theme_color: "#1e4638",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
