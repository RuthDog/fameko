import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fameko",
    short_name: "Fameko",
    description:
      "Planera året och förstå hela hushållets ekonomi på ett lugnt och tydligt sätt.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ed",
    theme_color: "#f5f3ed",
    icons: [
      {
        src: "/icons/fameko-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/fameko-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
