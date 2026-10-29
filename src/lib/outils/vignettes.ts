// One thumbnail per tool card, 16:10: 640x400 webp plus a 1280x800 @2x, composed by
// scripts/brand/make_vignettes.py from illustrations generated with Grok Imagine (sources in
// scripts/brand/vignettes-sources). Each card shows what the tool does: before/after wipes,
// cut-outs on a checkerboard, a timeline, a waveform. Where motion says it better, the card also has
// a silent 3 to 4 s loop (webm + mp4); the still stays its poster and the reduced-motion fallback.

const VIGNETTES = new Set([
  "img-klein", "img-qwen", "img-flux3", "img-ideogram", "img-gpt", "img-seedream", "img-nano", "img-refs", "img-360", "img-croquis",
  "ret-modifier", "ret-finaliser", "ret-elargir", "ret-detourer", "ret-eclairer",
  "ret-angles-perso", "ret-angles-decor", "ret-camera",
  "vid-wan", "vid-texte", "vid-raccord", "vid-h3-refs", "vid-multi", "vid-transition-style", "vid-vidu", "vid-prolonger", "vid-parler", "vid-finaliser",
  "vid-recadrer", "vid-detourer", "vid-levres", "vid-effacer", "vid-fluidifier", "vid-mouvement",
  "3d-ouvert", "reperage", "maquette",
  "son-voix-ouverte", "son-dialogue", "son-musique-ouverte", "son-bruitage-ouvert", "son-musique-video",
  "son-bruitage-video", "son-separer",
]);

/** The « Repérer un lieu » card: free 3D scouting, opened from the rail and the 3D row. */
export const REPERAGE_ID = "reperage";

/** The « Maquette 3D et cadrage » card: the free PRISE maquette, opened from the 3D row. */
export const MAQUETTE_ID = "maquette";

/** Hash that opens PRISE with its maquette unfolded. */
export const MAQUETTE_HASH = "#prise/maquette";

/** Cards whose thumbnail also has a silent loop. */
const ANIMEES = new Set([
  "img-360", "img-croquis",
  "ret-modifier", "ret-finaliser", "ret-elargir", "ret-detourer", "ret-eclairer",
  "vid-wan", "vid-texte", "vid-raccord", "vid-prolonger", "vid-parler", "vid-finaliser",
  "vid-recadrer", "vid-detourer", "vid-levres", "vid-effacer",
  "maquette",
  "son-voix-ouverte", "son-dialogue", "son-musique-ouverte", "son-bruitage-ouvert", "son-musique-video",
]);

/** Open-weight heads that reuse the thumbnail of the card they now lead. */
const MEME_VIGNETTE: Record<string, string> = { "ret-eclairer-ouvert": "ret-eclairer", "ret-lumiere-image": "ret-eclairer" };
const nom = (id: string) => MEME_VIGNETTE[id] ?? id;

/** Public path of a tool's thumbnail, or null (a tool without a thumbnail yet). */
export function vignette(id: string): string | null {
  if (id === "vid-genjutsu") return UTTU_PORTRAIT_WIDE;
  return VIGNETTES.has(nom(id)) ? `/exemples/vignettes/${nom(id)}.webp` : null;
}

/** The same thumbnail at 1280x800, for dense screens. */
export function vignette2x(id: string): string | null {
  if (id === "vid-genjutsu") return UTTU_PORTRAIT_WIDE_HD;
  return VIGNETTES.has(nom(id)) ? `/exemples/vignettes/${nom(id)}@2x.webp` : null;
}

/** The card's silent loop (webm first, mp4 for Safari), or null for a still card. */
export function vignetteAnimee(id: string): { webm: string; mp4: string } | null {
  return ANIMEES.has(nom(id)) ? { webm: `/exemples/vignettes/${nom(id)}.webm`, mp4: `/exemples/vignettes/${nom(id)}.mp4` } : null;
}

/** Uttu, the studio's character: the canon portrait, cropped so only she is in frame. */
// Uttu, HD portrait v2 (2026-10-23): 600 × 900 and 960 × 1440 upright, 600 × 375 and 1200 × 750 wide.
export const UTTU_PORTRAIT = "/images/uttu-portrait.webp";
export const UTTU_PORTRAIT_HD = "/images/uttu-portrait-960.webp";
export const UTTU_PORTRAIT_WIDE = "/images/uttu-portrait-large.webp";
export const UTTU_PORTRAIT_WIDE_HD = "/images/uttu-portrait-large-1200.webp";
