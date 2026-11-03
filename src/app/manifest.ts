import type { MetadataRoute } from "next";
import { assetPath } from "../lib/site.ts";

// Versioned names (scripts/brand/make_icons.py): an installed app fetches the new icons.
const V = "v3";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: assetPath("/studio"),
    name: "U*TTU Studio",
    short_name: "U*TTU",
    description: "Open-source AI film studio on ComfyUI: characters, sets, shots and editing, with the estimated credits shown before every render.",
    lang: "en",
    start_url: assetPath("/studio"),
    scope: assetPath("/"),
    display: "standalone",
    background_color: "#0F0F11",
    theme_color: "#0F0F11",
    icons: [
      { src: assetPath(`/brand/icon-${V}-192.png`), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: assetPath(`/brand/icon-${V}-512.png`), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: assetPath(`/brand/icon-${V}-maskable-512.png`), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
