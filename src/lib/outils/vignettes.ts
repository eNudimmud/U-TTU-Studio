// One thumbnail per tool card, 16:10 (640x400 webp), composed by scripts/brand/make_vignettes.py from
// house renders already in public/exemples, frames of the example shot and real studio captures.
// « Ce que tu donnes → ce que tu obtiens »: the result fills the frame, the input sits bottom-left
// with one gold arrow. Nothing is generated for a card, and no card shows a picture a model did not make.

const VIGNETTES = new Set([
  "img-klein", "img-qwen", "img-flux3", "img-ideogram", "img-gpt", "img-seedream", "img-nano", "img-refs", "img-360", "img-croquis",
  "ret-modifier", "ret-finaliser", "ret-elargir", "ret-detourer", "ret-eclairer",
  "vid-wan", "vid-texte", "vid-raccord", "vid-h3-refs", "vid-vidu", "vid-prolonger", "vid-parler", "vid-finaliser",
  "vid-recadrer", "vid-detourer", "vid-levres", "vid-effacer", "vid-fluidifier", "vid-mouvement",
  "3d-ouvert", "reperage", "maquette",
  "son-voix-ouverte", "son-dialogue", "son-musique-ouverte", "son-bruitage-ouvert", "son-musique-video",
]);

/** The « Repérer un lieu » card: free 3D scouting, opened from the rail and the 3D row. */
export const REPERAGE_ID = "reperage";

/** The « Maquette 3D et cadrage » card: the free PRISE maquette, opened from the 3D row. */
export const MAQUETTE_ID = "maquette";

/** Hash that opens PRISE with its maquette unfolded. */
export const MAQUETTE_HASH = "#prise/maquette";

/** Public path of a tool's thumbnail, or null (a tool without a thumbnail yet). */
export function vignette(id: string): string | null {
  return VIGNETTES.has(id) ? `/exemples/vignettes/${id}.webp` : null;
}

/** Uttu, the studio's character: the canon portrait, cropped so only she is in frame. */
export const UTTU_PORTRAIT = "/images/uttu-portrait.webp";
export const UTTU_PORTRAIT_WIDE = "/images/uttu-portrait-large.webp";
