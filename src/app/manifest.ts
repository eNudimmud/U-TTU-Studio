import type { MetadataRoute } from "next";
import { assetPath } from "../lib/site.ts";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: assetPath("/studio"),
    name: "U*TTU Studio",
    short_name: "U*TTU",
    description: "Studio vidéo open source : personnage, décor, plans et montage, avec le coût affiché avant chaque rendu.",
    lang: "fr-CH",
    start_url: assetPath("/studio"),
    scope: assetPath("/"),
    display: "standalone",
    background_color: "#0F0F11",
    theme_color: "#0F0F11",
    icons: [
      { src: assetPath("/brand/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: assetPath("/brand/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: assetPath("/brand/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
