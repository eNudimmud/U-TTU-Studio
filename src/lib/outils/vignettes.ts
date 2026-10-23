// One real thumbnail per tool card: a 16:10 crop of a house render already in public/exemples
// (scripts/brand/make_vignettes.py). Sound tools have no picture; their card draws a quiet wave.
// Nothing here is generated for the card, and the golden web never appears outside the logo.

const VIGNETTES = new Set([
  "img-klein", "img-qwen", "img-flux3", "img-ideogram", "img-gpt", "img-seedream", "img-refs", "img-360", "img-croquis",
  "ret-modifier", "ret-finaliser", "ret-elargir", "ret-detourer", "ret-eclairer",
  "vid-wan", "vid-texte", "vid-raccord", "vid-h3-refs", "vid-vidu", "vid-prolonger", "vid-parler", "vid-finaliser",
  "vid-recadrer", "vid-detourer", "vid-levres", "vid-effacer", "vid-fluidifier", "vid-mouvement",
  "3d-ouvert", "reperage",
]);

/** The « Repérer un lieu » card: free 3D scouting, opened from the rail and the 3D row. */
export const REPERAGE_ID = "reperage";

/** Public path of a tool's thumbnail, or null (sound, or a tool without a render yet). */
export function vignette(id: string): string | null {
  return VIGNETTES.has(id) ? `/exemples/vignettes/${id}.webp` : null;
}

/** Uttu, the studio's character: the canon portrait, cropped so only she is in frame. */
// Uttu, HD portrait v2 (2026-10-23): 600 × 900 and 960 × 1440 upright, 600 × 375 and 1200 × 750 wide.
export const UTTU_PORTRAIT = "/images/uttu-portrait.webp";
export const UTTU_PORTRAIT_HD = "/images/uttu-portrait-960.webp";
export const UTTU_PORTRAIT_WIDE = "/images/uttu-portrait-large.webp";
export const UTTU_PORTRAIT_WIDE_HD = "/images/uttu-portrait-large-1200.webp";
