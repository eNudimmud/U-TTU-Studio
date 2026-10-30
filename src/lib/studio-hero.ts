import { assetPath } from "@/lib/site";

/** The /studio entry picture (its LCP element). One definition for the <img> and the server preload,
 *  so the browser fetches the same file early, at high priority, in the width the screen needs. */
export const STUDIO_HERO = {
  src: assetPath("/exemples/decor-quai-nuit-960.webp"),
  srcSet: [
    `${assetPath("/exemples/decor-quai-nuit-640.webp")} 640w`,
    `${assetPath("/exemples/decor-quai-nuit-960.webp")} 960w`,
    `${assetPath("/exemples/decor-quai-nuit.webp")} 1600w`,
  ].join(", "),
  // Measured: full width minus the gutters up to ~1000 px, then capped at 918 px.
  sizes: "(max-width: 1000px) calc(100vw - 32px), 920px",
} as const;

/** Tool card thumbnails: drawn 154–240 CSS px wide, so the 1280 px file is only for very dense screens. */
export const THUMB_SIZES = "(max-width: 700px) 45vw, 240px";
