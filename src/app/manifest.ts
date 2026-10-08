import type { MetadataRoute } from "next";
import { assetPath } from "../lib/site.ts";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: assetPath("/studio"),
    name: "U*TTU Studio",
    short_name: "U*TTU",
    description: "Cast, décor, prise. La vidéo de ton personnage, dans le studio.",
    lang: "fr-CH",
    start_url: assetPath("/studio"),
    scope: assetPath("/"),
    display: "standalone",
    background_color: "#0B0A09",
    theme_color: "#0B0A09",
    icons: [{ src: assetPath("/icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
