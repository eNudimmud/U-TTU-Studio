import type { MetadataRoute } from "next";
import { assetPath } from "../lib/site.ts";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: assetPath("/studio"),
    name: "U*TTU Studio",
    short_name: "U*TTU",
    description: "Ton style, ta scène, la prise.",
    lang: "fr-CH",
    start_url: `${assetPath("/studio")}?step=look`,
    scope: assetPath("/"),
    display: "standalone",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    icons: [{ src: assetPath("/icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
