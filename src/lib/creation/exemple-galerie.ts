// Accueil v2 « Pars d'un exemple »: real house renders (batch 2026-10-27 + earlier).
// Tapping a card fills the bar and shows the source on the stage. Nothing runs from here.

export type ExempleMode = "image" | "video";

export interface ExempleRefSpec {
  kind: "cast" | "decor";
  /** Stable demo id when promoting into the vault (demo-* or custom). */
  demoId: string;
  name: string;
  preview: string;
  thumb: string;
}

export interface ExempleCard {
  id: string;
  mode: ExempleMode;
  /** i18n key under barre.galerie.<id> */
  titleKey: string;
  textKey: string;
  /** Engine label shown on the card tag (Klein / LTX / Wan). */
  eng: "Klein" | "LTX" | "Wan";
  /** Tool route label for the route line (i18n under barre.galerie.tool.*). */
  tool: "klein" | "modifier" | "prise" | "wan";
  /** Credits estimate shown on the send button once filled. */
  price: number;
  /** Result / poster shown on the card and as the expected result. */
  img: string;
  thumb: string;
  /** Full-size source for the stage when text-only (same as result). */
  big?: string;
  /** When set, stage shows this as the source (before). */
  before?: ExempleRefSpec;
  refs: ExempleRefSpec[];
  /** Video duration label, when mode is video. */
  dur?: "5 s";
  /** Real clip when already rendered; otherwise poster + todo. */
  video?: string;
  poster?: string;
  /** Clip still to render (maquette). */
  todo?: boolean;
}

const UTTU: ExempleRefSpec = {
  kind: "cast", demoId: "demo-uttu", name: "Uttu",
  preview: "/images/uttu-portrait.webp", thumb: "/exemples/uttu-portrait-640.webp",
};
const QUAI: ExempleRefSpec = {
  kind: "decor", demoId: "demo-quai", name: "Le quai",
  preview: "/exemples/decor-quai-nuit.webp", thumb: "/exemples/decor-quai-nuit-640.webp",
};
const RUE: ExempleRefSpec = {
  kind: "decor", demoId: "demo-pluie", name: "Sous la pluie",
  preview: "/exemples/decor-rue-pluie.webp", thumb: "/exemples/decor-rue-pluie-640.webp",
};
const GARE: ExempleRefSpec = {
  kind: "decor", demoId: "demo-gare", name: "Le hall",
  preview: "/exemples/decor-gare.webp", thumb: "/exemples/decor-gare-640.webp",
};

/** Ordered gallery cards — matches maquette-galerie/index-v2.html CARDS. */
export const EXEMPLE_GALERIE: readonly ExempleCard[] = [
  {
    id: "quai", mode: "image", eng: "Klein", tool: "klein", price: 4,
    titleKey: "barre.galerie.quai.title", textKey: "barre.galerie.quai.text",
    img: "/exemples/decor-quai-nuit.webp", thumb: "/exemples/decor-quai-nuit-640.webp",
    big: "/exemples/decor-quai-nuit.webp", refs: [],
  },
  {
    id: "uttu-quai", mode: "video", eng: "LTX", tool: "prise", price: 12, dur: "5 s",
    titleKey: "barre.galerie.uttuQuai.title", textKey: "barre.galerie.uttuQuai.text",
    img: "/exemples/outils/prise-uttu-quai-poster.jpg", thumb: "/exemples/decor-quai-nuit-640.webp",
    refs: [UTTU, QUAI],
    video: "/exemples/outils/prise-uttu-quai.mp4",
    poster: "/exemples/outils/prise-uttu-quai-poster.jpg",
  },
  {
    id: "rue-aube", mode: "image", eng: "Klein", tool: "modifier", price: 4,
    titleKey: "barre.galerie.rueAube.title", textKey: "barre.galerie.rueAube.text",
    img: "/exemples/apres-decor-heure.webp", thumb: "/exemples/apres-decor-heure-640.webp",
    before: RUE, refs: [RUE],
  },
  {
    id: "pluie", mode: "image", eng: "Klein", tool: "klein", price: 4,
    titleKey: "barre.galerie.pluie.title", textKey: "barre.galerie.pluie.text",
    img: "/exemples/decor-rue-pluie.webp", thumb: "/exemples/decor-rue-pluie-640.webp",
    big: "/exemples/decor-rue-pluie.webp", refs: [],
  },
  {
    id: "gare", mode: "image", eng: "Klein", tool: "klein", price: 4,
    titleKey: "barre.galerie.gare.title", textKey: "barre.galerie.gare.text",
    img: "/exemples/decor-gare.webp", thumb: "/exemples/decor-gare-640.webp",
    big: "/exemples/decor-gare.webp", refs: [],
  },
  {
    id: "hall-anime", mode: "video", eng: "Wan", tool: "wan", price: 12, dur: "5 s",
    titleKey: "barre.galerie.hallAnime.title", textKey: "barre.galerie.hallAnime.text",
    img: "/exemples/outils/wan-gare-poster.jpg", thumb: "/exemples/decor-gare-640.webp",
    refs: [GARE],
    video: "/exemples/outils/wan-gare.mp4",
    poster: "/exemples/outils/wan-gare-poster.jpg",
  },
  {
    id: "quai-regard", mode: "image", eng: "Klein", tool: "modifier", price: 4,
    titleKey: "barre.galerie.quaiRegard.title", textKey: "barre.galerie.quaiRegard.text",
    img: "/exemples/apres-decor-photo.webp", thumb: "/exemples/apres-decor-photo-640.webp",
    before: QUAI, refs: [QUAI],
  },
  {
    id: "toit", mode: "image", eng: "Klein", tool: "klein", price: 4,
    titleKey: "barre.galerie.toit.title", textKey: "barre.galerie.toit.text",
    img: "/exemples/decor-toit-aube.webp", thumb: "/exemples/decor-toit-aube-640.webp",
    big: "/exemples/decor-toit-aube.webp", refs: [],
  },
];

export function exempleById(id: string): ExempleCard | undefined {
  return EXEMPLE_GALERIE.find(card => card.id === id);
}

/** Nearest gallery card for a planned route (quote card when Comfy is not linked). */
export function nearestExemple(input: { mode: ExempleMode; tool?: string; hasRefs: boolean }): ExempleCard {
  if (input.mode === "video" && input.tool === "prise") {
    return exempleById("uttu-quai") ?? EXEMPLE_GALERIE[1]!;
  }
  if (input.mode === "video") {
    return exempleById("hall-anime") ?? EXEMPLE_GALERIE[5]!;
  }
  if (input.hasRefs) {
    return exempleById("rue-aube") ?? EXEMPLE_GALERIE[2]!;
  }
  return exempleById("quai") ?? EXEMPLE_GALERIE[0]!;
}

export function thumbSrcSet(thumb640: string, full: string): string {
  return `${thumb640} 640w, ${full} 1280w`;
}
